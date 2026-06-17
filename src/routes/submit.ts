import type { Config } from "../config.ts";
import { insertSubmission } from "../db.ts";
import { prepareEmails } from "../template.ts";
import { verifyTurnstile } from "../turnstile.ts";
import { sendEmail } from "../email.ts";

/**
 * Handle POST /submit — receive a form submission, store it, send emails, redirect.
 *
 * Pipeline:
 *   1. Validate Origin against ALLOWED_ORIGINS
 *   2. Parse form body (urlencoded or multipart, fields only)
 *   3. Extract _form_id; reject 400 if missing
 *   4. Verify Cloudflare Turnstile token; reject 403 on failure
 *   5. Generate UUID token and persist to SQLite
 *   6. Load template, interpolate fields, send admin + confirmation emails
 *   7. Respond 303 redirect to REDIRECT_URL
 */
export async function handlePostSubmit(
	req: Request,
	config: Config,
): Promise<Response> {
	// ---------------------------------------------------------------------------
	// 1. Origin check
	// ---------------------------------------------------------------------------
	const origin = req.headers.get("Origin") ?? "";
	if (origin && !config.allowedOrigins.includes(origin)) {
		return new Response("Forbidden: origin not allowed", { status: 403 });
	}

	// ---------------------------------------------------------------------------
	// 2. Parse body
	// ---------------------------------------------------------------------------
	let fields: Record<string, string>;
	try {
		const formData = await req.formData();
		fields = {};
		for (const [key, value] of formData.entries()) {
			// Store only string / file values (skip non-string blobs)
			if (typeof value === "string") {
				fields[key] = value;
			}
		}
	} catch {
		return new Response("Bad Request: unable to parse form body", {
			status: 400,
		});
	}

	// ---------------------------------------------------------------------------
	// 3. Extract _form_id
	// ---------------------------------------------------------------------------
	const formId = fields["_form_id"];
	if (!formId) {
		return new Response("Bad Request: missing _form_id", { status: 400 });
	}

	// ---------------------------------------------------------------------------
	// 4. Turnstile verification
	// ---------------------------------------------------------------------------
	const turnstileResponse = fields["cf-turnstile-response"];
	if (
		turnstileResponse &&
		!(await verifyTurnstile(
			config.turnstileSecret,
			turnstileResponse,
			req.headers.get("X-Forwarded-For") ?? undefined,
		))
	) {
		return new Response("Forbidden: turnstile verification failed", {
			status: 403,
		});
	}

	// ---------------------------------------------------------------------------
	// 5. Generate token and insert into database
	// ---------------------------------------------------------------------------
	const token = crypto.randomUUID();
	const submittedAt = new Date().toISOString();

	insertSubmission(
		formId,
		token,
		fields,
		req.headers.get("X-Forwarded-For") ?? null,
	);

	// ---------------------------------------------------------------------------
	// 6. Load template and send emails
	// ---------------------------------------------------------------------------
	const submissionLike = {
		form_id: formId,
		token,
		submitted_at: submittedAt,
		fields,
	};

	const emails = prepareEmails(config.templatesDir, formId, submissionLike);

	// Send admin notification (always)
	await sendEmail(
		config.adminEmail,
		emails.adminEmail.subject,
		emails.adminEmail.body,
	);

	// Send confirmation email (only if submitter provided an email)
	if (emails.confirmEmail) {
		await sendEmail(
			emails.confirmEmail.to,
			emails.confirmEmail.subject,
			emails.confirmEmail.body,
		);
	}

	// ---------------------------------------------------------------------------
	// 7. Redirect
	// ---------------------------------------------------------------------------
	return new Response(null, {
		status: 303,
		headers: { Location: config.redirectUrl },
	});
}
