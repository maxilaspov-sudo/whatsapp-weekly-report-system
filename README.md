# WhatsApp Weekly Report System

A TypeScript backend that listens to a WhatsApp group where technicians post
closed-job messages, parses them, stores them in a database, and generates
weekly financial reports broken down by technician and payment method.

## What this is

A **WhatsApp closed-jobs financial reporting system** for field-service companies.

- Technicians post a structured message to a WhatsApp group when they close a job.
- The system captures those messages, parses the amount and payment method, and
  stores them.
- At the end of the week, it generates a summary report for management and
  individual reports for each technician.

## What this is NOT

- Not a CRM or lead management system
- Not a customer-facing application
- Not connected to n8n — all automation is plain Node.js code

## Deployment model

This project is a **cloneable template**. Each company gets their own deployment
with their own WhatsApp number, WhatsApp group, database, and credentials.
Nothing company-specific is hard-coded. All values come from `.env`.

---

## Architecture

```
src/
├── parser/
│   ├── jobMessageParser.ts          Parses the single closing line: "John $250 check"
│   └── fullJobMessageParser.ts      Parses the full 3-section WhatsApp job message
│
├── reports/
│   ├── weeklyReportGenerator.ts     Aggregates jobs into a WeeklyReport
│   └── reportFormatter.ts           Formats reports as WhatsApp-ready text
│
├── db/
│   ├── types.ts                     Core types: ClosedJobRecord, SaveResult
│   ├── closedJobRepository.ts       Repository interface (async, injectable)
│   ├── inMemoryClosedJobRepository.ts  In-memory impl for tests and demos
│   ├── supabaseClient.ts            Supabase client factory
│   └── supabaseClosedJobRepository.ts  Production Supabase/PostgreSQL impl
│
├── pipeline/
│   └── weeklyReportPipeline.ts      Orchestrates parse → save → report
│
├── whatsapp/
│   ├── whatsappClient.ts            WhatsApp Web client setup (QR, events)
│   └── runWhatsappListener.ts       Entry point for the group listener
│
└── demo/
    ├── sampleMessages.ts            Sample messages for local testing
    └── runWeeklyReportDemo.ts       End-to-end demo (in-memory, no DB)

supabase/
├── schema.sql                       Database schema (run once in Supabase)
└── SETUP.md                         Supabase-specific setup steps
```

### Message format

Technicians post a message structured in three sections separated by blank lines:

```
Example Service Company

Name: Demo Customer
Phone: (555) 000-0000
Address: 123 Demo Street, Demo City, FL 00000
Job type: Dryer vent cleaning
Appointment Tuesday 02/06 @ 9am - 11am

DemoTech $250 check
```

The parser extracts: company, customer info, and the closing line (technician +
amount + payment method). Supported payment aliases include `check`, `cc`,
`cash`, `zelle`, `venmo`, `ach`, `wire`, and others.

### Pipeline flow

```
WhatsApp group message
        │
        ▼
processIncomingMessages()
  ├── parse with fullJobMessageParser
  ├── save valid jobs to ClosedJobRepository
  ├── collect invalid messages (parse failures)
  └── collect duplicates (same source_message_id)
        │
        ▼
generateFormattedWeeklyReports()
  ├── load records by date range from repository
  ├── generateWeeklyReport()  → WeeklyReport
  ├── formatMainWeeklyReport()  → main report text
  └── formatTechnicianReport()  → one text per technician
```

### Repository interface

Both `InMemoryClosedJobRepository` (tests/demo) and
`SupabaseClosedJobRepository` (production) implement the same
`ClosedJobRepository` interface. The pipeline receives the repository as an
injected dependency — it never instantiates one itself.

---

## Completed phases

| Phase | Description |
|---|---|
| 1 | Single-line job message parser |
| 2 | Full 3-section WhatsApp message parser |
| 3 | Weekly report generator (totals, technician breakdown, payment breakdown) |
| 4 | WhatsApp-ready report formatter |
| 5 | Local demo with sample messages |
| 6 | `ClosedJobRepository` interface and in-memory implementation |
| 7 | End-to-end pipeline service |
| 8 | WhatsApp Web listener MVP (QR scan, group filter, console output) |
| 9 | Supabase repository and database schema |

---

## npm scripts

| Script | Description |
|---|---|
| `npm test` | Run all tests (Jest + ts-jest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run demo:weekly-report` | Run the local demo (no DB, no WhatsApp needed) |
| `npm run whatsapp:listen` | Start the WhatsApp group listener |

---

## Development workflow

### Run the demo (no setup needed)

```bash
npm install
npm run demo:weekly-report
```

### Run all tests

```bash
npm test
```

### Check types

```bash
npx tsc --noEmit
```

### Start the WhatsApp listener

1. Complete the setup steps in [SETUP.md](SETUP.md).
2. Run:
   ```bash
   npm run whatsapp:listen
   ```
3. Scan the QR code with the WhatsApp phone.
4. On the next run, the session is restored automatically — no QR needed.

---

## Security

| File / directory | Rule |
|---|---|
| `.env` | Never commit. Contains all secrets. |
| `.wwebjs_auth/` | Never commit. Contains the WhatsApp session. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only. Bypasses Row Level Security. |

All three are listed in `.gitignore`.
