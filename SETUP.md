# Setup Guide

Complete these steps in order to get the system running from scratch.

---

## 1. Prerequisites

| Requirement | Minimum version |
|---|---|
| Node.js | 18.x or later |
| npm | 9.x or later |
| A Supabase account | free tier works |
| A WhatsApp account | the phone that will be linked |

Check your Node.js version:

```bash
node --version
```

---

## 2. Install dependencies

```bash
npm install
```

This installs all runtime and dev dependencies including `whatsapp-web.js`,
`@supabase/supabase-js`, `dotenv`, and the TypeScript toolchain.

---

## 3. Environment setup

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Then open `.env` and set every variable:

```
COMPANY_NAME=Your Company Name
WHATSAPP_PHONE_NUMBER=+1xxxxxxxxxx
REPORT_RECIPIENTS=manager@example.com

SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

TARGET_WHATSAPP_GROUP_ID=
TARGET_WHATSAPP_GROUP_NAME=Closed Jobs
```

**Variable reference:**

| Variable | Where to find it | Required |
|---|---|---|
| `COMPANY_NAME` | Your own value | No (informational) |
| `WHATSAPP_PHONE_NUMBER` | The number you will link | No (informational) |
| `REPORT_RECIPIENTS` | Comma-separated list | No (informational) |
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL | Yes for DB |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role | Yes for DB |
| `TARGET_WHATSAPP_GROUP_ID` | Printed to console on first group message (preferred) | One or the other |
| `TARGET_WHATSAPP_GROUP_NAME` | Substring of your group name (case-insensitive) | One or the other |

> **Security:** `.env` is listed in `.gitignore` and must never be committed.  
> The service-role key bypasses Supabase Row Level Security — keep it server-side only.

---

## 4. Supabase database setup

### 4a. Create the table

1. Open your Supabase project.
2. Go to **SQL Editor**.
3. Paste the contents of `supabase/schema.sql`.
4. Click **Run**.

This creates the `closed_jobs` table with a unique constraint on
`source_message_id` (prevents duplicate job saves at the database level) and an
index on `created_at` for fast date-range queries.

### 4b. Verify credentials

The `SUPABASE_SERVICE_ROLE_KEY` is the **service_role** secret key — not the
`anon` key. Use the `anon` key only in client-side apps. This system is a
backend service and must use the service-role key.

See `supabase/SETUP.md` for a full walkthrough including a schema column
reference.

---

## 5. WhatsApp listener setup

### 5a. First run — scan the QR code

```bash
npm run whatsapp:listen
```

A QR code is printed in the terminal. Open WhatsApp on the phone you want to
link, go to **Settings → Linked Devices → Link a Device**, and scan the code.

The session is saved to `.wwebjs_auth/` (excluded from git). Subsequent runs
reconnect automatically without scanning again.

### 5b. Identify your target group

On the first group message received, the listener prints:

```
──────────────────────────────────────────────────
source_message_id : true_120363xxxxxx@g.us_xxxxxxxx
chat_id           : 120363xxxxxx@g.us
chat_name         : Closed Jobs
sender            : 15551234567@c.us
body              :
John $250 check
```

Copy the `chat_id` value and paste it as `TARGET_WHATSAPP_GROUP_ID` in `.env`.
This is the most reliable filter — it matches by ID rather than name.

### 5c. Set the group filter

In `.env`, set one of:

```
# Option A — exact match by group ID (recommended)
TARGET_WHATSAPP_GROUP_ID=120363xxxxxx@g.us

# Option B — case-insensitive name substring match
TARGET_WHATSAPP_GROUP_NAME=Closed Jobs
```

Restart the listener after editing `.env`.

> **Note:** `.wwebjs_auth/` and `.wwebjs_cache/` are in `.gitignore`.
> The WhatsApp session is stored only on this machine.

---

## 6. Run the tests

```bash
npm test
```

All tests use an in-memory repository or mocked Supabase client. No real
database or WhatsApp connection is needed.

To run in watch mode during development:

```bash
npm run test:watch
```

---

## 7. Run the local demo

The demo runs a full end-to-end pipeline — parsing, saving, and report
generation — using hard-coded sample messages and an in-memory repository.
No database or WhatsApp connection required.

```bash
npm run demo:weekly-report
```

---

## 8. TypeScript type check

```bash
npx tsc --noEmit
```

This checks all source files for type errors without emitting any output.
Run this before committing changes.

To compile to JavaScript (produces `dist/`):

```bash
npm run build
```

---

## File security checklist

Before committing, verify that **none** of these are tracked by git:

```bash
git status
```

These paths must never appear in the output:

| Path | Contains |
|---|---|
| `.env` | All credentials and settings |
| `.wwebjs_auth/` | WhatsApp session data |
| `.wwebjs_cache/` | WhatsApp web cache |

All three are listed in `.gitignore`.
