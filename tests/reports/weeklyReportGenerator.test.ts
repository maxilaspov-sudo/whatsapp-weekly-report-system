import {
  generateWeeklyReport,
  WeeklyReport,
  TechnicianReport,
} from "../../src/reports/weeklyReportGenerator";
import { ParsedFullJobMessage } from "../../src/parser/fullJobMessageParser";

// ─── test factory ────────────────────────────────────────────────────────────

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

function techReport(report: WeeklyReport, name: string): TechnicianReport {
  const found = report.technician_breakdown.find((t) => t.technician_name === name);
  if (!found) throw new Error(`No technician report for "${name}"`);
  return found;
}

// ─── empty input ─────────────────────────────────────────────────────────────

describe("generateWeeklyReport — empty input", () => {
  const report = generateWeeklyReport([]);

  test("total_jobs is 0", () => expect(report.total_jobs).toBe(0));
  test("total_gross_amount is 0", () => expect(report.total_gross_amount).toBe(0));
  test("technician_breakdown is empty", () => expect(report.technician_breakdown).toHaveLength(0));
  test("payment_method_breakdown is empty", () =>
    expect(Object.keys(report.payment_method_breakdown)).toHaveLength(0));
  test("all_jobs is empty", () => expect(report.all_jobs).toHaveLength(0));
});

// ─── single job ──────────────────────────────────────────────────────────────

describe("generateWeeklyReport — single job", () => {
  const report = generateWeeklyReport([
    makeJob({ technician_name: "John", closed_amount: 250, payment_method: "Check" }),
  ]);

  test("total_jobs is 1", () => expect(report.total_jobs).toBe(1));
  test("total_gross_amount is 250", () => expect(report.total_gross_amount).toBe(250));
  test("one technician in breakdown", () =>
    expect(report.technician_breakdown).toHaveLength(1));

  test("technician report — total_jobs", () =>
    expect(techReport(report, "John").total_jobs).toBe(1));
  test("technician report — total_amount", () =>
    expect(techReport(report, "John").total_amount).toBe(250));
  test("technician report — payment breakdown", () =>
    expect(techReport(report, "John").payment_method_breakdown).toEqual({ Check: 250 }));
  test("technician report — jobs list", () =>
    expect(techReport(report, "John").jobs).toHaveLength(1));

  test("global payment breakdown", () =>
    expect(report.payment_method_breakdown).toEqual({ Check: 250 }));
});

// ─── multiple technicians ────────────────────────────────────────────────────

describe("generateWeeklyReport — multiple technicians", () => {
  const report = generateWeeklyReport([
    makeJob({ technician_name: "John", closed_amount: 250, payment_method: "Check" }),
    makeJob({ technician_name: "Mike", closed_amount: 700, payment_method: "Credit Card" }),
    makeJob({ technician_name: "Sara", closed_amount: 150, payment_method: "Cash" }),
  ]);

  test("total_jobs is 3", () => expect(report.total_jobs).toBe(3));
  test("total_gross_amount is 1100", () => expect(report.total_gross_amount).toBe(1100));
  test("three technicians in breakdown", () =>
    expect(report.technician_breakdown).toHaveLength(3));

  test("John total_amount", () => expect(techReport(report, "John").total_amount).toBe(250));
  test("Mike total_amount", () => expect(techReport(report, "Mike").total_amount).toBe(700));
  test("Sara total_amount", () => expect(techReport(report, "Sara").total_amount).toBe(150));

  test("global payment breakdown has all methods", () =>
    expect(report.payment_method_breakdown).toEqual({
      Check: 250,
      "Credit Card": 700,
      Cash: 150,
    }));
});

// ─── duplicate technician names (grouping) ───────────────────────────────────

describe("generateWeeklyReport — duplicate technician names are grouped", () => {
  const report = generateWeeklyReport([
    makeJob({ technician_name: "John", closed_amount: 250, payment_method: "Check" }),
    makeJob({ technician_name: "John", closed_amount: 300, payment_method: "Cash" }),
    makeJob({ technician_name: "John", closed_amount: 200, payment_method: "Check" }),
  ]);

  test("only one technician entry for John", () =>
    expect(report.technician_breakdown).toHaveLength(1));
  test("John total_jobs is 3", () =>
    expect(techReport(report, "John").total_jobs).toBe(3));
  test("John total_amount is 750", () =>
    expect(techReport(report, "John").total_amount).toBe(750));
  test("John payment breakdown sums Check across both jobs", () =>
    expect(techReport(report, "John").payment_method_breakdown).toEqual({
      Check: 450,
      Cash: 300,
    }));
  test("jobs list contains all 3 jobs", () =>
    expect(techReport(report, "John").jobs).toHaveLength(3));
});

// ─── multiple payment methods ────────────────────────────────────────────────

describe("generateWeeklyReport — multiple payment methods per technician", () => {
  const report = generateWeeklyReport([
    makeJob({ technician_name: "John", closed_amount: 100, payment_method: "Cash" }),
    makeJob({ technician_name: "John", closed_amount: 200, payment_method: "Check" }),
    makeJob({ technician_name: "John", closed_amount: 300, payment_method: "Credit Card" }),
    makeJob({ technician_name: "John", closed_amount: 400, payment_method: "Zelle" }),
  ]);

  test("global breakdown has 4 methods", () =>
    expect(Object.keys(report.payment_method_breakdown)).toHaveLength(4));
  test("global Cash", () => expect(report.payment_method_breakdown["Cash"]).toBe(100));
  test("global Check", () => expect(report.payment_method_breakdown["Check"]).toBe(200));
  test("global Credit Card", () =>
    expect(report.payment_method_breakdown["Credit Card"]).toBe(300));
  test("global Zelle", () => expect(report.payment_method_breakdown["Zelle"]).toBe(400));

  test("technician breakdown mirrors global when one technician", () =>
    expect(techReport(report, "John").payment_method_breakdown).toEqual(
      report.payment_method_breakdown
    ));
});

// ─── decimal amounts ─────────────────────────────────────────────────────────

describe("generateWeeklyReport — decimal amounts", () => {
  const report = generateWeeklyReport([
    makeJob({ technician_name: "John", closed_amount: 99.5, payment_method: "Cash" }),
    makeJob({ technician_name: "John", closed_amount: 0.5, payment_method: "Cash" }),
  ]);

  test("total_gross_amount sums correctly", () =>
    expect(report.total_gross_amount).toBe(100));
  test("technician total_amount is 100", () =>
    expect(techReport(report, "John").total_amount).toBe(100));
});

// ─── invalid jobs are ignored ────────────────────────────────────────────────

describe("generateWeeklyReport — invalid jobs are silently skipped", () => {
  const validJob = makeJob({ technician_name: "John", closed_amount: 200, payment_method: "Cash" });

  test("zero amount is skipped", () => {
    const report = generateWeeklyReport([
      validJob,
      makeJob({ closed_amount: 0 }),
    ]);
    expect(report.total_jobs).toBe(1);
    expect(report.total_gross_amount).toBe(200);
  });

  test("negative amount is skipped", () => {
    const report = generateWeeklyReport([
      validJob,
      makeJob({ closed_amount: -50 }),
    ]);
    expect(report.total_jobs).toBe(1);
  });

  test("empty technician_name is skipped", () => {
    const report = generateWeeklyReport([
      validJob,
      makeJob({ technician_name: "" }),
    ]);
    expect(report.total_jobs).toBe(1);
    expect(report.technician_breakdown).toHaveLength(1);
  });

  test("whitespace-only technician_name is skipped", () => {
    const report = generateWeeklyReport([
      validJob,
      makeJob({ technician_name: "   " }),
    ]);
    expect(report.total_jobs).toBe(1);
  });

  test("empty payment_method is skipped", () => {
    const report = generateWeeklyReport([
      validJob,
      makeJob({ payment_method: "" }),
    ]);
    expect(report.total_jobs).toBe(1);
  });

  test("invalid jobs do not appear in all_jobs", () => {
    const report = generateWeeklyReport([
      validJob,
      makeJob({ closed_amount: 0 }),
      makeJob({ technician_name: "" }),
    ]);
    expect(report.all_jobs).toHaveLength(1);
    expect(report.all_jobs[0].technician_name).toBe("John");
  });

  test("all-invalid input produces empty report", () => {
    const report = generateWeeklyReport([
      makeJob({ closed_amount: 0 }),
      makeJob({ technician_name: "" }),
      makeJob({ payment_method: "" }),
    ]);
    expect(report.total_jobs).toBe(0);
    expect(report.total_gross_amount).toBe(0);
    expect(report.technician_breakdown).toHaveLength(0);
  });
});

// ─── large weekly totals ─────────────────────────────────────────────────────

describe("generateWeeklyReport — large weekly totals", () => {
  const technicians = ["Alice", "Bob", "Carol", "Dave", "Eve"];
  const methods = ["Check", "Cash", "Credit Card", "Zelle"];
  const jobs: ParsedFullJobMessage[] = [];

  // 5 technicians × 10 jobs each = 50 jobs, $500 each = $25,000 gross
  for (const tech of technicians) {
    for (let i = 0; i < 10; i++) {
      jobs.push(
        makeJob({
          technician_name: tech,
          closed_amount: 500,
          payment_method: methods[i % methods.length],
        })
      );
    }
  }

  const report = generateWeeklyReport(jobs);

  test("total_jobs is 50", () => expect(report.total_jobs).toBe(50));
  test("total_gross_amount is 25000", () =>
    expect(report.total_gross_amount).toBe(25000));
  test("5 technicians in breakdown", () =>
    expect(report.technician_breakdown).toHaveLength(5));

  for (const tech of technicians) {
    test(`${tech} has 10 jobs and $5000`, () => {
      const t = techReport(report, tech);
      expect(t.total_jobs).toBe(10);
      expect(t.total_amount).toBe(5000);
    });
  }

  test("global payment breakdown sums to gross", () => {
    const sum = Object.values(report.payment_method_breakdown).reduce((a, b) => a + b, 0);
    expect(sum).toBe(25000);
  });
});

// ─── all_jobs preserves order ────────────────────────────────────────────────

describe("generateWeeklyReport — all_jobs list", () => {
  const j1 = makeJob({ technician_name: "John", closed_amount: 100 });
  const j2 = makeJob({ technician_name: "Mike", closed_amount: 200 });
  const j3 = makeJob({ technician_name: "John", closed_amount: 300 });
  const report = generateWeeklyReport([j1, j2, j3]);

  test("all_jobs length equals total_jobs", () =>
    expect(report.all_jobs).toHaveLength(report.total_jobs));
  test("all_jobs preserves input order", () => {
    expect(report.all_jobs[0].closed_amount).toBe(100);
    expect(report.all_jobs[1].closed_amount).toBe(200);
    expect(report.all_jobs[2].closed_amount).toBe(300);
  });
});
