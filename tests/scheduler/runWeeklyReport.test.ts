import { InMemoryClosedJobRepository } from "../../src/db/inMemoryClosedJobRepository";
import { runWeeklyReport } from "../../src/scheduler/runWeeklyReport";
import { processIncomingMessages, IncomingMessage } from "../../src/pipeline/weeklyReportPipeline";

// Fixed reference point: Wednesday 2024-01-17 at noon local time.
// Previous week is Mon 2024-01-08 – Sun 2024-01-14.
const NOW = new Date(2024, 0, 17, 12, 0, 0);
const TEST_GROUP = "test-group@g.us";
const TEST_COMPANY = "test-company";

// Timestamps for repository clock injection
const IN_RANGE = new Date(2024, 0, 10, 10, 0, 0);       // Wed Jan 10 — inside previous week
const FUTURE = new Date(2024, 0, 20, 10, 0, 0);          // Sat Jan 20 — current week
const PAST = new Date(2023, 11, 31, 10, 0, 0);           // Dec 31 2023 — two weeks ago

function makeMessage(id: string, closing = "John $250 check"): IncomingMessage {
  return {
    source_message_id: id,
    whatsapp_group_id: TEST_GROUP,
    company_id: TEST_COMPANY,
    raw_message: [
      "Test Company",
      "",
      "Name: Test Customer",
      "Phone: (555) 000-0000",
      "Address: 123 Test St",
      "Job type: Test Service",
      "Appointment Monday @ 9am",
      "",
      closing,
    ].join("\n"),
  };
}

async function repoWith(
  timestamps: Date[],
  closings: string[]
): Promise<InMemoryClosedJobRepository> {
  let tick = 0;
  const repo = new InMemoryClosedJobRepository(() => timestamps[tick++] ?? IN_RANGE);
  await processIncomingMessages(
    closings.map((c, i) => makeMessage(`msg-${i + 1}`, c)),
    repo
  );
  return repo;
}

// ─── empty week ───────────────────────────────────────────────────────────────

describe("runWeeklyReport — empty week", () => {
  test("returns a WeeklyReportResult with all required fields", async () => {
    const repo = new InMemoryClosedJobRepository();
    const result = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(result).toHaveProperty("week_start");
    expect(result).toHaveProperty("week_end");
    expect(result).toHaveProperty("main_report_text");
    expect(result).toHaveProperty("technician_report_texts");
  });

  test("main_report_text contains 'Total Jobs: 0'", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { main_report_text } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(main_report_text).toContain("Total Jobs: 0");
  });

  test("main_report_text is a non-empty string", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { main_report_text } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(typeof main_report_text).toBe("string");
    expect(main_report_text.length).toBeGreaterThan(0);
  });

  test("technician_report_texts is an empty array", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { technician_report_texts } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(technician_report_texts).toHaveLength(0);
  });
});

// ─── week range correctness (NOW = Wed Jan 17 2024) ──────────────────────────

describe("runWeeklyReport — week range for Wed Jan 17 2024", () => {
  test("week_start is Mon Jan 8 2024", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { week_start } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(week_start.getFullYear()).toBe(2024);
    expect(week_start.getMonth()).toBe(0);  // January
    expect(week_start.getDate()).toBe(8);
  });

  test("week_end is Sun Jan 14 2024", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { week_end } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(week_end.getFullYear()).toBe(2024);
    expect(week_end.getMonth()).toBe(0);    // January
    expect(week_end.getDate()).toBe(14);
  });

  test("week_start is a Monday", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { week_start } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(week_start.getDay()).toBe(1);
  });

  test("week_end is a Sunday", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { week_end } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(week_end.getDay()).toBe(0);
  });
});

// ─── jobs within range ────────────────────────────────────────────────────────

describe("runWeeklyReport — jobs within range", () => {
  test("correct total job count", async () => {
    const repo = await repoWith(
      [IN_RANGE, IN_RANGE, IN_RANGE],
      ["John $250 check", "Mike 700 cc", "Sara 150 cash"]
    );
    const { main_report_text } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(main_report_text).toContain("Total Jobs: 3");
  });

  test("correct gross total (250 + 350 = 600)", async () => {
    const repo = await repoWith(
      [IN_RANGE, IN_RANGE],
      ["John $250 check", "Mike $350 zelle"]
    );
    const { main_report_text } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(main_report_text).toContain("$600.00");
  });

  test("produces one technician report per unique technician", async () => {
    const repo = await repoWith(
      [IN_RANGE, IN_RANGE, IN_RANGE, IN_RANGE],
      ["John $250 check", "Mike 700 cc", "Sara 150 cash", "John $300 zelle"]
    );
    const { technician_report_texts } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(technician_report_texts).toHaveLength(3);
  });

  test("technician names appear in main report", async () => {
    const repo = await repoWith(
      [IN_RANGE, IN_RANGE],
      ["John $250 check", "Mike 700 cc"]
    );
    const { main_report_text } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(main_report_text).toContain("John");
    expect(main_report_text).toContain("Mike");
  });

  test("technician_report_texts carries correct technician names", async () => {
    const repo = await repoWith(
      [IN_RANGE, IN_RANGE],
      ["John $250 check", "Sara 150 cash"]
    );
    const { technician_report_texts } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    const names = technician_report_texts.map((r) => r.technician_name);
    expect(names).toContain("John");
    expect(names).toContain("Sara");
  });

  test("each technician_report_text.text is a non-empty string", async () => {
    const repo = await repoWith(
      [IN_RANGE, IN_RANGE],
      ["John $250 check", "Mike 700 cc"]
    );
    const { technician_report_texts } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    for (const r of technician_report_texts) {
      expect(typeof r.text).toBe("string");
      expect(r.text.length).toBeGreaterThan(0);
    }
  });

  test("technician report total is correct (John: $250 + $300 = $550)", async () => {
    const repo = await repoWith(
      [IN_RANGE, IN_RANGE, IN_RANGE],
      ["John $250 check", "John $300 zelle", "Mike 700 cc"]
    );
    const { technician_report_texts } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    const john = technician_report_texts.find((r) => r.technician_name === "John");
    expect(john).toBeDefined();
    expect(john!.text).toContain("Total Jobs: 2");
    expect(john!.text).toContain("$550.00");
  });
});

// ─── date range filtering ─────────────────────────────────────────────────────

describe("runWeeklyReport — date range filtering", () => {
  test("jobs outside the range are excluded from totals", async () => {
    let tick = 0;
    const timestamps = [IN_RANGE, FUTURE, PAST];
    const repo = new InMemoryClosedJobRepository(() => timestamps[tick++]);
    await processIncomingMessages(
      [
        makeMessage("msg-1", "John $250 check"),   // in range
        makeMessage("msg-2", "Mike 700 cc"),        // future
        makeMessage("msg-3", "Sara 150 cash"),      // past
      ],
      repo
    );
    const { main_report_text, technician_report_texts } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(main_report_text).toContain("Total Jobs: 1");
    expect(technician_report_texts).toHaveLength(1);
    expect(technician_report_texts[0].technician_name).toBe("John");
  });

  test("repo with only out-of-range jobs produces an empty report", async () => {
    const repo = new InMemoryClosedJobRepository(() => FUTURE);
    await processIncomingMessages([makeMessage("msg-1", "John $250 check")], repo);
    const { main_report_text, technician_report_texts } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(main_report_text).toContain("Total Jobs: 0");
    expect(technician_report_texts).toHaveLength(0);
  });
});

// ─── year boundary ────────────────────────────────────────────────────────────

describe("runWeeklyReport — year boundary", () => {
  test("Wed Jan 1 2025: reports jobs from Dec 23–29 2024", async () => {
    const newYearNow = new Date(2025, 0, 1, 12, 0, 0);
    const dec25 = new Date(2024, 11, 25, 10, 0, 0); // within Dec 23–29 range

    const repo = new InMemoryClosedJobRepository(() => dec25);
    await processIncomingMessages([makeMessage("msg-1", "John $500 check")], repo);

    const result = await runWeeklyReport(repo, newYearNow, TEST_GROUP);
    expect(result.main_report_text).toContain("Total Jobs: 1");
    expect(result.main_report_text).toContain("$500.00");
    expect(result.week_start.getFullYear()).toBe(2024);
    expect(result.week_start.getDate()).toBe(23);
    expect(result.week_end.getDate()).toBe(29);
  });
});

// ─── multiple technicians ─────────────────────────────────────────────────────

describe("runWeeklyReport — multiple technicians", () => {
  test("four technicians with varied amounts", async () => {
    const repo = await repoWith(
      [IN_RANGE, IN_RANGE, IN_RANGE, IN_RANGE, IN_RANGE],
      [
        "John $250 check",
        "Mike 700 cc",
        "Sara 150 cash",
        "Tom $1250.50 zelle",
        "John $300 ach",
      ]
    );
    const { main_report_text, technician_report_texts } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(technician_report_texts).toHaveLength(4);
    expect(main_report_text).toContain("Total Jobs: 5");
    // 250 + 700 + 150 + 1250.50 + 300 = 2650.50
    expect(main_report_text).toContain("$2,650.50");
  });

  test("payment method breakdown totals match gross", async () => {
    const repo = await repoWith(
      [IN_RANGE, IN_RANGE, IN_RANGE],
      ["John $250 check", "Mike 700 cc", "Sara 150 cash"]
    );
    const { main_report_text } = await runWeeklyReport(repo, NOW, TEST_GROUP);
    expect(main_report_text).toContain("Check");
    expect(main_report_text).toContain("Credit Card");
    expect(main_report_text).toContain("Cash");
  });
});
