import path from "path";
import fs from "fs";
import os from "os";
import {
  generateWeeklyReportPdf,
  buildFilename,
} from "../../src/pdf/pdfReportGenerator";
import { generateWeeklyReport, WeeklyReport } from "../../src/reports/weeklyReportGenerator";
import { ParsedFullJobMessage } from "../../src/parser/fullJobMessageParser";

// ─── Demo data (no real PII) ──────────────────────────────────────────────────

function makeJob(overrides: Partial<ParsedFullJobMessage> = {}): ParsedFullJobMessage {
  return {
    company_name: "Example Service Company",
    customer_name: "Demo Customer",
    phone: "(555) 000-0000",
    address: "123 Demo Street, Demo City, FL 00000",
    service: "Dryer vent cleaning",
    appointment: "Tuesday 02/06 @ 9am",
    technician_name: "DemoTech",
    closed_amount: 250,
    payment_method: "Check",
    raw_message: "demo raw message",
    ...overrides,
  };
}

function makeReport(jobs: ParsedFullJobMessage[]): WeeklyReport {
  return generateWeeklyReport(jobs);
}

const WEEK_START = new Date("2024-01-08");
const WEEK_END = new Date("2024-01-14");

// ─── PDF text extraction ──────────────────────────────────────────────────────
// PDFKit encodes text as hex inside TJ array operations even when compression
// is disabled. This helper decodes all TJ hex segments and concatenates them
// so test assertions can search for readable substrings.

function extractPdfText(filePath: string): string {
  const raw = fs.readFileSync(filePath).toString("latin1");
  const chunks: string[] = [];
  for (const tjMatch of raw.matchAll(/\[([^\]]+)\]\s*TJ/g)) {
    for (const hexMatch of tjMatch[1].matchAll(/<([0-9a-fA-F]+)>/g)) {
      chunks.push(Buffer.from(hexMatch[1], "hex").toString("latin1"));
    }
  }
  return chunks.join("");
}

// ─── Temp directory setup ─────────────────────────────────────────────────────

let tmpDir: string;

beforeAll(() => {
  tmpDir = path.join(os.tmpdir(), `pdf-test-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── buildFilename ────────────────────────────────────────────────────────────

describe("buildFilename", () => {
  test("formats dates as weekly_report_YYYY-MM-DD_to_YYYY-MM-DD.pdf", () => {
    expect(buildFilename(WEEK_START, WEEK_END)).toBe(
      "weekly_report_2024-01-08_to_2024-01-14.pdf"
    );
  });

  test("ends with .pdf", () => {
    expect(buildFilename(WEEK_START, WEEK_END).endsWith(".pdf")).toBe(true);
  });

  test("starts with weekly_report_", () => {
    expect(buildFilename(WEEK_START, WEEK_END).startsWith("weekly_report_")).toBe(true);
  });

  test("uses start date as first date segment", () => {
    expect(buildFilename(new Date("2025-03-10"), new Date("2025-03-16"))).toContain("2025-03-10");
  });

  test("uses end date as second date segment", () => {
    expect(buildFilename(new Date("2025-03-10"), new Date("2025-03-16"))).toContain("2025-03-16");
  });
});

// ─── generateWeeklyReportPdf — file creation ──────────────────────────────────

describe("generateWeeklyReportPdf — file creation", () => {
  test("creates a PDF file at the returned path", async () => {
    const filePath = await generateWeeklyReportPdf(makeReport([makeJob()]), WEEK_START, WEEK_END, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test("filename matches the correct format", async () => {
    const filePath = await generateWeeklyReportPdf(makeReport([makeJob()]), WEEK_START, WEEK_END, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(path.basename(filePath)).toBe("weekly_report_2024-01-08_to_2024-01-14.pdf");
  });

  test("filename reflects provided week dates", async () => {
    const start = new Date("2024-03-04");
    const end = new Date("2024-03-10");
    const filePath = await generateWeeklyReportPdf(makeReport([makeJob()]), start, end, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(path.basename(filePath)).toBe("weekly_report_2024-03-04_to_2024-03-10.pdf");
  });

  test("creates the output directory if it does not exist", async () => {
    const nestedDir = path.join(tmpDir, "nested", "auto-created");
    const filePath = await generateWeeklyReportPdf(makeReport([makeJob()]), WEEK_START, WEEK_END, {
      outputDir: nestedDir,
      compress: false,
    });
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test("returns an absolute path", async () => {
    const filePath = await generateWeeklyReportPdf(makeReport([makeJob()]), WEEK_START, WEEK_END, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(path.isAbsolute(filePath)).toBe(true);
  });
});

// ─── generateWeeklyReportPdf — empty report ───────────────────────────────────

describe("generateWeeklyReportPdf — empty report", () => {
  test("empty report still generates a PDF file", async () => {
    const filePath = await generateWeeklyReportPdf(makeReport([]), WEEK_START, WEEK_END, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test("empty report PDF has non-zero file size", async () => {
    const filePath = await generateWeeklyReportPdf(makeReport([]), WEEK_START, WEEK_END, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(fs.statSync(filePath).size).toBeGreaterThan(0);
  });
});

// ─── generateWeeklyReportPdf — content ───────────────────────────────────────

describe("generateWeeklyReportPdf — content", () => {
  test("PDF contains Total Jobs section header", async () => {
    const filePath = await generateWeeklyReportPdf(makeReport([makeJob()]), WEEK_START, WEEK_END, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(extractPdfText(filePath)).toContain("Total Jobs:");
  });

  test("PDF contains Total Gross section header", async () => {
    const filePath = await generateWeeklyReportPdf(makeReport([makeJob()]), WEEK_START, WEEK_END, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(extractPdfText(filePath)).toContain("Total Gross:");
  });

  test("PDF contains the correct total jobs count", async () => {
    const report = makeReport([makeJob(), makeJob({ payment_method: "Cash" })]);
    expect(report.total_jobs).toBe(2);
    const filePath = await generateWeeklyReportPdf(report, WEEK_START, WEEK_END, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(extractPdfText(filePath)).toContain("Total Jobs: 2");
  });

  test("PDF contains the total gross amount value", async () => {
    const report = makeReport([
      makeJob({ closed_amount: 250 }),
      makeJob({ closed_amount: 150, payment_method: "Cash" }),
    ]);
    // $250 + $150 = $400.00
    const filePath = await generateWeeklyReportPdf(report, WEEK_START, WEEK_END, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(extractPdfText(filePath)).toContain("400.00");
  });

  test("PDF includes technician name", async () => {
    const report = makeReport([makeJob({ technician_name: "UniqueDemoXYZ" })]);
    const filePath = await generateWeeklyReportPdf(report, WEEK_START, WEEK_END, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(extractPdfText(filePath)).toContain("UniqueDemoXYZ");
  });

  test("PDF includes week start date", async () => {
    const filePath = await generateWeeklyReportPdf(makeReport([makeJob()]), WEEK_START, WEEK_END, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(extractPdfText(filePath)).toContain("2024-01-08");
  });

  test("PDF includes week end date", async () => {
    const filePath = await generateWeeklyReportPdf(makeReport([makeJob()]), WEEK_START, WEEK_END, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(extractPdfText(filePath)).toContain("2024-01-14");
  });

  test("empty report PDF contains no-jobs placeholder", async () => {
    const filePath = await generateWeeklyReportPdf(makeReport([]), WEEK_START, WEEK_END, {
      outputDir: tmpDir,
      compress: false,
    });
    expect(extractPdfText(filePath)).toContain("No jobs this week.");
  });
});
