import mailer from "@neabyte/deno-mailer";
import { loadConfig } from "./config.ts";
import type { EmailBody } from "./template.ts";

export async function sendEmail(
  to: string,
  subject: string,
  body: EmailBody,
): Promise<void> {
  const config = loadConfig();
  const transporter = mailer.transporter({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: true,
    auth: {
      type: "password",
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  await transporter.send({
    from: config.smtpFrom,
    to,
    subject,
    text: body.text,
    html: body.html,
  });
}
