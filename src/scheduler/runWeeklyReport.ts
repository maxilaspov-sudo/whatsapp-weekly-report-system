import { ClosedJobRepository } from "../db/closedJobRepository";
import {
  generateFormattedWeeklyReports,
  TechnicianReportText,
} from "../pipeline/weeklyReportPipeline";
import { getPreviousWeekRange } from "./weekRange";

export interface WeeklyReportResult {
  week_start: Date;
  week_end: Date;
  main_report_text: string;
  technician_report_texts: TechnicianReportText[];
}

/**
 * Calculates the previous week range relative to `now`, loads all jobs within
 * that range scoped to `whatsapp_group_id`, and returns formatted report text.
 *
 * Does not send messages. Does not read environment variables.
 * The repository and group ID are supplied by the caller.
 */
export async function runWeeklyReport(
  repository: ClosedJobRepository,
  now: Date,
  whatsapp_group_id: string
): Promise<WeeklyReportResult> {
  const { startDate, endDate } = getPreviousWeekRange(now);
  const reports = await generateFormattedWeeklyReports(
    repository,
    startDate,
    endDate,
    whatsapp_group_id
  );

  return {
    week_start: startDate,
    week_end: endDate,
    main_report_text: reports.main_report_text,
    technician_report_texts: reports.technician_report_texts,
  };
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

const DIVIDER = "═".repeat(50);

async function main(): Promise<void> {
  // dotenv loaded here so importing this module in tests has no side effects
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv/config");

  const { createSupabaseClient } = await import("../db/supabaseClient");
  const { SupabaseClosedJobRepository } = await import("../db/supabaseClosedJobRepository");

  const targetGroupId = process.env.TARGET_WHATSAPP_GROUP_ID?.trim() ?? "";
  if (!targetGroupId) {
    console.error("[Report] TARGET_WHATSAPP_GROUP_ID is not set. Exiting.");
    process.exit(1);
  }

  const repository = new SupabaseClosedJobRepository(createSupabaseClient());
  const now = new Date();

  console.log("[Report] Generating weekly report...");
  console.log(`[Report] Group : ${targetGroupId}`);

  const result = await runWeeklyReport(repository, now, targetGroupId);

  const weekLabel = `${result.week_start.toDateString()} — ${result.week_end.toDateString()}`;
  console.log(`[Report] Week : ${weekLabel}`);
  console.log("");
  console.log(DIVIDER);
  console.log(result.main_report_text);
  console.log(DIVIDER);

  if (result.technician_report_texts.length === 0) {
    console.log("[Report] No technician reports for this week.");
    return;
  }

  for (const techReport of result.technician_report_texts) {
    console.log("");
    console.log(DIVIDER);
    console.log(techReport.text);
    console.log(DIVIDER);
  }

  console.log(`\n[Report] Done. ${result.technician_report_texts.length} technician report(s) generated.`);
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error("[Report] Fatal error:", err);
    process.exit(1);
  });
}
