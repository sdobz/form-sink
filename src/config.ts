/** Runtime configuration loaded entirely from environment variables. */

export interface Config {
  port: number;
  dataDir: string;
  templatesDir: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  adminEmail: string;
  redirectUrl: string;
  allowedOrigins: string[];
  turnstileSecret: string;
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function envOptional(name: string, defaultValue?: string): string | undefined {
  return Deno.env.get(name) ?? defaultValue;
}

/** Parse a comma-separated env value into a trimmed, non-empty string array. */
function envList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Load and validate the full configuration from environment variables. */
export function loadConfig(): Config {
  return {
    port: Number(envOptional("PORT", "8080")),
    dataDir: env("DATA_DIR"),
    templatesDir: env("TEMPLATES_DIR"),
    smtpHost: env("SMTP_HOST"),
    smtpPort: Number(envOptional("SMTP_PORT", "587")),
    smtpUser: env("SMTP_USER"),
    smtpPass: env("SMTP_PASS"),
    smtpFrom: env("SMTP_FROM"),
    adminEmail: env("ADMIN_EMAIL"),
    redirectUrl: env("REDIRECT_URL"),
    allowedOrigins: envList(env("ALLOWED_ORIGINS")),
    turnstileSecret: env("TURNSTILE_SECRET"),
  };
}
