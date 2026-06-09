import path from "path";
import WAWebJS from "whatsapp-web.js";
import { ReportSender } from "../sender/reportSender";
import { ClosedJobRepository } from "../db/closedJobRepository";
import { ClosedJobRecord } from "../db/types";
import { ParsedFullJobMessage } from "../parser/fullJobMessageParser";
import { generateWeeklyReport, WeeklyReport } from "../reports/weeklyReportGenerator";
import { formatMainWeeklyReport } from "../reports/reportFormatter";
import { generateWeeklyReportPdf, PdfOptions } from "../pdf/pdfReportGenerator";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfReportSender {
  sendReportWithPdf(
    chatId: string,
    repository: ClosedJobRepository,
    weekStart: Date,
    weekEnd: Date
  ): Promise<void>;
}

// Injected in tests to avoid real file-system PDF generation during unit tests.
type PdfGeneratorFn = (
  report: WeeklyReport,
  weekStart: Date,
  weekEnd: Date,
  options?: PdfOptions
) => Promise<string>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recordToMessage(record: ClosedJobRecord): ParsedFullJobMessage {
  return {
    company_name: record.company_name,
    customer_name: record.customer_name,
    phone: record.phone,
    address: record.address,
    service: record.service,
    appointment: record.appointment,
    technician_name: record.technician_name,
    closed_amount: record.closed_amount,
    payment_method: record.payment_method,
    raw_message: record.raw_message,
  };
}

// ─── WhatsAppReportSender ─────────────────────────────────────────────────────

export class WhatsAppReportSender implements ReportSender, PdfReportSender {
  private readonly pdfOutputDir: string;
  private readonly pdfGenerator: PdfGeneratorFn;

  constructor(
    private readonly client: WAWebJS.Client,
    pdfOutputDir?: string,
    pdfGenerator?: PdfGeneratorFn
  ) {
    this.pdfOutputDir = pdfOutputDir ?? path.join(process.cwd(), "reports");
    this.pdfGenerator = pdfGenerator ?? generateWeeklyReportPdf;
  }

  // ─── ReportSender (scheduled cron delivery) ──────────────────────────────

  async sendMainReport(reportText: string, recipient: string): Promise<void> {
    console.log(`[Sender] Main report → ${recipient}`);
    await this.client.sendMessage(recipient, reportText);
  }

  async sendTechnicianReport(
    reportText: string,
    technicianName: string,
    recipient: string
  ): Promise<void> {
    console.log(`[Sender] Technician report (${technicianName}) → ${recipient}`);
    await this.client.sendMessage(recipient, reportText);
  }

  // ─── PdfReportSender (.report command) ───────────────────────────────────

  async sendReportWithPdf(
    chatId: string,
    repository: ClosedJobRepository,
    weekStart: Date,
    weekEnd: Date
  ): Promise<void> {
    // Group-scoped query — enforces group isolation
    const records = await repository.findByDateRangeForGroup(weekStart, weekEnd, chatId);
    const jobs = records.map(recordToMessage);
    const weeklyReport = generateWeeklyReport(jobs);
    const mainReportText = formatMainWeeklyReport(weeklyReport);
    const weekLabel = `${weekStart.toDateString()} — ${weekEnd.toDateString()}`;
    const summaryText = `Week: ${weekLabel}\n\n${mainReportText}`;

    let pdfPath: string;
    try {
      pdfPath = await this.pdfGenerator(weeklyReport, weekStart, weekEnd, {
        outputDir: this.pdfOutputDir,
      });
      console.log(`[PDF] Generated: ${path.basename(pdfPath)}`);
    } catch (err) {
      console.error("[PDF] Generation failed:", err instanceof Error ? err.message : err);
      throw new Error("Failed to generate report PDF.");
    }

    // Summary text is best-effort — a failure here must not block the PDF send
    try {
      await this.client.sendMessage(chatId, summaryText);
    } catch (err) {
      console.error("[PDF] Summary send failed:", err instanceof Error ? err.message : err);
    }

    try {
      const media = WAWebJS.MessageMedia.fromFilePath(pdfPath);
      await this.client.sendMessage(chatId, media);
      console.log(`[PDF] Sent to: ${chatId}`);
    } catch (err) {
      console.error("[PDF] Send failed:", err instanceof Error ? err.message : err);
      throw new Error("Failed to send report.");
    }
  }
}
