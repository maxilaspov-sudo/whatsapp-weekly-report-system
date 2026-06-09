# Architecture

## Overview

A Node.js/TypeScript backend service that receives WhatsApp messages from one or
more technician groups, parses closed-job reports, persists them to a database,
and generates weekly financial reports. There is no frontend.

The system is a **cloneable template** — each client company gets their own
deployment. A single bot number may serve multiple WhatsApp groups (one per
company), with full isolation between them. No data or state is shared across
groups or deployments.

---

## Data Flow

```
WhatsApp group(s) (inbound messages)
        │
        ▼
  whatsapp-web.js client
  [src/whatsapp/whatsappClient.ts]
        │  emits: message events
        ▼
  WhatsApp listener
  [src/whatsapp/runWhatsappListener.ts]
        │  1. rejects private messages (chat.isGroup guard)
        │  2. looks up group in GROUP_REGISTRY via lookupGroup()
        │  3. if command: checks admin via checkCommandAccess()
        │  4. if job message + active: forwards to pipeline
        ▼
  Pipeline: processIncomingMessages()
  [src/pipeline/weeklyReportPipeline.ts]
        │  parses each message via fullJobMessageParser
        │  saves valid records (with company_id + whatsapp_group_id)
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
          [closed_jobs table — every row scoped by whatsapp_group_id]
                │
                ▼
  Pipeline: generateFormattedWeeklyReports()
  [src/pipeline/weeklyReportPipeline.ts]
        │  findByDateRangeForGroup(start, end, whatsapp_group_id)
        │  → generateWeeklyReport() → formatters
        ▼
  Formatted report text strings
  (manager report + one per technician)
```

---

## Layer Responsibilities

| Layer | Files | Responsibility |
|---|---|---|
| **Ingestion** | `whatsapp/` | Connect to WhatsApp Web, enforce access control, forward messages |
| **Config** | `config/groupRegistry.ts` | Parse `GROUP_REGISTRY` + `GROUP_ADMINS`; return `GroupConfig` |
| **Access control** | `commands/accessControl.ts` | Classify commands as admin/public; decide grant/deny |
| **Commands** | `commands/` | Parse command syntax; execute command logic per group |
| **Parsing** | `parser/` | Convert raw message strings to typed data structures; no I/O |
| **Persistence** | `db/` | Abstract storage behind a repository interface; two implementations |
| **Domain logic** | `reports/` | Aggregate jobs into weekly reports; format output text |
| **Pipeline** | `pipeline/` | Orchestrate parse → save and load → report; no transport knowledge |
| **Scheduler** | `scheduler/` | Weekly report cron, date-range helpers |
| **Sender** | `sender/` | Deliver formatted report text (console or WhatsApp) |
| **Entry points** | `runWhatsappListener.ts`, `runWeeklyReport.ts`, `weeklyCron.ts`, `demo/` | Wire layers; load env; initialize clients |

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
  findByDateRangeForGroup(start, end, whatsapp_group_id): Promise<ClosedJobRecord[]>
  findBySourceMessageId(id): Promise<ClosedJobRecord | null>
  listAll(): Promise<ClosedJobRecord[]>

Implementations:
  InMemoryClosedJobRepository  — Map-backed, synchronous under async API
  SupabaseClosedJobRepository  — PostgREST client; handles UNIQUE violation
                                 as SaveResult rather than throwing
```

`findByDateRangeForGroup` is the only method used by report generation — it
filters by both date range and `whatsapp_group_id`, making cross-group
contamination structurally impossible.

Duplicate prevention is enforced at two levels:
1. The database has a `UNIQUE` constraint on `source_message_id`.
2. `SupabaseClosedJobRepository.save()` catches error code `23505` and returns
   `{ ok: false, error: "DUPLICATE_SOURCE_MESSAGE_ID" }` rather than throwing,
   so the pipeline can log duplicates without aborting the batch.

---

## Multi-Group Isolation

A single deployment can serve multiple WhatsApp groups. Each group is registered
in `GROUP_REGISTRY` (maps group ID → company ID). Every `ClosedJobRecord` stores
both `company_id` and `whatsapp_group_id`. All report queries use
`findByDateRangeForGroup` so a report for Group A never includes jobs from Group B.

The listener maintains one `CommandHandler` per group in a `Map<groupId, CommandHandler>`.
Each handler carries its own independent active/inactive state.

## Multi-Group Access Control

Admin commands (`.start`, `.stop`, `.status`, `.report`) require the sender to
be listed in `GROUP_ADMINS` for that group. The pure function `checkCommandAccess()`
in `src/commands/accessControl.ts` encodes this decision and is fully unit-tested.

Public commands (`.help`, `.format`) are available to any user in a registered group.

Unregistered groups and private messages are always rejected before any command
executes.

## One-Company-Per-Deployment Model

Each deployment is an isolated process with its own:

- WhatsApp session (`.wwebjs_auth/` directory)
- Supabase project and database
- `.env` file with all credentials and identifiers
- Group and admin configuration (`GROUP_REGISTRY`, `GROUP_ADMINS`)

Nothing is shared between deployments. There are no multi-tenant concepts,
shared databases, or centralized authentication.

**Consequence for the codebase:** no company name, technician name, group ID,
phone number, or credential may appear in source code. Every such value must
come from an environment variable. This rule is what makes the template
cloneable — clone the repo, fill in `.env`, and the system runs for a new
company.

---

---

## Directory Structure

```
src/
  config/
    groupRegistry.ts             GROUP_REGISTRY + GROUP_ADMINS parsing; GroupConfig type
  commands/
    commandParser.ts             Parse ".command args" syntax
    commandHandler.ts            Execute commands; per-group active/inactive state
    accessControl.ts             Admin vs public command classification; checkCommandAccess()
  parser/
    jobMessageParser.ts          Single-line closing parser ("John $250 check")
    fullJobMessageParser.ts      Full 3-section WhatsApp message parser
  reports/
    weeklyReportGenerator.ts     Aggregate ParsedFullJobMessage[] → WeeklyReport
    reportFormatter.ts           Format WeeklyReport → WhatsApp-ready text
  db/
    types.ts                     ClosedJobRecord, NewClosedJob, SaveResult
    closedJobRepository.ts       ClosedJobRepository interface
    inMemoryClosedJobRepository.ts  In-memory impl (tests and demos)
    supabaseClient.ts            createSupabaseClient() factory
    supabaseClosedJobRepository.ts  Supabase/PostgreSQL impl
  pipeline/
    weeklyReportPipeline.ts      processIncomingMessages() + generateFormattedWeeklyReports()
  scheduler/
    weekRange.ts                 getPreviousWeekRange()
    runWeeklyReport.ts           runWeeklyReport() — date-range → formatted result
    weeklyCron.ts                startWeeklyCron() + executeWeeklyReport()
  sender/
    reportSender.ts              ReportSender interface
    consoleReportSender.ts       Console implementation
  whatsapp/
    whatsappClient.ts            createWhatsAppClient() — QR, auth, events
    runWhatsappListener.ts       Entry point: multi-group listener with access control
  demo/
    sampleMessages.ts            Hard-coded sample messages for local demo
    runWeeklyReportDemo.ts       End-to-end demo using in-memory repo

supabase/
  schema.sql                     CREATE TABLE closed_jobs (run once in Supabase SQL Editor)
  SETUP.md                       Supabase setup instructions

tests/                           Mirrors src/ structure; jest + ts-jest
```
