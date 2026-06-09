-- WhatsApp Weekly Report System — Supabase schema
--
-- Run this once in the Supabase SQL Editor (or via psql) to create
-- the closed_jobs table.  Re-running is safe: the IF NOT EXISTS guard
-- prevents errors on subsequent runs.
--
-- The uuid-ossp extension is already enabled on every Supabase project.
-- If you are running this against a plain Postgres instance, uncomment
-- the line below:
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS closed_jobs (
  -- Primary key: auto-generated UUID
  id                uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Original WhatsApp message — always preserved regardless of parse quality
  raw_message       text          NOT NULL,

  -- Multi-company isolation fields.
  -- company_id is the registry identifier from GROUP_REGISTRY env var.
  -- whatsapp_group_id is the exact chat.id from the originating WhatsApp group.
  -- Every report query MUST be scoped by whatsapp_group_id to prevent
  -- jobs from one company appearing in another company's report.
  company_id        text          NOT NULL,
  whatsapp_group_id text          NOT NULL,

  -- Parsed fields from the full job message
  company_name      text          NOT NULL,
  customer_name     text          NOT NULL,
  phone             text          NOT NULL,
  address           text          NOT NULL,
  service           text          NOT NULL,
  appointment       text          NOT NULL,
  technician_name   text          NOT NULL,
  closed_amount     numeric       NOT NULL,
  payment_method    text          NOT NULL,

  -- Timestamp of when the record was inserted; used for date-range queries
  created_at        timestamptz   NOT NULL DEFAULT now(),

  -- Unique identifier from the originating WhatsApp message.
  -- The UNIQUE constraint is the database-level guard against double processing.
  -- WhatsApp message IDs are globally unique (they include the group ID internally),
  -- so this constraint is safe across groups.
  source_message_id text          NOT NULL UNIQUE,

  -- Flag for records that need human review (e.g. parse was partial)
  needs_review      boolean       NOT NULL DEFAULT false
);

-- Index to accelerate weekly report date-range queries
CREATE INDEX IF NOT EXISTS closed_jobs_created_at_idx
  ON closed_jobs (created_at);

-- Index to accelerate group-scoped report queries
CREATE INDEX IF NOT EXISTS closed_jobs_whatsapp_group_id_idx
  ON closed_jobs (whatsapp_group_id);

-- Index for company-level analytics and filtering
CREATE INDEX IF NOT EXISTS closed_jobs_company_id_idx
  ON closed_jobs (company_id);
