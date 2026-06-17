/**
 * Verify a Cloudflare Turnstile token.
 *
 * POSTs to `https://challenges.cloudflare.com/turnstile/v0/siteverify`
 * with the secret key, the user's response token, and optionally the
 * submitter's IP address.
 *
 * Returns `true` when Cloudflare reports `success: true`, `false` otherwise.
 */
export async function verifyTurnstile(
  secret: string,
  response: string,
  remoteip?: string,
): Promise<boolean> {
  const params = new URLSearchParams({
    secret,
    response,
  });
  if (remoteip) {
    params.set("remoteip", remoteip);
  }

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );

  if (!res.ok) return false;

  const body = (await res.json()) as Record<string, unknown>;
  return body.success === true;
}
