import { WeeklyReport, TechnicianReport, PaymentBreakdown } from "./weeklyReportGenerator";
import { ParsedFullJobMessage } from "../parser/fullJobMessageParser";

const DIVIDER = "----------------------------";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPaymentBreakdown(breakdown: PaymentBreakdown): string {
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return "  No payments recorded.";
  return entries.map(([method, amount]) => `  ${method}: ${formatCurrency(amount)}`).join("\n");
}

function formatMainJobLine(index: number, job: ParsedFullJobMessage): string {
  return `${index + 1}. ${job.technician_name} | ${formatCurrency(job.closed_amount)} | ${job.payment_method} | ${job.customer_name}`;
}

function formatTechJobLine(index: number, job: ParsedFullJobMessage): string {
  return `${index + 1}. ${formatCurrency(job.closed_amount)} | ${job.payment_method} | ${job.customer_name}`;
}

/**
 * Formats a WeeklyReport into a WhatsApp-ready text message for the manager.
 */
export function formatMainWeeklyReport(report: WeeklyReport): string {
  const lines: string[] = [
    "WEEKLY CLOSED JOBS REPORT",
    DIVIDER,
    `Total Jobs: ${report.total_jobs}`,
    `Total Gross: ${formatCurrency(report.total_gross_amount)}`,
    "",
    "TECHNICIAN BREAKDOWN",
    DIVIDER,
  ];

  if (report.technician_breakdown.length === 0) {
    lines.push("  No technicians this week.");
  } else {
    for (const tech of report.technician_breakdown) {
      const label = tech.total_jobs === 1 ? "job" : "jobs";
      lines.push(`  ${tech.technician_name}: ${tech.total_jobs} ${label} | ${formatCurrency(tech.total_amount)}`);
    }
  }

  lines.push(
    "",
    "PAYMENT METHODS",
    DIVIDER,
    formatPaymentBreakdown(report.payment_method_breakdown),
    "",
    "ALL JOBS",
    DIVIDER,
  );

  if (report.all_jobs.length === 0) {
    lines.push("  No jobs this week.");
  } else {
    report.all_jobs.forEach((job, i) => lines.push(formatMainJobLine(i, job)));
  }

  return lines.join("\n");
}

/**
 * Formats a TechnicianReport into a WhatsApp-ready text message for one technician.
 */
export function formatTechnicianReport(report: TechnicianReport): string {
  const lines: string[] = [
    "TECHNICIAN WEEKLY REPORT",
    DIVIDER,
    `Technician: ${report.technician_name}`,
    `Total Jobs: ${report.total_jobs}`,
    `Total Amount: ${formatCurrency(report.total_amount)}`,
    "",
    "PAYMENT METHODS",
    DIVIDER,
    formatPaymentBreakdown(report.payment_method_breakdown),
    "",
    "JOBS",
    DIVIDER,
  ];

  if (report.jobs.length === 0) {
    lines.push("  No jobs this week.");
  } else {
    report.jobs.forEach((job, i) => lines.push(formatTechJobLine(i, job)));
  }

  return lines.join("\n");
}
