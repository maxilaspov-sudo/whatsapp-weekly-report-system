import { SAMPLE_MESSAGES } from "../../src/demo/sampleMessages";
import { buildDemoResult } from "../../src/demo/runWeeklyReportDemo";
import { parseFullJobMessage } from "../../src/parser/fullJobMessageParser";

// Run once for the whole suite — avoids re-parsing 9 messages per test
const result = buildDemoResult(SAMPLE_MESSAGES);

// ─── sample messages array ────────────────────────────────────────────────────

describe("SAMPLE_MESSAGES", () => {
  test("is non-empty", () => expect(SAMPLE_MESSAGES.length).toBeGreaterThan(0));
  test("contains at least 7 messages", () => expect(SAMPLE_MESSAGES.length).toBeGreaterThanOrEqual(7));
  test("all entries are non-empty strings", () =>
    SAMPLE_MESSAGES.forEach((m) => expect(typeof m).toBe("string")));
});

// ─── parse split: valid vs invalid ───────────────────────────────────────────

describe("buildDemoResult — parse split", () => {
  test("produces at least 5 valid jobs", () =>
    expect(result.validJobs.length).toBeGreaterThanOrEqual(5));

  test("produces at least 1 invalid message", () =>
    expect(result.invalidMessages.length).toBeGreaterThanOrEqual(1));

  test("valid + invalid accounts for all messages", () =>
    expect(result.validJobs.length + result.invalidMessages.length).toBe(
      SAMPLE_MESSAGES.length
    ));

  test("each invalid entry has raw and reason", () =>
    result.invalidMessages.forEach(({ raw, reason }) => {
      expect(typeof raw).toBe("string");
      expect(typeof reason).toBe("string");
      expect(reason.length).toBeGreaterThan(0);
    }));
});

// ─── technicians ──────────────────────────────────────────────────────────────

describe("buildDemoResult — technicians", () => {
  const names = result.report.technician_breakdown.map((t) => t.technician_name);

  test("report has at least 3 distinct technicians", () =>
    expect(names.length).toBeGreaterThanOrEqual(3));

  test("John is present", () => expect(names).toContain("John"));
  test("Mike is present", () => expect(names).toContain("Mike"));
  test("Sara is present", () => expect(names).toContain("Sara"));

  test("John has 2 jobs", () => {
    const john = result.report.technician_breakdown.find((t) => t.technician_name === "John");
    expect(john?.total_jobs).toBe(2);
  });

  test("Mike has 2 jobs", () => {
    const mike = result.report.technician_breakdown.find((t) => t.technician_name === "Mike");
    expect(mike?.total_jobs).toBe(2);
  });
});

// ─── payment methods ──────────────────────────────────────────────────────────

describe("buildDemoResult — payment methods", () => {
  const methods = Object.keys(result.report.payment_method_breakdown);

  test("at least 4 payment methods", () => expect(methods.length).toBeGreaterThanOrEqual(4));
  test("Check is present", () => expect(methods).toContain("Check"));
  test("Credit Card is present", () => expect(methods).toContain("Credit Card"));
  test("Cash is present", () => expect(methods).toContain("Cash"));
  test("Zelle is present", () => expect(methods).toContain("Zelle"));
});

// ─── weekly report totals ────────────────────────────────────────────────────

describe("buildDemoResult — report totals", () => {
  test("total_jobs equals valid job count", () =>
    expect(result.report.total_jobs).toBe(result.validJobs.length));

  test("total_gross_amount is positive", () =>
    expect(result.report.total_gross_amount).toBeGreaterThan(0));

  test("payment method totals sum to gross amount", () => {
    const sum = Object.values(result.report.payment_method_breakdown).reduce(
      (acc, v) => acc + v,
      0
    );
    expect(sum).toBeCloseTo(result.report.total_gross_amount, 2);
  });

  test("technician totals sum to gross amount", () => {
    const sum = result.report.technician_breakdown.reduce((acc, t) => acc + t.total_amount, 0);
    expect(sum).toBeCloseTo(result.report.total_gross_amount, 2);
  });
});

// ─── formatted output ────────────────────────────────────────────────────────

describe("buildDemoResult — formatted output", () => {
  test("formattedMain is a non-empty string", () => {
    expect(typeof result.formattedMain).toBe("string");
    expect(result.formattedMain.trim().length).toBeGreaterThan(0);
  });

  test("formattedMain contains WEEKLY CLOSED JOBS REPORT", () =>
    expect(result.formattedMain).toContain("WEEKLY CLOSED JOBS REPORT"));

  test("formattedMain contains John", () => expect(result.formattedMain).toContain("John"));
  test("formattedMain contains Mike", () => expect(result.formattedMain).toContain("Mike"));

  test("one technician report per technician", () =>
    expect(result.formattedTechnicianReports.length).toBe(
      result.report.technician_breakdown.length
    ));

  test("each technician report is a non-empty string", () =>
    result.formattedTechnicianReports.forEach((text) => {
      expect(typeof text).toBe("string");
      expect(text.trim().length).toBeGreaterThan(0);
    }));

  test("each technician report contains TECHNICIAN WEEKLY REPORT", () =>
    result.formattedTechnicianReports.forEach((text) =>
      expect(text).toContain("TECHNICIAN WEEKLY REPORT")
    ));

  test("decimal amount (Tom $1250.50) formatted as $1,250.50", () => {
    const tomReport = result.report.technician_breakdown.find(
      (t) => t.technician_name === "Tom"
    );
    expect(tomReport).toBeDefined();
    const tomIndex = result.report.technician_breakdown.indexOf(tomReport!);
    expect(result.formattedTechnicianReports[tomIndex]).toContain("$1,250.50");
  });
});

// ─── SAMPLE_MESSAGES parse independently ────────────────────────────────────

describe("SAMPLE_MESSAGES — individual parse checks", () => {
  test("first message parses as John $250 Check", () => {
    const r = parseFullJobMessage(SAMPLE_MESSAGES[0]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.technician_name).toBe("John");
    expect(r.data.closed_amount).toBe(250);
    expect(r.data.payment_method).toBe("Check");
  });

  test("second message parses as Mike $700 Credit Card", () => {
    const r = parseFullJobMessage(SAMPLE_MESSAGES[1]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.technician_name).toBe("Mike");
    expect(r.data.closed_amount).toBe(700);
    expect(r.data.payment_method).toBe("Credit Card");
  });

  test("plain-text note fails to parse", () => {
    const plainNote = SAMPLE_MESSAGES.find((m) => !m.includes("Name:"));
    expect(plainNote).toBeDefined();
    const r = parseFullJobMessage(plainNote!);
    expect(r.ok).toBe(false);
  });

  test("crypto closing line fails to parse", () => {
    const cryptoMsg = SAMPLE_MESSAGES.find((m) => m.includes("crypto"));
    expect(cryptoMsg).toBeDefined();
    const r = parseFullJobMessage(cryptoMsg!);
    expect(r.ok).toBe(false);
  });
});
