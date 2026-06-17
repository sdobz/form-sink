import { getSubmission } from "../db.ts";

/**
 * Handle GET /submission/:token — return submission data as JSON.
 *
 * Steps:
 *   1. Look up token in SQLite
 *   2. If not found, return 404 JSON { error: "not found" }
 *   3. Return 200 JSON { form_id, fields, submitted_at }
 *
 * @param submissionToken - UUID token extracted from the URL path
 */
export function handleGetSubmission(submissionToken: string): Response {
	const submission = getSubmission(submissionToken);

	if (!submission) {
		return Response.json({ error: "not found" }, { status: 404 });
	}

	return Response.json({
		form_id: submission.form_id,
		fields: submission.fields,
		submitted_at: submission.submitted_at,
	});
}
