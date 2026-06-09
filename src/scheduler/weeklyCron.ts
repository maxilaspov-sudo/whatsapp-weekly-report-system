import cron from "node-cron";
import { ClosedJobRepository } from "../db/closedJobRepository";
import { ReportSender } from "../sender/reportSender";
import { runWeeklyReport } from "./runWeeklyReport";

export const WEEKLY_CRON_EXPRESSION = "0 9 * * 1";

/**
 * Runs the weekly report for a specific WhatsApp group and dispatches it
 * through the provided sender.
 *
 * Exported separately from the cron scheduler so it can be tested directly
 * without triggering real scheduling.
 *
 * Error isolation: a failure in any single send does not abort the rest.
 */
export async function executeWeeklyReport(
  repository: ClosedJobRepository,
  sender: ReportSender,
  managerRecipient: string,
  defaultTechRecipient: string,
  now: Date,
  whatsapp_group_id: string
): Promise<void> {
  console.log("[Cron] Report execution started.");

  const result = await runWeeklyReport(repository, now, whatsapp_group_id);

  const weekLabel = `${result.week_start.toDateString()} — ${result.week_end.toDateString()}`;
  console.log(`[Cron] Week range : ${weekLabel}`);

  try {
    await sender.sendMainReport(result.main_report_text, managerRecipient);
    console.log(`[Cron] Main report sent        → ${managerRecipient}`);
  } catch (err) {
    console.error("[Cron] Failed to send main report:", err);
  }

  for (const techReport of result.technician_report_texts) {
    try {
      await sender.sendTechnicianReport(
        techReport.text,
        techReport.technician_name,
        defaultTechRecipient
      );
      console.log(`[Cron] Technician report sent  : ${techReport.technician_name}`);
    } catch (err) {
      console.error(
        `[Cron] Failed to send technician report (${techReport.technician_name}):`,
        err
      );
    }
  }

  console.log("[Cron] Report execution complete.");
}

/**
 * Schedules executeWeeklyReport to run every Monday at 09:00 local server time.
 *
 * Reads MANAGER_REPORT_RECIPIENT, DEFAULT_TECHNICIAN_RECIPIENT, and
 * TARGET_WHATSAPP_GROUP_ID from the environment at startup and captures them
 * in the callback closure.
 * The process must stay alive (e.g. via a supervisor) for the schedule to fire.
 */
export function startWeeklyCron(
  repository: ClosedJobRepository,
  sender: ReportSender
): void {
  const managerRecipient = process.env.MANAGER_REPORT_RECIPIENT?.trim() ?? "";
  const defaultTechRecipient = process.env.DEFAULT_TECHNICIAN_RECIPIENT?.trim() ?? "";
  const targetGroupId = process.env.TARGET_WHATSAPP_GROUP_ID?.trim() ?? "";

  if (!managerRecipient) {
    console.warn(
      "[Cron] MANAGER_REPORT_RECIPIENT is not set — main report will have an empty recipient."
    );
  }
  if (!defaultTechRecipient) {
    console.warn(
      "[Cron] DEFAULT_TECHNICIAN_RECIPIENT is not set — technician reports will have an empty recipient."
    );
  }
  if (!targetGroupId) {
    console.warn(
      "[Cron] TARGET_WHATSAPP_GROUP_ID is not set — reports will be generated with an empty group filter."
    );
  }

  console.log("[Cron] Starting weekly report cron...");
  console.log(`[Cron] Schedule : ${WEEKLY_CRON_EXPRESSION} (every Monday at 09:00 local time)`);
  console.log(`[Cron] Group    : ${targetGroupId || "(not set)"}`);

  cron.schedule(WEEKLY_CRON_EXPRESSION, async (context) => {
    try {
      await executeWeeklyReport(
        repository,
        sender,
        managerRecipient,
        defaultTechRecipient,
        context.date,
        targetGroupId
      );
    } catch (err) {
      console.error("[Cron] Unexpected error during report execution:", err);
    }
  });

  console.log("[Cron] Weekly cron scheduled. Waiting for next Monday at 09:00...");
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv/config");

  const { createSupabaseClient } = await import("../db/supabaseClient");
  const { SupabaseClosedJobRepository } = await import("../db/supabaseClosedJobRepository");
  const { ConsoleReportSender } = await import("../sender/consoleReportSender");

  const repository = new SupabaseClosedJobRepository(createSupabaseClient());
  const sender = new ConsoleReportSender();

  startWeeklyCron(repository, sender);
  console.log("[Cron] Process running. Waiting for scheduled executions...");
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error("[Cron] Fatal startup error:", err);
    process.exit(1);
  });
}
