# Production Deployment Checklist

Work through each section top to bottom before going live.

---

## VPS Requirements

- [ ] VPS with at least **1 GB RAM** (Chromium/Puppeteer requirement for WhatsApp Web)
- [ ] Ubuntu 22.04 LTS or equivalent
- [ ] Node.js 18+ installed
- [ ] Outbound HTTPS (port 443) open for Supabase API calls

---

## Supabase Setup

- [ ] Create a Supabase project
- [ ] Run `supabase/schema.sql` in the Supabase SQL Editor to create the `closed_jobs` table
- [ ] Copy the **Project URL** (`SUPABASE_URL`)
- [ ] Copy the **service role key** (Settings → API → `service_role`) — **not the anon key**
- [ ] Confirm Row Level Security is configured per `supabase/SETUP.md`

**Do not use the anon key.** The bot runs server-side and requires the service-role key to bypass RLS for writes.

---

## Environment Variables

Create a `.env` file at the project root with all required variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

GROUP_REGISTRY=groupId1:companyId1,groupId2:companyId2
GROUP_ADMINS=groupId1:phone1@c.us|phone2@c.us,groupId2:phone3@c.us

COMPANY_NAME=Your Company Name
MANAGER_REPORT_RECIPIENT=15551234567@c.us
DEFAULT_TECHNICIAN_RECIPIENT=15559876543@c.us
```

Run `npm run system:health` to verify all variables are detected correctly before starting the bot.

---

## .env Security

- [ ] `.env` is listed in `.gitignore` — **confirm it is never committed**
- [ ] File permissions restricted: `chmod 600 .env`
- [ ] No secrets in shell history, logs, or environment dumps
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is **never** sent to a browser or exposed in any frontend code

---

## WhatsApp Session Persistence

The bot uses `LocalAuth` (whatsapp-web.js), which stores the authenticated session in `.wwebjs_auth/`.

- [ ] `.wwebjs_auth/` is listed in `.gitignore` — **confirm it is never committed**
- [ ] Back up the `.wwebjs_auth/` directory after the first successful scan
- [ ] If the session is lost, you must re-scan the QR code by running the listener manually

To re-authenticate: stop PM2, run `npm run whatsapp:listen` directly, scan the QR with the WhatsApp app, then restart PM2.

---

## PM2 Setup

Install PM2 globally and configure it to manage the listener process:

```bash
npm install -g pm2
pm2 start npm --name "whatsapp-bot" -- run whatsapp:listen
pm2 save
pm2 startup   # follow the printed command to enable auto-start on reboot
```

Useful PM2 commands:

```bash
pm2 status              # process list
pm2 logs whatsapp-bot   # live log stream
pm2 restart whatsapp-bot
pm2 stop whatsapp-bot
```

- [ ] `pm2 startup` configured so the process survives a server reboot
- [ ] `pm2 install pm2-logrotate` installed to prevent unbounded log growth
- [ ] `pm2 logs` verified — no crash loops at startup

---

## Timezone

Weekly reports cover Monday 00:00 to Sunday 23:59 in the **server's local timezone**.

- [ ] Set VPS timezone to match the client's operating timezone:
  ```bash
  timedatectl set-timezone America/New_York   # adjust as needed
  timedatectl status
  ```
- [ ] Verify that `npm run cron:weekly` fires at the expected local time

---

## Backup Recommendations

- [ ] `.wwebjs_auth/` backed up off-VPS after initial authentication (e.g., to S3 or Backblaze)
- [ ] Supabase point-in-time recovery enabled **or** a periodic export scheduled
- [ ] `.env` stored in a secrets manager or password vault (not just on the VPS)

---

## Restart and Recovery

| Event | Recovery Action |
|-------|----------------|
| Process crash | PM2 auto-restarts; check `pm2 logs` for cause |
| Server reboot | `pm2 resurrect` or auto-start via `pm2 startup` |
| WhatsApp session expired | Re-scan QR code manually, then restart bot |
| Supabase outage | Bot continues without saves; messages are not retried — monitor manually |

After any restart, an authorized admin must send `.start` again to reactivate job processing (processing state is in-memory and resets on restart).

---

## Monitoring Recommendations

- [ ] Set up an external uptime monitor (e.g., Uptime Robot, Better Stack) that pings a health endpoint or checks PM2 process status via SSH
- [ ] Review `pm2 logs` at least weekly during initial rollout
- [ ] Watch for repeated `[Pipeline] Invalid` log lines — indicates a technician formatting issue
- [ ] Alert on PM2 process restart events using `pm2` hooks or a monitoring integration

---

## Pre-Launch Verification

- [ ] `npm run system:health` — all checks pass
- [ ] `npm run db:smoke` — Supabase insert/read/delete round-trip succeeds
- [ ] Bot starts without errors: `pm2 logs whatsapp-bot`
- [ ] QR code scanned and WhatsApp shows "Linked Devices" entry
- [ ] Test group is registered in `GROUP_REGISTRY`
- [ ] Admin phone is registered in `GROUP_ADMINS`
- [ ] Send `.help` from the group — bot responds
- [ ] Send `.start` from an admin phone — bot responds with activation confirmation
- [ ] Post a sample closed-job message — `pm2 logs` shows `[Pipeline] Saved`
- [ ] Send `.report` — report text returned in the group

---

## Do Not

- **Do not** commit `.env` or `.wwebjs_auth/` to version control under any circumstances.
- **Do not** use the Supabase `anon` key in the bot — use the `service_role` key only.
- **Do not** expose `SUPABASE_SERVICE_ROLE_KEY` in any client-side, browser-accessible, or public-facing code.
- **Do not** share `.env` over unencrypted channels (email, Slack DMs, etc.).
