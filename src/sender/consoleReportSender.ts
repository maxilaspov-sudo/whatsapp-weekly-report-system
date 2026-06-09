import { ReportSender } from "./reportSender";

const DIVIDER = "─".repeat(44);

/**
 * Console-only implementation of ReportSender.
 *
 * Prints each report to stdout with a header showing the intended recipient.
 * Used until a real WhatsApp outbound sender is wired in Phase 12B.
 * No phone numbers or network access required.
 */
export class ConsoleReportSender implements ReportSender {
  async sendMainReport(reportText: string, recipient: string): Promise<void> {
    console.log(DIVIDER);
    console.log(`[Sender] Main report  →  ${recipient}`);
    console.log(DIVIDER);
    console.log(reportText);
  }

  async sendTechnicianReport(
    reportText: string,
    technicianName: string,
    recipient: string
  ): Promise<void> {
    console.log(DIVIDER);
    console.log(`[Sender] Technician report (${technicianName})  →  ${recipient}`);
    console.log(DIVIDER);
    console.log(reportText);
  }
}
