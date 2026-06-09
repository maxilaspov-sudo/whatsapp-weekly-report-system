import { ParsedCommand, SUPPORTED_COMMANDS } from "./commandParser";
import { ClosedJobRepository } from "../db/closedJobRepository";
import { runWeeklyReport } from "../scheduler/runWeeklyReport";

export interface CommandContext {
  repository: ClosedJobRepository;
  repositoryType: string;
  getNow: () => Date;
}

const HELP_TEXT = [
  "Available commands:",
  "",
  ".help    — show this message",
  ".start   — activate job message processing",
  ".stop    — deactivate job message processing",
  ".status  — show system status",
  ".format  — show expected closed-job message format",
  ".report  — generate the previous week's report",
].join("\n");

function buildFormatExample(): string {
  const company = process.env.COMPANY_NAME?.trim() || "[Company Name]";
  return [
    "Expected closed-job message format:",
    "",
    company,
    "",
    "Name: Customer Name",
    "Phone: (555) 000-0000",
    "Address: 123 Main St",
    "Job type: Service Type",
    "Appointment Monday 01/01 @ 10am",
    "",
    "Technician $Amount PaymentMethod",
    "",
    "Examples:",
    "  John $250 check",
    "  Mike 700 cc",
    "  Sara 150 cash",
  ].join("\n");
}

/**
 * Handles bot commands and maintains in-memory processing state.
 *
 * State is not persisted — a process restart resets `active` to false.
 * The context is injected so the handler can be tested without WhatsApp.
 */
export class CommandHandler {
  private _active = false;

  constructor(private readonly context: CommandContext) {}

  isActive(): boolean {
    return this._active;
  }

  async handle(parsed: ParsedCommand): Promise<string> {
    switch (parsed.command) {
      case "help":
        return HELP_TEXT;

      case "start":
        if (this._active) return "Processing is already active.";
        this._active = true;
        return "Processing activated. Incoming job messages will now be saved.";

      case "stop":
        if (!this._active) return "Processing is already inactive.";
        this._active = false;
        return "Processing deactivated. Incoming job messages will be ignored.";

      case "status":
        return [
          `Status      : ${this._active ? "active" : "inactive"}`,
          `Cron        : scheduled (Monday 09:00)`,
          `Repository  : ${this.context.repositoryType}`,
        ].join("\n");

      case "format":
        return buildFormatExample();

      case "report":
        return this.handleReport();

      default:
        return [
          `Unknown command: .${parsed.command}`,
          "Type .help to see available commands.",
        ].join("\n");
    }
  }

  private async handleReport(): Promise<string> {
    try {
      const now = this.context.getNow();
      const result = await runWeeklyReport(this.context.repository, now);
      const weekLabel = `${result.week_start.toDateString()} — ${result.week_end.toDateString()}`;
      return [`Week: ${weekLabel}`, "", result.main_report_text].join("\n");
    } catch (err) {
      console.error("[Command] .report failed:", err);
      return "Report generation failed. Please try again.";
    }
  }
}

export { SUPPORTED_COMMANDS };
