# Roadmap

## Completed Phases

| Phase | Description | Status |
|---|---|---|
| 1 | Single-line job message parser (`jobMessageParser.ts`) | Done |
| 2 | Full 3-section WhatsApp message parser (`fullJobMessageParser.ts`) | Done |
| 3 | Weekly report generator (`weeklyReportGenerator.ts`) | Done |
| 4 | WhatsApp-ready report formatter (`reportFormatter.ts`) | Done |
| 5 | Local demo with sample messages (`demo/`) | Done |
| 6 | `ClosedJobRepository` interface + in-memory implementation | Done |
| 7 | End-to-end pipeline service (`weeklyReportPipeline.ts`) | Done |
| 8 | WhatsApp Web listener MVP (`whatsapp/`) | Done |
| 9 | Supabase repository + schema | Done |

---

## Current Phase — Phase 10: Listener → Pipeline Integration

**Goal:** Connect the WhatsApp listener to the processing pipeline so that
incoming messages are parsed and saved to the database automatically.

Tasks:
- Instantiate `SupabaseClosedJobRepository` inside `runWhatsappListener.ts`
  (or a dedicated wiring module)
- Call `processIncomingMessages()` on each received group message
- Log `ProcessResult` (saved, invalid, duplicates) to console
- Handle and surface parse errors without crashing the listener

---

## MVP-Critical Phases (must ship before production use)

### Phase 11: Automated weekly report generation

- Add a cron job that fires on a configured schedule (e.g., Monday morning)
- Calls `generateFormattedWeeklyReports()` for the prior week's date range
- Sends the manager report and per-technician reports via WhatsApp outbound

**Dependency:** requires Phase 10 (data must be in the database first) and
WhatsApp outbound sending capability.

### Phase 12: WhatsApp outbound sending

- Implement a `sendMessage(to: string, text: string)` wrapper around the
  `whatsapp-web.js` client
- Send the manager report to `REPORT_RECIPIENTS` (from env)
- Send each technician's individual report to their WhatsApp number (requires
  technician phone number mapping — either from the closed-job message or a
  config file)

### Phase 13: Deployment hardening

- Process supervisor (`pm2` or equivalent) to keep the listener alive
- Startup health check: verify database connection and WhatsApp session before
  accepting messages
- Graceful shutdown handling
- Basic error alerting (e.g., notify a configured admin number on fatal errors)

---

## Future Ideas (post-MVP, not scheduled)

These are tracked for consideration. None are committed or scoped.

| Idea | Notes |
|---|---|
| Automated Monday report dispatch | Cron-triggered; part of Phase 11 |
| Dashboard (web UI) | Read-only view of weekly stats; requires a separate web server |
| Multi-group support | Listen to multiple WhatsApp groups per deployment; currently single-group only |
| AI-assisted parsing | Fall back to an LLM when the rule-based parser cannot extract fields; sets `needs_review: true` |
| Payout tracking | Track which technicians have been paid; requires a new table and payment state machine |
| PDF report exports | Generate PDF versions of weekly reports for archiving |
| Multi-language support | Parse messages written in languages other than English |
| Partial-parse review queue | Surface messages where `needs_review: true` for manual correction |
| Webhook/REST ingestion endpoint | Alternative to WhatsApp Web for environments where a browser session is impractical |
| Retry queue for failed saves | Re-attempt database writes on transient network errors |

---

## Notes

- The MVP phases (10–13) must be completed in order; each builds on the last.
- Future ideas are separated from MVP scope intentionally. Do not implement
  them until the MVP is running stably in at least one production deployment.
- `needs_review` is already in the schema and types; it is always `false` today
  and is reserved for the AI-assisted parsing and partial-parse review queue ideas.
