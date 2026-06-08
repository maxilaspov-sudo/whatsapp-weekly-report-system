# Supabase Setup

## 1. Create a project

Go to https://supabase.com and create a new project.

## 2. Run the schema

Open **SQL Editor** in the Supabase Dashboard and paste the contents of
`supabase/schema.sql`, then click **Run**.

This creates the `closed_jobs` table with all required columns and a unique
constraint on `source_message_id` that prevents duplicate processing at the
database level.

## 3. Copy credentials

Go to **Project Settings → API** and copy:

| Setting | Environment variable |
|---|---|
| Project URL | `SUPABASE_URL` |
| `service_role` secret | `SUPABASE_SERVICE_ROLE_KEY` |

Paste them into your `.env` file (copy from `.env.example`).

> **Use the `service_role` key**, not the `anon` key.  
> The service-role key bypasses Row Level Security, which is correct for a
> backend service that writes on behalf of all users.  
> Never expose this key in client-side code.

## 4. Verify

```bash
# Type-check
npx tsc --noEmit

# Run tests (mock-based, no real connection needed)
npm test
```

## Schema overview

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Auto-generated |
| `raw_message` | text | Original WhatsApp message, always preserved |
| `company_name` | text | |
| `customer_name` | text | |
| `phone` | text | |
| `address` | text | |
| `service` | text | |
| `appointment` | text | |
| `technician_name` | text | |
| `closed_amount` | numeric | |
| `payment_method` | text | |
| `created_at` | timestamptz | Defaults to `now()` |
| `source_message_id` | text UNIQUE | WhatsApp message ID; prevents duplicate saves |
| `needs_review` | boolean | Defaults to `false` |
