# form-sink — Implementation Plan

A sequence of discrete operations for a local LLM to execute in order.

---

## 1. Scaffold repo

- [x] Scaffold repo

- Create `deno.json` with tasks: `start`, `dev`, `fmt`, `lint`
- Create `.gitignore`
- Create `flake.nix` with:
  - `inputs`: nixpkgs, flake-utils
  - `outputs`: `packages.<system>.default`, `nixosModules.default`

---

## 2. Config loader (`src/config.ts`)

- [x] Load config

Read all runtime config from environment variables. Export a single typed
`Config` object.

Variables:

- `PORT` (default `8080`)
- `DATA_DIR` — path where `form-sink.db` is created
- `TEMPLATES_DIR` — path to templates directory
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `ADMIN_EMAIL`
- `REDIRECT_URL` — where to send the browser after a successful submission
- `ALLOWED_ORIGINS` — comma-separated list
- `TURNSTILE_SECRET` — Cloudflare Turnstile secret key

---

## 3. Database (`src/db.ts`)

- [x] Implement database

- Open SQLite at `$DATA_DIR/form-sink.db`
- Run migrations on startup (plain SQL strings, no migration library)
- Schema:

```sql
CREATE TABLE IF NOT EXISTS submissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id     TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  fields      TEXT NOT NULL,  -- JSON blob
  submitted_at TEXT NOT NULL, -- ISO 8601
  ip          TEXT
);
```

- Export functions:
  - `insertSubmission(formId, token, fields, ip): void`
  - `getSubmission(token): Submission | null`

---

## 4. Template loader (`src/template.ts`)

- [x] Implement template loader

- Given a `formId`, load files from `$TEMPLATES_DIR/<formId>/`
- Files expected:
  - `admin.txt` — email body sent to admin
  - `confirm.txt` — email body sent to submitter
  - `meta.json` —
    `{ "emailField": "email", "subjectAdmin": "...", "subjectConfirm": "..." }`
- Interpolation: replace `{{ field_name }}` with the matching submitted value
- Special variables available in all templates:
  - `{{ submission_token }}`
  - `{{ submitted_at }}`
  - `{{ form_id }}`
- Return structured objects ready for `email.ts`
- Throw a clear error if the template directory does not exist for the given
  `formId`

---

## 5. Turnstile verification (`src/turnstile.ts`)

- [x] Add turnstile verification

- Accept the `cf-turnstile-response` field from the form body
- POST to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with:
  - `secret` — from config
  - `response` — the token from the form
  - `remoteip` — the submitter's IP (optional but recommended)
- Return `true` if `success === true`, `false` otherwise
- On failure return HTTP 403 to the client

---

## 6. Email sender (`src/email.ts`)

- [x] Implement email sender

- Use `https://deno.land/x/denomailer` - see `main.ts`
- Accept: `to`, `subject`, `body (plain text)`, and send via configured SMTP
- No HTML email, no attachments — plain text only
- Export: `sendEmail(to: string, subject: string, body: string): Promise<void>`

---

## 7. Submit route (`src/routes/submit.ts`)

- [x] Add submit route

Handles `POST /submit`.

Steps in order:

1. Check `Origin` header against `ALLOWED_ORIGINS`; reject with 403 if not
   matched
2. Parse body as `application/x-www-form-urlencoded` or `multipart/form-data`
   (fields only)
3. Extract hidden field `_form_id`; reject with 400 if missing
4. Extract `cf-turnstile-response`; call Turnstile verify; reject with 403 if
   invalid
5. Generate UUID token (`crypto.randomUUID()`)
6. Insert submission into SQLite
7. Load template for `_form_id`; interpolate fields
8. Send admin notification email to `ADMIN_EMAIL`
9. Send confirmation email to `fields[meta.emailField]` (skip silently if field
   absent)
10. Respond with `303 Location: $REDIRECT_URL`

---

## 8. View route (`src/routes/view.ts`)

- [x] Add View route

Handles `GET /submission/:token`.

Steps:

1. Look up token in SQLite
2. If not found, return 404 JSON `{ error: "not found" }`
3. Return 200 JSON `{ form_id, fields, submitted_at }`

No HTML rendering — JSON only.

---

## 9. HTTP server (`src/main.ts`)

- [x] Add http router

- Use `Deno.serve` (stdlib)
- Route table:
  - `POST /submit` → submit handler
  - `GET /submission/:token` → view handler
  - `GET /health` → `200 { ok: true }`
  - All others → `404`
- Set CORS headers on every response using `ALLOWED_ORIGINS`
- Log each request: method, path, status, duration

---

## 10. NixOS module (`nixos/module.nix`)

- [x] Add nixos module

Define `options.services.form-sink`:

```nix
enable         # bool
port           # int, default 8080
dataDir        # path, default /var/lib/form-sink
templatesDir   # path
adminEmail     # string
redirectUrl    # string
allowedOrigins # list of strings
smtp.host      # string
smtp.port      # int, default 587
smtp.user      # string
smtp.passwordFile  # path (read at runtime, not build time)
turnstile.secretFile  # path
```

`config` block:

- Creates systemd service `form-sink`
- Runs as dedicated user/group `form-sink`
- Sets `EnvironmentFile` from secrets files for `SMTP_PASS` and
  `TURNSTILE_SECRET`
- Sets all other vars via `Environment=`
- `StateDirectory = "form-sink"` (creates and owns `dataDir`)
- `ExecStart` runs the Deno binary with
  `--allow-net --allow-read --allow-env --allow-write=$DATA_DIR`

---

## 11. Nix package (`flake.nix` package output)

- [x] Add nix build to flake

- Use `pkgs.buildDenvDerivation` or `pkgs.runCommand` + Deno's `deno compile`
- Produce a single self-contained binary: `form-sink`
- Bundle all `src/` files; do not bundle the templates dir (runtime data)

---

## 12. Example template (`templates/example/`)

- [ ] Create example template

- `meta.json` with `emailField`, `subjectAdmin`, `subjectConfirm`
- `admin.txt` showing all available `{{ variable }}` placeholders
- `confirm.txt` with a thank-you message and `{{ submission_token }}`

---

## 13. README.md

- [ ] Write readme

Cover:

- What it is (one paragraph)
- How to add to a NixOS flake
- All module options (table)
- How to write a template
- How to embed the form on a static site (minimal HTML snippet)
- How Turnstile setup works (site key goes in the HTML, secret key goes in NixOS
  config)
