/**
 * Template loader and interpolation utilities for form-sink email templates.
 *
 * Each form has a subdirectory under the templates directory containing:
 * - meta.json — metadata (email field, subjects)
 * - admin.txt — plaintext body template for the admin notification
 * - confirm.txt — plaintext body template for the submitter confirmation
 * - admin.html — HTML body template for the admin notification
 * - confirm.html — HTML body template for the submitter confirmation
 */

/** Metadata loaded from a form's meta.json file. */
export interface TemplateMeta {
  emailField: string;
  subjectAdmin: string;
  subjectConfirm: string;
  adminBody: string;
  confirmBody: string;
  adminBodyHtml: string;
  confirmBodyHtml: string;
}

/** Minimal shape needed from a submission for template interpolation. */
export interface SubmissionLike {
  form_id: string;
  token: string;
  submitted_at: string;
}

// ---------------------------------------------------------------------------
// Template loading
// ---------------------------------------------------------------------------

/**
 * Load all template files for a given form.
 *
 * @param formId - The form identifier used as subdirectory name
 * @param templatesDir - Root templates directory path
 * @returns Parsed template metadata with raw body texts
 * @throws Error if the template directory or meta.json is missing
 */
export function loadTemplate(
  formId: string,
  templatesDir: string,
): TemplateMeta {
  const templateDir = `${templatesDir}/${formId}`;

  // Verify the template directory exists
  try {
    const stat = Deno.statSync(templateDir);
    if (!stat.isDirectory) {
      throw new Error(
        `Template path exists but is not a directory: ${templateDir}`,
      );
    }
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      throw new Error(
        `Template directory not found for form "${formId}": ${templateDir}`,
      );
    }
    throw err;
  }

  // Load meta.json
  const metaPath = `${templateDir}/meta.json`;
  let metaRaw: string;
  try {
    metaRaw = Deno.readTextFileSync(metaPath);
  } catch {
    throw new Error(
      `Template meta.json not found for form "${formId}": ${metaPath}`,
    );
  }

  const meta = JSON.parse(metaRaw) as {
    emailField: string;
    subjectAdmin: string;
    subjectConfirm: string;
  };

  // Load body templates
  const adminBody = Deno.readTextFileSync(`${templateDir}/admin.txt`);
  const confirmBody = Deno.readTextFileSync(`${templateDir}/confirm.txt`);
  const adminBodyHtml = Deno.readTextFileSync(`${templateDir}/admin.html`);
  const confirmBodyHtml = Deno.readTextFileSync(`${templateDir}/confirm.html`);

  return {
    emailField: meta.emailField,
    subjectAdmin: meta.subjectAdmin,
    subjectConfirm: meta.subjectConfirm,
    adminBody,
    confirmBody,
    adminBodyHtml,
    confirmBodyHtml,
  };
}

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

/**
 * Replace `{{ variable_name }}` placeholders in a template string.
 *
 * Special variables are injected first:
 * - `{{ submission_token }}` — the submission's unique token
 * - `{{ submitted_at }}` — the ISO timestamp of submission
 * - `{{ form_id }}` — the form identifier
 *
 * Any remaining placeholders are resolved against the submitted fields map.
 * Unresolved placeholders are left as-is.
 *
 * @param template - The raw template string containing `{{ ... }}` placeholders
 * @param fields - Submitted form field values
 * @param submission - The submission record providing special variables
 * @returns The interpolated string
 */
export function interpolate(
  template: string,
  fields: Record<string, string>,
  submission: SubmissionLike,
): string {
  // Merge special submission variables with field values.
  // Fields take precedence over special vars if names collide.
  const resolved: Record<string, string> = {
    submission_token: submission.token,
    submitted_at: submission.submitted_at,
    form_id: submission.form_id,
    ...fields,
  };

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const value = resolved[key];
    return value !== undefined ? value : _match;
  });
}

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

export interface EmailBody {
  text: string;
  html?: string;
}

/**
 * Load a template and produce ready-to-send email objects for both admin
 * and submitter confirmation.
 *
 * @param templateDirPath - Root templates directory
 * @param formId - The form identifier
 * @param submission - The submission record (must include `fields`)
 * @returns Object with `adminEmail` and optional `confirmEmail`
 */
export function prepareEmails(
  templateDirPath: string,
  formId: string,
  submission: SubmissionLike & { fields: Record<string, string> },
): {
  adminEmail: { to?: string; subject: string; body: EmailBody };
  confirmEmail?: { to: string; subject: string; body: EmailBody };
} {
  const template = loadTemplate(formId, templateDirPath);

  const adminBody: EmailBody = {
    text: interpolate(
      template.adminBody,
      submission.fields,
      submission,
    ),
    html: interpolate(
      template.adminBodyHtml,
      submission.fields,
      submission,
    ),
  };

  const adminEmail: { to?: string; subject: string; body: EmailBody } = {
    subject: interpolate(template.subjectAdmin, submission.fields, submission),
    body: adminBody,
  };

  const result: ReturnType<typeof prepareEmails> = { adminEmail };

  const emailValue = submission.fields[template.emailField];
  if (emailValue && emailValue.trim() !== "") {
    const confirmBody: EmailBody = {
      text: interpolate(
        template.confirmBody,
        submission.fields,
        submission,
      ),
      html: interpolate(
        template.confirmBodyHtml,
        submission.fields,
        submission,
      ),
    };

    result.confirmEmail = {
      to: emailValue,
      subject: interpolate(
        template.subjectConfirm,
        submission.fields,
        submission,
      ),
      body: confirmBody,
    };
  }

  return result;
}
