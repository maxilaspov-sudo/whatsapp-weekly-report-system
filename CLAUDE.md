# Claude Code — Project Context

## What this system is

A **WhatsApp weekly closed-jobs financial reporting system**.

The system listens to a configured WhatsApp group, parses incoming closed-job
messages posted by technicians, stores them in a database, and generates
weekly financial reports broken down by technician and payment method.

## What this system is NOT

- Not a CRM
- Not a lead management system
- Not a customer-facing product
- Not a scheduling tool
- Not n8n — all automation is Node.js code and cron jobs

## Product model

This project is a **cloneable template**. Each client company gets their own
deployment with their own WhatsApp number, group, database, and credentials.

**Consequence: nothing company-specific may appear in code.**  
All company names, technician names, group IDs, phone numbers, and credentials
must come from environment variables or a settings file. Never hard-code them.

## Core constraints

- No n8n. All automation is built in Node.js/TypeScript.
- No hardcoded company names, technician names, group names, phone numbers, or credentials.
- Always preserve the original raw WhatsApp message in the database.
- The service-role Supabase key must never be exposed to client-side code.
- `.env` and `.wwebjs_auth/` must never be committed to git.
- TypeScript strict mode. No `any` types in production source files.

---

## Architecture

```
src/
  parser/
    jobMessageParser.ts          Single-line closing parser ("John $250 check")
    fullJobMessageParser.ts      Full 3-section WhatsApp message parser

  reports/
    weeklyReportGenerator.ts     Aggregates ParsedFullJobMessage[] → WeeklyReport
    reportFormatter.ts           Formats WeeklyReport → WhatsApp-ready text

  db/
    types.ts                     ClosedJobRecord, NewClosedJob, SaveResult
    closedJobRepository.ts       ClosedJobRepository interface (async)
    inMemoryClosedJobRepository.ts  In-memory impl (tests and demos)
    supabaseClient.ts            createSupabaseClient() factory
    supabaseClosedJobRepository.ts  Supabase/PostgreSQL impl

  pipeline/
    weeklyReportPipeline.ts      processIncomingMessages() + generateFormattedWeeklyReports()

  whatsapp/
    whatsappClient.ts            createWhatsAppClient() — QR, auth, events
    runWhatsappListener.ts       Entry point: loads .env, listens, prints to console

  demo/
    sampleMessages.ts            Hard-coded sample messages for local demo
    runWeeklyReportDemo.ts       End-to-end demo using in-memory repo

supabase/
  schema.sql                     CREATE TABLE closed_jobs (run once in Supabase SQL Editor)
  SETUP.md                       Supabase-specific setup instructions

tests/                           Mirrors src/ structure; jest + ts-jest
```

## Key types

```typescript
// ClosedJobRecord — one saved job in the database
interface ClosedJobRecord {
  id: string;
  raw_message: string;
  company_name: string; customer_name: string; phone: string;
  address: string; service: string; appointment: string;
  technician_name: string; closed_amount: number; payment_method: string;
  created_at: Date; source_message_id: string; needs_review: boolean;
}

// SaveResult — return value of ClosedJobRepository.save()
type SaveResult =
  | { ok: true; record: ClosedJobRecord }
  | { ok: false; error: "DUPLICATE_SOURCE_MESSAGE_ID" };

// ClosedJobRepository — the shared interface; both implementations satisfy it
interface ClosedJobRepository {
  save(job: NewClosedJob): Promise<SaveResult>;
  findByDateRange(start: Date, end: Date): Promise<ClosedJobRecord[]>;
  findBySourceMessageId(id: string): Promise<ClosedJobRecord | null>;
  listAll(): Promise<ClosedJobRecord[]>;
}
```

## Pipeline functions

```typescript
// Parses raw messages, saves valid ones, returns summary with invalid/duplicate lists
processIncomingMessages(messages: IncomingMessage[], repository: ClosedJobRepository): Promise<ProcessResult>

// Loads records by date range, generates and formats weekly reports
generateFormattedWeeklyReports(repository, startDate, endDate): Promise<FormattedWeeklyReports>
```

## Environment variables

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (backend only) |
| `TARGET_WHATSAPP_GROUP_ID` | Exact group ID filter for the listener |
| `TARGET_WHATSAPP_GROUP_NAME` | Name substring filter (fallback to ID) |
| `COMPANY_NAME` | Display name for reports |
| `WHATSAPP_PHONE_NUMBER` | The connected WhatsApp number |
| `REPORT_RECIPIENTS` | Who receives generated reports |

## Completed phases

1. Single-line job message parser (`jobMessageParser.ts`)
2. Full 3-section WhatsApp message parser (`fullJobMessageParser.ts`)
3. Weekly report generator (`weeklyReportGenerator.ts`)
4. WhatsApp-ready report formatter (`reportFormatter.ts`)
5. Local demo with sample messages (`demo/`)
6. `ClosedJobRepository` interface + in-memory implementation
7. End-to-end pipeline service (`weeklyReportPipeline.ts`)
8. WhatsApp Web listener MVP (`whatsapp/`)
9. Supabase repository + schema (`supabaseClosedJobRepository.ts`, `supabase/schema.sql`)

## Development rules

- Add tests for every new module. Test files mirror `src/` under `tests/`.
- Repository must always be dependency-injected — never instantiated inside business logic.
- The WhatsApp listener and pipeline are intentionally decoupled; wire them together in a future phase.
- When adding new payment method aliases, add them to `PAYMENT_METHOD_MAP` in `jobMessageParser.ts`.
- When adding new message label aliases, add them to `LABEL_TO_FIELD` in `fullJobMessageParser.ts`.
- `needs_review` is reserved for partial parses that need human inspection; it is always `false` in the current pipeline.
