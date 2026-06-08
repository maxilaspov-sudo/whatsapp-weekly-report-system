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
  source_message_id text          NOT NULL UNIQUE,

  -- Flag for records that need human review (e.g. parse was partial)
  needs_review      boolean       NOT NULL DEFAULT false
);

-- Index to accelerate weekly report date-range queries
CREATE INDEX IF NOT EXISTS closed_jobs_created_at_idx
  ON closed_jobs (created_at);
