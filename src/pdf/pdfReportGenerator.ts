import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import {
  WeeklyReport,
  TechnicianReport,
  PaymentBreakdown,
  generateWeeklyReport,
} from "../reports/weeklyReportGenerator";
import { ParsedFullJobMessage, parseFullJobMessage } from "../parser/fullJobMessageParser";
import { SAMPLE_MESSAGES } from "../demo/sampleMessages";

export interface PdfOptions {
  /** Directory to write the PDF into. Defaults to <cwd>/reports. */
  outputDir?: string;
  /** Disable zlib compression on content streams. Useful for tests. Defaults to true. */
  compress?: boolean;
}

// ─── Filename ─────────────────────────────────────────────────────────────────

export function buildFilename(weekStart: Date, weekEnd: Date): string {
  return `weekly_report_${toIsoDate(weekStart)}_to_${toIsoDate(weekEnd)}.pdf`;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ─── Currency ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── Render helpers ───────────────────────────────────────────────────────────

type Doc = PDFKit.PDFDocument;

function sectionTitle(doc: Doc, title: string): void {
  doc.moveDown(0.6);
  doc.fontSize(13).font("Helvetica-Bold").text(title);
  doc.fontSize(11).font("Helvetica");
}

function renderSummary(doc: Doc, report: WeeklyReport, weekStart: Date, weekEnd: Date): void {
  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("WEEKLY CLOSED JOBS REPORT", { align: "center" });
  doc
    .fontSize(11)
    .font("Helvetica")
    .text(`Week: ${toIsoDate(weekStart)} — ${toIsoDate(weekEnd)}`, { align: "center" });
  doc.moveDown();

  sectionTitle(doc, "SUMMARY");
  doc.text(`Total Jobs: ${report.total_jobs}`);
  doc.text(`Total Gross: ${formatCurrency(report.total_gross_amount)}`);
}

function renderTechnicianBreakdown(doc: Doc, breakdown: TechnicianReport[]): void {
  sectionTitle(doc, "TECHNICIAN BREAKDOWN");

  if (breakdown.length === 0) {
    doc.text("No technicians this week.");
    return;
  }

  for (const tech of breakdown) {
    const label = tech.total_jobs === 1 ? "job" : "jobs";
    doc.font("Helvetica-Bold").text(tech.technician_name);
    doc.font("Helvetica").text(`  ${tech.total_jobs} ${label}  |  ${formatCurrency(tech.total_amount)}`);
    for (const [method, amount] of Object.entries(tech.payment_method_breakdown)) {
      doc.text(`    ${method}: ${formatCurrency(amount)}`);
    }
  }
}

function renderPaymentBreakdown(doc: Doc, breakdown: PaymentBreakdown): void {
  sectionTitle(doc, "PAYMENT METHODS");

  const entries = Object.entries(breakdown);
  if (entries.length === 0) {
    doc.text("No payments recorded.");
    return;
  }

  for (const [method, amount] of entries) {
    doc.text(`${method}: ${formatCurrency(amount)}`);
  }
}

function renderAllJobs(doc: Doc, jobs: ParsedFullJobMessage[]): void {
  sectionTitle(doc, "ALL JOBS");

  if (jobs.length === 0) {
    doc.text("No jobs this week.");
    return;
  }

  jobs.forEach((job, i) => {
    doc.text(
      `${i + 1}.  ${job.technician_name}  |  ${formatCurrency(job.closed_amount)}  |  ${job.payment_method}  |  ${job.customer_name}`
    );
  });
}

function renderDocument(
  doc: Doc,
  report: WeeklyReport,
  weekStart: Date,
  weekEnd: Date
): void {
  renderSummary(doc, report, weekStart, weekEnd);
  renderTechnicianBreakdown(doc, report.technician_breakdown);
  renderPaymentBreakdown(doc, report.payment_method_breakdown);
  renderAllJobs(doc, report.all_jobs);
}

// ─── Write PDF ────────────────────────────────────────────────────────────────

async function writePdf(
  report: WeeklyReport,
  weekStart: Date,
  weekEnd: Date,
  outputPath: string,
  compress: boolean
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ compress });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);
    renderDocument(doc, report, weekStart, weekEnd);
    doc.end();

    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a weekly report PDF and writes it to disk.
 *
 * Creates the output directory if it does not exist.
 * Returns the absolute path to the generated file.
 *
 * Filename format: weekly_report_YYYY-MM-DD_to_YYYY-MM-DD.pdf
 */
export async function generateWeeklyReportPdf(
  report: WeeklyReport,
  weekStart: Date,
  weekEnd: Date,
  options: PdfOptions = {}
): Promise<string> {
  const outputDir = options.outputDir ?? path.join(process.cwd(), "reports");
  const compress = options.compress ?? true;

  fs.mkdirSync(outputDir, { recursive: true });

  const filename = buildFilename(weekStart, weekEnd);
  const outputPath = path.join(outputDir, filename);

  await writePdf(report, weekStart, weekEnd, outputPath, compress);
  return outputPath;
}

// ─── Demo entry point ─────────────────────────────────────────────────────────

if (require.main === module) {
  runDemo().catch((err: unknown) => {
    console.error("Demo failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

async function runDemo(): Promise<void> {
  const jobs = SAMPLE_MESSAGES.flatMap((raw) => {
    const result = parseFullJobMessage(raw);
    return result.ok ? [result.data] : [];
  });

  const report = generateWeeklyReport(jobs);

  const weekStart = new Date("2024-02-05");
  const weekEnd = new Date("2024-02-11");

  const outputPath = await generateWeeklyReportPdf(report, weekStart, weekEnd);

  console.log(`PDF generated : ${outputPath}`);
  console.log(`Total jobs    : ${report.total_jobs}`);
  console.log(`Total gross   : ${formatCurrency(report.total_gross_amount)}`);
}
