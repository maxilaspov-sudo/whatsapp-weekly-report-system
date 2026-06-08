# Security

## Critical Rules (non-negotiable)

1. **Never commit `.env`** — contains all credentials. It is in `.gitignore`
   and must stay there. Use `.env.example` (no real values) for documentation.

2. **Never commit `.wwebjs_auth/`** — contains the serialized WhatsApp browser
   session. Anyone with this directory can operate as the connected WhatsApp
   account. It is in `.gitignore` and must stay there.

3. **Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code** — this key
   bypasses Row Level Security entirely. It must only exist in the server
   process environment. It must never appear in logs, HTTP responses, or any
   code that runs outside the Node.js process.

---

## Environment Variable Handling

- Store all secrets in `.env` (local) or the platform's secret manager
  (production).
- Load via `dotenv` at process startup only (`import "dotenv/config"` in entry
  points).
- Never pass secrets as CLI arguments — they appear in process listings.
- Never interpolate secrets into log strings, even at debug level.
- Use `.env.example` with placeholder values (e.g., `SUPABASE_URL=your-url-here`)
  to document required variables without leaking real values.

Required environment variables:

| Variable | Sensitivity | Notes |
|---|---|---|
| `SUPABASE_URL` | Low | Project URL, not a secret, but keep out of public repos |
| `SUPABASE_SERVICE_ROLE_KEY` | **Critical** | Never expose outside server process |
| `TARGET_WHATSAPP_GROUP_ID` | Medium | Group identity; do not log in production |
| `TARGET_WHATSAPP_GROUP_NAME` | Medium | Same |
| `COMPANY_NAME` | Low | Display only |
| `WHATSAPP_PHONE_NUMBER` | Medium | Connected account number |
| `REPORT_RECIPIENTS` | Medium | Phone numbers of report recipients |

---

## WhatsApp Session Security

- The `.wwebjs_auth/` directory contains a Puppeteer browser profile with an
  active WhatsApp Web session. Treat it as a credential.
- Do not copy this directory between machines unless you intend to transfer the
  session.
- If the session is compromised (leaked, stolen, or the machine is
  decommissioned), log out from WhatsApp on all devices via the WhatsApp mobile
  app: **Settings → Linked Devices → remove the session**.
- Restrict filesystem permissions on `.wwebjs_auth/` to the process user only
  (`chmod 700` on Linux/macOS).
- On production servers, run the process as a dedicated low-privilege user that
  owns only the application directory.

---

## Principle of Least Privilege

- The Supabase service-role key is used because the backend writes on behalf of
  all users with no end-user authentication layer. If Row Level Security is
  added in the future, use a scoped key instead.
- The database user should have `INSERT`, `SELECT` on `closed_jobs` only. It
  does not need `UPDATE`, `DELETE`, `DROP`, or access to other tables.
- The Node.js process does not need filesystem access outside its working
  directory. Restrict accordingly on production.

---

## Production Deployment Recommendations

- Run the service as a non-root, dedicated OS user.
- Use a process supervisor (`pm2`, `systemd`, or equivalent) to restart on
  crash — but investigate crashes rather than silently restarting indefinitely.
- Keep Node.js and `whatsapp-web.js` (and its bundled Chromium) up to date.
  Outdated Chromium is a significant attack surface.
- Place the service behind a firewall; it does not expose any listening port by
  default, but Puppeteer/Chromium may open internal ports.
- Use environment-specific `.env` files — never reuse production credentials in
  development or staging.
- Enable audit logging at the Supabase project level to track all database
  operations.

---

## Logging Safety Rules

- Do not log the full text of WhatsApp messages in production. Closed-job
  messages contain customer names, phone numbers, and addresses (PII).
- Log message IDs (`source_message_id`) and processing outcomes (saved /
  invalid / duplicate), not message bodies.
- Do not log environment variable values, even at startup.
- If a parse error reason contains part of the raw message, sanitize or
  truncate before logging.
- Never log `SUPABASE_SERVICE_ROLE_KEY` or any other secret, even in error
  stack traces.

---

## Git Security Checklist

Before every commit:

- [ ] `git status` — confirm `.env` and `.wwebjs_auth/` are not staged
- [ ] `git diff --staged` — scan for any credential-looking strings
- [ ] Confirm `.gitignore` still contains `.env`, `.env.*`, and `.wwebjs_auth/`
- [ ] No new files contain hardcoded phone numbers, group IDs, or company names

If a secret was committed accidentally:

1. Do **not** just delete it in a follow-up commit — it remains in git history.
2. Rotate the credential immediately (see below).
3. Use `git filter-repo` (or BFG Repo Cleaner) to rewrite history and remove
   the file entirely.
4. Force-push the rewritten history and notify all collaborators to re-clone.

---

## Rotating Compromised Credentials

### Supabase service-role key

1. Go to Supabase Dashboard → Project Settings → API → Regenerate service-role
   key.
2. Update `.env` on all deployments with the new key.
3. Restart the Node.js process.
4. Verify the old key no longer works by attempting a direct API call with it.

### WhatsApp session

1. On the WhatsApp mobile app: Settings → Linked Devices → remove the
   compromised session.
2. Delete `.wwebjs_auth/` from the server.
3. Restart the service — it will display a new QR code to re-authenticate.

### Supabase project URL

The project URL is not a secret but identifies your project. If the project
must be replaced (e.g., after a severe breach), create a new Supabase project,
run `supabase/schema.sql`, update `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
in `.env`, and restart the service.
