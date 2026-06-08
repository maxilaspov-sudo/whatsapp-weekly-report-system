import { generateWeeklyReport, TechnicianReport } from "../../src/reports/weeklyReportGenerator";
import {
  formatMainWeeklyReport,
  formatTechnicianReport,
} from "../../src/reports/reportFormatter";
import { ParsedFullJobMessage } from "../../src/parser/fullJobMessageParser";

// ─── factory ─────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<ParsedFullJobMessage> = {}): ParsedFullJobMessage {
  return {
    company_name: "Test Company",
    customer_name: "Test Customer",
    phone: "555-0000",
    address: "1 Test St",
    service: "Test Service",
    appointment: "Monday",
    technician_name: "John",
    closed_amount: 100,
    payment_method: "Check",
    raw_message: "raw",
    ...overrides,
  };
}

function emptyTechReport(name = "John"): TechnicianReport {
  return {
    technician_name: name,
    total_jobs: 0,
    total_amount: 0,
    payment_method_breakdown: {},
    jobs: [],
  };
}

// ─── formatMainWeeklyReport — multiple technicians ───────────────────────────

describe("formatMainWeeklyReport — multiple technicians", () => {
  const report = generateWeeklyReport([
    makeJob({ technician_name: "John", closed_amount: 250, payment_method: "Check",       customer_name: "Alice Smith"  }),
    makeJob({ technician_name: "Mike", closed_amount: 700, payment_method: "Credit Card", customer_name: "Bob Jones"    }),
    makeJob({ technician_name: "John", closed_amount: 300, payment_method: "Cash",        customer_name: "Carol White"  }),
  ]);
  const text = formatMainWeeklyReport(report);

  test("output is a string", () => expect(typeof text).toBe("string"));
  test("contains title", () => expect(text).toContain("WEEKLY CLOSED JOBS REPORT"));
  test("contains total jobs count", () => expect(text).toContain("Total Jobs: 3"));
  test("contains total gross $1,250.00", () => expect(text).toContain("$1,250.00"));

  test("contains John in technician breakdown", () => expect(text).toContain("John"));
  test("contains Mike in technician breakdown", () => expect(text).toContain("Mike"));
  test("shows John job count", () => expect(text).toContain("2 jobs"));
  test("shows Mike job count", () => expect(text).toContain("1 job"));

  test("contains Check in payment methods", () => expect(text).toContain("Check"));
  test("contains Credit Card in payment methods", () => expect(text).toContain("Credit Card"));
  test("contains Cash in payment methods", () => expect(text).toContain("Cash"));

  test("contains Alice Smith in jobs list", () => expect(text).toContain("Alice Smith"));
  test("contains Bob Jones in jobs list", () => expect(text).toContain("Bob Jones"));
  test("contains Carol White in jobs list", () => expect(text).toContain("Carol White"));

  test("contains ALL JOBS section header", () => expect(text).toContain("ALL JOBS"));
  test("contains TECHNICIAN BREAKDOWN section header", () =>
    expect(text).toContain("TECHNICIAN BREAKDOWN"));
  test("contains PAYMENT METHODS section header", () =>
    expect(text).toContain("PAYMENT METHODS"));

  test("no emojis", () => expect(text).not.toMatch(/[\u{1F300}-\u{1FFFF}]/u));
  test("no markdown table pipes in section headers", () =>
    expect(text).not.toMatch(/^\|/m));
});

// ─── formatMainWeeklyReport — empty report ───────────────────────────────────

describe("formatMainWeeklyReport — empty report", () => {
  const text = formatMainWeeklyReport(generateWeeklyReport([]));

  test("contains title", () => expect(text).toContain("WEEKLY CLOSED JOBS REPORT"));
  test("shows 0 jobs", () => expect(text).toContain("Total Jobs: 0"));
  test("shows $0.00 gross", () => expect(text).toContain("$0.00"));
  test("is still readable (non-empty string)", () => expect(text.trim().length).toBeGreaterThan(0));
  test("does not mention technician names from nowhere", () =>
    expect(text).not.toContain("undefined"));
});

// ─── formatTechnicianReport — single technician ──────────────────────────────

describe("formatTechnicianReport — single technician, multiple payment methods", () => {
  const report = generateWeeklyReport([
    makeJob({ technician_name: "John", closed_amount: 250, payment_method: "Check",  customer_name: "Alice Smith" }),
    makeJob({ technician_name: "John", closed_amount: 300, payment_method: "Cash",   customer_name: "Carol White" }),
    makeJob({ technician_name: "John", closed_amount: 200, payment_method: "Zelle",  customer_name: "Dave Brown"  }),
  ]);
  const text = formatTechnicianReport(report.technician_breakdown[0]);

  test("output is a string", () => expect(typeof text).toBe("string"));
  test("contains title", () => expect(text).toContain("TECHNICIAN WEEKLY REPORT"));
  test("contains technician name", () => expect(text).toContain("John"));
  test("shows total jobs 3", () => expect(text).toContain("Total Jobs: 3"));
  test("shows total amount $750.00", () => expect(text).toContain("$750.00"));

  test("contains Check in payment breakdown", () => expect(text).toContain("Check"));
  test("contains Cash in payment breakdown", () => expect(text).toContain("Cash"));
  test("contains Zelle in payment breakdown", () => expect(text).toContain("Zelle"));

  test("Check amount $250.00", () => expect(text).toContain("$250.00"));
  test("Cash amount $300.00", () => expect(text).toContain("$300.00"));
  test("Zelle amount $200.00", () => expect(text).toContain("$200.00"));

  test("contains Alice Smith", () => expect(text).toContain("Alice Smith"));
  test("contains Carol White", () => expect(text).toContain("Carol White"));
  test("contains Dave Brown", () => expect(text).toContain("Dave Brown"));

  test("contains JOBS section header", () => expect(text).toContain("JOBS"));
  test("contains PAYMENT METHODS section header", () =>
    expect(text).toContain("PAYMENT METHODS"));

  test("no emojis", () => expect(text).not.toMatch(/[\u{1F300}-\u{1FFFF}]/u));
  test("does not contain other technician names", () =>
    expect(text).not.toContain("Mike"));
});

// ─── formatTechnicianReport — empty report ───────────────────────────────────

describe("formatTechnicianReport — empty report", () => {
  const text = formatTechnicianReport(emptyTechReport("Sara"));

  test("contains title", () => expect(text).toContain("TECHNICIAN WEEKLY REPORT"));
  test("contains technician name", () => expect(text).toContain("Sara"));
  test("shows 0 jobs", () => expect(text).toContain("Total Jobs: 0"));
  test("shows $0.00", () => expect(text).toContain("$0.00"));
  test("is still readable", () => expect(text.trim().length).toBeGreaterThan(0));
  test("does not contain undefined", () => expect(text).not.toContain("undefined"));
});

// ─── currency formatting ─────────────────────────────────────────────────────

describe("currency formatting", () => {
  test("comma separator for thousands", () => {
    const report = generateWeeklyReport([makeJob({ closed_amount: 1250 })]);
    expect(formatMainWeeklyReport(report)).toContain("$1,250.00");
  });

  test("two decimal places for whole numbers", () => {
    const report = generateWeeklyReport([makeJob({ closed_amount: 500 })]);
    expect(formatMainWeeklyReport(report)).toContain("$500.00");
  });

  test("decimal amount shown correctly ($99.50)", () => {
    const report = generateWeeklyReport([makeJob({ closed_amount: 99.5 })]);
    expect(formatMainWeeklyReport(report)).toContain("$99.50");
  });

  test("large amount with comma ($10,000.00)", () => {
    const jobs = Array.from({ length: 4 }, () => makeJob({ closed_amount: 2500 }));
    const report = generateWeeklyReport(jobs);
    expect(formatMainWeeklyReport(report)).toContain("$10,000.00");
  });

  test("technician report decimal amount", () => {
    const report = generateWeeklyReport([makeJob({ closed_amount: 1750.75 })]);
    expect(formatTechnicianReport(report.technician_breakdown[0])).toContain("$1,750.75");
  });

  test("zero formatted as $0.00", () => {
    expect(formatMainWeeklyReport(generateWeeklyReport([]))).toContain("$0.00");
  });
});

// ─── payment method breakdown ─────────────────────────────────────────────────

describe("payment method breakdown", () => {
  test("main report shows each method once", () => {
    const report = generateWeeklyReport([
      makeJob({ payment_method: "Check",       closed_amount: 100 }),
      makeJob({ payment_method: "Cash",        closed_amount: 200 }),
      makeJob({ payment_method: "Credit Card", closed_amount: 300 }),
    ]);
    const text = formatMainWeeklyReport(report);
    expect(text).toContain("Check");
    expect(text).toContain("Cash");
    expect(text).toContain("Credit Card");
  });

  test("technician report shows per-method totals", () => {
    const report = generateWeeklyReport([
      makeJob({ technician_name: "John", payment_method: "Check", closed_amount: 150 }),
      makeJob({ technician_name: "John", payment_method: "Check", closed_amount: 100 }),
    ]);
    const text = formatTechnicianReport(report.technician_breakdown[0]);
    expect(text).toContain("$250.00"); // 150 + 100 summed under Check
  });

  test("empty payment breakdown produces readable placeholder", () => {
    const text = formatTechnicianReport(emptyTechReport());
    expect(text).not.toContain("undefined");
    expect(text.trim().length).toBeGreaterThan(0);
  });
});

// ─── job order preservation ───────────────────────────────────────────────────

describe("job order preservation", () => {
  const jobs = [
    makeJob({ customer_name: "First",  closed_amount: 100 }),
    makeJob({ customer_name: "Second", closed_amount: 200 }),
    makeJob({ customer_name: "Third",  closed_amount: 300 }),
  ];
  const report = generateWeeklyReport(jobs);

  test("main report: First before Second", () => {
    const text = formatMainWeeklyReport(report);
    expect(text.indexOf("First")).toBeLessThan(text.indexOf("Second"));
  });

  test("main report: Second before Third", () => {
    const text = formatMainWeeklyReport(report);
    expect(text.indexOf("Second")).toBeLessThan(text.indexOf("Third"));
  });

  test("technician report: First before Second", () => {
    const text = formatTechnicianReport(report.technician_breakdown[0]);
    expect(text.indexOf("First")).toBeLessThan(text.indexOf("Second"));
  });

  test("technician report: Second before Third", () => {
    const text = formatTechnicianReport(report.technician_breakdown[0]);
    expect(text.indexOf("Second")).toBeLessThan(text.indexOf("Third"));
  });

  test("jobs are numbered starting from 1", () => {
    const text = formatMainWeeklyReport(report);
    expect(text).toContain("1.");
    expect(text).toContain("2.");
    expect(text).toContain("3.");
  });
});
