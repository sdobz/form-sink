import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";
import { loadConfig } from "./config.ts";

export async function sendEmail(
	to: string,
	subject: string,
	body: string,
): Promise<void> {
	try {
		const config = loadConfig();
		const client = new SMTPClient({
			connection: {
				hostname: config.smtpHost,
				port: config.smtpPort,
				tls: true,
				auth: {
					username: config.smtpUser,
					password: config.smtpPass,
				},
			},
		});
		await client.send({
			from: config.smtpFrom,
			to,
			subject,
			content: body,
		});
		await client.close();
	} catch (error) {
		console.error("Failed to send email:", error);
	}
}
