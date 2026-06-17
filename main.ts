const SMTP_HOST = Deno.env.get("SMTP_HOST")!;
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASS = Deno.env.get("SMTP_PASS")!;
const SMTP_PORT = Deno.env.get("SMTP_PORT")!;
const SMTP_TLS = Deno.env.get("SMTP_TLS");

import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

const client = new SMTPClient({
  connection: {
    hostname: SMTP_HOST,
    port: Number(SMTP_PORT),
    tls: !!SMTP_TLS,
    auth: {
      username: SMTP_USER,
      password: SMTP_PASS,
    },
  },
});

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  console.log("Running");
  await client.send({
    from: "noreply@solutions.land",
    to: "vincent@khougaz.com",
    subject: "Test Email",
    content: "This is a test email from Deno using denomailer.",
  });

  await client.close();
}
