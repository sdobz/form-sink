import mailer from '@neabyte/deno-mailer'
import { loadConfig } from "./config.ts";

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  try {
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
      html: body,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}
