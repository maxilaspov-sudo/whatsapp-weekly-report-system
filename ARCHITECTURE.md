# Architecture

## Overview

A Node.js/TypeScript backend service that receives WhatsApp messages from a
technician group, parses closed-job reports, persists them to a database, and
generates weekly financial reports. There is no frontend.

The system is a **one-company-per-deployment template**. Each deployment has its
own WhatsApp session, database, and environment configuration. No data or state
is shared between deployments.

---

## Data Flow

```
WhatsApp group (inbound messages)
        │
        ▼
  whatsapp-web.js client
  [src/whatsapp/whatsappClient.ts]
        │  emits: message events
        ▼
  WhatsApp listener
  [src/whatsapp/runWhatsappListener.ts]
        │  filters by group ID or group name (env vars)
        │  extracts: { source_message_id, raw_message }
        ▼
  Pipeline: processIncomingMessages()
  [src/pipeline/weeklyReportPipeline.ts]
        │  parses each message via fullJobMessageParser
        │  saves valid records via ClosedJobRepository
        │  returns: ProcessResult { saved, invalid, duplicate }
        ▼
  ClosedJobRepository (interface)
  [src/db/closedJobRepository.ts]
        │
        ├── InMemoryClosedJobRepository  (tests / local demo)
        └── SupabaseClosedJobRepository  (production)
                │
                ▼
          Supabase / PostgreSQL
          [closed_jobs table]
                │
                ▼
  Pipeline: generateFormattedWeeklyReports()
  [src/pipeline/weeklyReportPipeline.ts]
        │  findByDateRange() → generateWeeklyReport() → formatters
        ▼
  Formatted report text strings
  (manager report + one per technician)
```

---

## Layer Responsibilities

| Layer | Files | Responsibility |
|---|---|---|
| **Ingestion** | `whatsapp/` | Connect to WhatsApp Web, filter to target group, forward raw messages |
| **Parsing** | `parser/` | Convert raw message strings to typed data structures; no I/O |
| **Persistence** | `db/` | Abstract storage behind a repository interface; two implementations |
| **Domain logic** | `reports/` | Aggregate jobs into weekly reports; format output text |
| **Pipeline** | `pipeline/` | Orchestrate parse → save and load → report; no transport knowledge |
| **Entry points** | `whatsapp/runWhatsappListener.ts`, `demo/` | Wire layers together; load env; initialize clients |

---

## Separation of Concerns

### Why business logic must stay outside the listener

`runWhatsappListener.ts` is a transport adapter. It knows about WhatsApp
message events and group filtering — nothing else. Parsing, persistence, and
report generation are separate layers that the listener calls into.

This boundary means:
- Parsers and the pipeline can be tested without a WhatsApp connection.
- The transport can be swapped (e.g., a REST endpoint for testing) without
  touching business logic.
- A bug in parsing never crashes the listener process through unhandled state.

### Why the repository is always injected

`ClosedJobRepository` is an interface, never instantiated inside pipeline or
report code. Callers construct and inject the concrete implementation.

This means:
- Tests use `InMemoryClosedJobRepository` — no network, no credentials, no
  side effects.
- Production uses `SupabaseClosedJobRepository` with the same pipeline code.
- Adding a new storage backend (e.g., a different database) requires only a
  new class that implements the interface — no pipeline changes.

---

## Parsers

### Single-line parser — `jobMessageParser.ts`

Parses the closing line of a job message.

```
Input:  "John $250 check"
Output: { technician_name: "John", closed_amount: 250, payment_method: "Check" }
```

Format: `<TechnicianName> [$]<Amount> <PaymentMethodAlias>`

Payment method aliases are resolved through `PAYMENT_METHOD_MAP`. Add new
aliases there as client deployments require them.

### Full message parser — `fullJobMessageParser.ts`

Parses a three-section WhatsApp message (sections separated by blank lines).

```
Section 1: Company name (first line)
Section 2: Labeled fields — Name, Phone, Address, Job type, Appointment
Section 3: Closing line (delegated to the single-line parser)
```

Label aliases are resolved through `LABEL_TO_FIELD`. Add new label aliases
there as message formats vary across deployments.

---

## Repository Pattern

```
ClosedJobRepository (interface)
  save(job: NewClosedJob): Promise<SaveResult>
  findByDateRange(start, end): Promise<ClosedJobRecord[]>
  findBySourceMessageId(id): Promise<ClosedJobRecord | null>
  listAll(): Promise<ClosedJobRecord[]>

Implementations:
  InMemoryClosedJobRepository  — Map-backed, synchronous under async API
  SupabaseClosedJobRepository  — PostgREST client; handles UNIQUE violation
                                 as SaveResult rather than throwing
```

Duplicate prevention is enforced at two levels:
1. The database has a `UNIQUE` constraint on `source_message_id`.
2. `SupabaseClosedJobRepository.save()` catches error code `23505` and returns
   `{ ok: false, error: "DUPLICATE_SOURCE_MESSAGE_ID" }` rather than throwing,
   so the pipeline can log duplicates without aborting the batch.

---

## One-Company-Per-Deployment Model

Each deployment is an isolated process with its own:

- WhatsApp session (`.wwebjs_auth/` directory)
- Supabase project and database
- `.env` file with all credentials and identifiers
- Target group configuration

Nothing is shared between deployments. There are no multi-tenant concepts,
shared databases, or centralized authentication.

**Consequence for the codebase:** no company name, technician name, group ID,
phone number, or credential may appear in source code. Every such value must
come from an environment variable. This rule is what makes the template
cloneable — clone the repo, fill in `.env`, and the system runs for a new
company.

---

## Current Architecture Boundaries

The WhatsApp listener and the pipeline are **intentionally decoupled** as of
the current build. `runWhatsappListener.ts` logs received messages to the
console but does not yet call `processIncomingMessages()` or interact with the
database. Wiring them together is the next integration phase.

The report generation path (`generateFormattedWeeklyReports`) is also not yet
triggered automatically. It must be called explicitly — either from a script
or a future cron job.

---

## Directory Structure

```
src/
  parser/
    jobMessageParser.ts
    fullJobMessageParser.ts
  reports/
    weeklyReportGenerator.ts
    reportFormatter.ts
  db/
    types.ts
    closedJobRepository.ts
    inMemoryClosedJobRepository.ts
    supabaseClient.ts
    supabaseClosedJobRepository.ts
  pipeline/
    weeklyReportPipeline.ts
  whatsapp/
    whatsappClient.ts
    runWhatsappListener.ts
  demo/
    sampleMessages.ts
    runWeeklyReportDemo.ts

supabase/
  schema.sql
  SETUP.md

tests/          (mirrors src/)
```
