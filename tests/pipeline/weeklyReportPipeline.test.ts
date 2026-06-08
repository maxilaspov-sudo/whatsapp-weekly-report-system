import { InMemoryClosedJobRepository } from "../../src/db/inMemoryClosedJobRepository";
import {
  processIncomingMessages,
  generateFormattedWeeklyReports,
  IncomingMessage,
} from "../../src/pipeline/weeklyReportPipeline";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeValidMessage(
  id: string,
  opts: {
    company?: string;
    customer?: string;
    phone?: string;
    address?: string;
    jobType?: string;
    appointment?: string;
    closing?: string;
  } = {}
): IncomingMessage {
  const company = opts.company ?? "Sunshine Home Services";
  const customer = opts.customer ?? "Test Customer";
  const phone = opts.phone ?? "(205) 555-0000";
  const address = opts.address ?? "123 Test St, Test City, AL 35000";
  const jobType = opts.jobType ?? "Test Service";
  const appointment = opts.appointment ?? "Monday 01/06 @ 9am";
  const closing = opts.closing ?? "John $250 check";

  return {
    source_message_id: id,
    raw_message: [
      company,
      "",
      `Name: ${customer}`,
      `Phone: ${phone}`,
      `Address: ${address}`,
      `Job type: ${jobType}`,
      `Appointment ${appointment}`,
      "",
      closing,
    ].join("\n"),
  };
}

function makeInvalidMessage(id: string, raw_message: string): IncomingMessage {
  return { source_message_id: id, raw_message };
}

// ─── processIncomingMessages — all valid ─────────────────────────────────────

describe("processIncomingMessages — all valid messages", () => {
  test("saves all messages and returns correct counts", async () => {
    const repo = new InMemoryClosedJobRepository();
    const messages = [
      makeValidMessage("msg-1", { closing: "John $250 check" }),
      makeValidMessage("msg-2", { closing: "Mike 700 cc" }),
      makeValidMessage("msg-3", { closing: "Sara 150 cash" }),
    ];

    const result = await processIncomingMessages(messages, repo);

    expect(result.processed_count).toBe(3);
    expect(result.saved_count).toBe(3);
    expect(result.invalid_count).toBe(0);
    expect(result.duplicate_count).toBe(0);
    expect(result.invalid_messages).toHaveLength(0);
    expect(result.duplicate_messages).toHaveLength(0);

    const all = await repo.listAll();
    expect(all).toHaveLength(3);
  });

  test("preserves raw_message on each saved record", async () => {
    const repo = new InMemoryClosedJobRepository();
    const message = makeValidMessage("msg-1");
    await processIncomingMessages([message], repo);
    const record = await repo.findBySourceMessageId("msg-1");
    expect(record?.raw_message).toBe(message.raw_message);
  });

  test("sets needs_review to false for valid jobs", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages([makeValidMessage("msg-1")], repo);
    const record = await repo.findBySourceMessageId("msg-1");
    expect(record?.needs_review).toBe(false);
  });

  test("correctly parses technician, amount, and payment method", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [makeValidMessage("msg-1", { closing: "Mike 700 cc" })],
      repo
    );
    const record = await repo.findBySourceMessageId("msg-1");
    expect(record?.technician_name).toBe("Mike");
    expect(record?.closed_amount).toBe(700);
    expect(record?.payment_method).toBe("Credit Card");
  });

  test("saves source_message_id on each record", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages([makeValidMessage("unique-id-abc")], repo);
    const record = await repo.findBySourceMessageId("unique-id-abc");
    expect(record?.source_message_id).toBe("unique-id-abc");
  });
});

// ─── processIncomingMessages — mixed valid and invalid ────────────────────────

describe("processIncomingMessages — mixed valid and invalid", () => {
  test("counts valid and invalid separately", async () => {
    const repo = new InMemoryClosedJobRepository();
    const messages = [
      makeValidMessage("msg-1"),
      makeInvalidMessage("bad-1", "not a job message"),
      makeValidMessage("msg-2", { closing: "Sara 150 cash" }),
      makeInvalidMessage("bad-2", "Hey just checking in"),
    ];

    const result = await processIncomingMessages(messages, repo);

    expect(result.processed_count).toBe(4);
    expect(result.saved_count).toBe(2);
    expect(result.invalid_count).toBe(2);
    expect(result.duplicate_count).toBe(0);
  });

  test("invalid_messages entry includes source_message_id, raw_message, and reason", async () => {
    const repo = new InMemoryClosedJobRepository();
    const result = await processIncomingMessages(
      [makeInvalidMessage("bad-1", "no sections here")],
      repo
    );

    expect(result.invalid_messages).toHaveLength(1);
    expect(result.invalid_messages[0].source_message_id).toBe("bad-1");
    expect(result.invalid_messages[0].raw_message).toBe("no sections here");
    expect(typeof result.invalid_messages[0].reason).toBe("string");
    expect(result.invalid_messages[0].reason.length).toBeGreaterThan(0);
  });

  test("does not save invalid messages to the repository", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [makeInvalidMessage("bad-1", "invalid message")],
      repo
    );
    const all = await repo.listAll();
    expect(all).toHaveLength(0);
  });

  test("continues processing after encountering invalid messages", async () => {
    const repo = new InMemoryClosedJobRepository();
    const messages = [
      makeInvalidMessage("bad-1", "invalid"),
      makeValidMessage("msg-1"),
      makeInvalidMessage("bad-2", "also invalid"),
      makeValidMessage("msg-2", { closing: "Mike 700 cc" }),
    ];

    const result = await processIncomingMessages(messages, repo);

    expect(result.saved_count).toBe(2);
    expect(result.invalid_count).toBe(2);

    const all = await repo.listAll();
    expect(all).toHaveLength(2);
  });

  test("message with unknown payment method is collected as invalid", async () => {
    const repo = new InMemoryClosedJobRepository();
    const result = await processIncomingMessages(
      [makeValidMessage("bad-crypto", { closing: "John 999 crypto" })],
      repo
    );

    expect(result.saved_count).toBe(0);
    expect(result.invalid_count).toBe(1);
    expect(result.invalid_messages[0].reason).toContain("crypto");
  });
});

// ─── processIncomingMessages — duplicates ────────────────────────────────────

describe("processIncomingMessages — duplicates", () => {
  test("does not crash when the same source_message_id is submitted twice", async () => {
    const repo = new InMemoryClosedJobRepository();
    const message = makeValidMessage("msg-1");

    await expect(
      processIncomingMessages([message, message], repo)
    ).resolves.not.toThrow();
  });

  test("saves only the first occurrence and counts the second as duplicate", async () => {
    const repo = new InMemoryClosedJobRepository();
    const message = makeValidMessage("msg-1");

    const result = await processIncomingMessages([message, message], repo);

    expect(result.saved_count).toBe(1);
    expect(result.duplicate_count).toBe(1);
    expect(result.duplicate_messages).toHaveLength(1);

    const all = await repo.listAll();
    expect(all).toHaveLength(1);
  });

  test("duplicate_messages entry includes source_message_id and raw_message", async () => {
    const repo = new InMemoryClosedJobRepository();
    const message = makeValidMessage("msg-1");

    const result = await processIncomingMessages([message, message], repo);

    expect(result.duplicate_messages[0].source_message_id).toBe("msg-1");
    expect(result.duplicate_messages[0].raw_message).toBe(message.raw_message);
  });

  test("handles multiple distinct duplicates in one batch", async () => {
    const repo = new InMemoryClosedJobRepository();
    const m1 = makeValidMessage("msg-1");
    const m2 = makeValidMessage("msg-2", { closing: "Mike 700 cc" });

    const result = await processIncomingMessages(
      [m1, m2, m1, m2, m1],
      repo
    );

    expect(result.saved_count).toBe(2);
    expect(result.duplicate_count).toBe(3);

    const all = await repo.listAll();
    expect(all).toHaveLength(2);
  });

  test("message already in repository is a duplicate in a subsequent batch", async () => {
    const repo = new InMemoryClosedJobRepository();
    const message = makeValidMessage("msg-1");

    await processIncomingMessages([message], repo);
    const result = await processIncomingMessages([message], repo);

    expect(result.saved_count).toBe(0);
    expect(result.duplicate_count).toBe(1);
  });
});

// ─── processIncomingMessages — empty input ────────────────────────────────────

describe("processIncomingMessages — empty input", () => {
  test("returns all-zero counts for an empty message list", async () => {
    const repo = new InMemoryClosedJobRepository();
    const result = await processIncomingMessages([], repo);

    expect(result.processed_count).toBe(0);
    expect(result.saved_count).toBe(0);
    expect(result.invalid_count).toBe(0);
    expect(result.duplicate_count).toBe(0);
    expect(result.invalid_messages).toHaveLength(0);
    expect(result.duplicate_messages).toHaveLength(0);
  });
});

// ─── generateFormattedWeeklyReports — empty week ─────────────────────────────

describe("generateFormattedWeeklyReports — empty week", () => {
  test("returns non-empty report text when no jobs exist", async () => {
    const repo = new InMemoryClosedJobRepository();
    const reports = await generateFormattedWeeklyReports(
      repo,
      new Date("2024-01-01"),
      new Date("2024-01-07")
    );

    expect(typeof reports.main_report_text).toBe("string");
    expect(reports.main_report_text.length).toBeGreaterThan(0);
    expect(reports.technician_report_texts).toHaveLength(0);
  });

  test("empty week report shows zero total jobs", async () => {
    const repo = new InMemoryClosedJobRepository();
    const reports = await generateFormattedWeeklyReports(
      repo,
      new Date("2024-01-01"),
      new Date("2024-01-07")
    );

    expect(reports.main_report_text).toContain("Total Jobs: 0");
  });
});

// ─── generateFormattedWeeklyReports — date range filtering ───────────────────

describe("generateFormattedWeeklyReports — date range filtering", () => {
  test("only includes jobs whose created_at falls within the given range", async () => {
    const week1Start = new Date("2024-01-01T00:00:00Z");
    const week1End = new Date("2024-01-07T23:59:59Z");
    const week2Start = new Date("2024-01-08T00:00:00Z");
    const week2End = new Date("2024-01-14T23:59:59Z");

    // Clock returns dates in the order save() is called
    const timestamps = [
      new Date("2024-01-03T10:00:00Z"), // msg-1 → week 1
      new Date("2024-01-10T10:00:00Z"), // msg-2 → week 2
      new Date("2024-01-05T10:00:00Z"), // msg-3 → week 1
    ];
    let tick = 0;
    const repo = new InMemoryClosedJobRepository(() => timestamps[tick++]);

    await processIncomingMessages(
      [
        makeValidMessage("msg-1", { closing: "John $250 check" }),
        makeValidMessage("msg-2", { closing: "Mike 700 cc" }),
        makeValidMessage("msg-3", { closing: "Sara 150 cash" }),
      ],
      repo
    );

    const week1 = await generateFormattedWeeklyReports(repo, week1Start, week1End);
    const week2 = await generateFormattedWeeklyReports(repo, week2Start, week2End);

    expect(week1.main_report_text).toContain("Total Jobs: 2");
    expect(week2.main_report_text).toContain("Total Jobs: 1");
  });

  test("jobs outside the date range do not appear in technician reports", async () => {
    const inRange = new Date("2024-01-03T10:00:00Z");
    const outOfRange = new Date("2024-02-15T10:00:00Z");
    const timestamps = [inRange, outOfRange];
    let tick = 0;
    const repo = new InMemoryClosedJobRepository(() => timestamps[tick++]);

    await processIncomingMessages(
      [
        makeValidMessage("msg-1", { closing: "John $250 check" }),
        makeValidMessage("msg-2", { closing: "Mike 700 cc" }),
      ],
      repo
    );

    const reports = await generateFormattedWeeklyReports(
      repo,
      new Date("2024-01-01"),
      new Date("2024-01-07")
    );

    expect(reports.technician_report_texts).toHaveLength(1);
    expect(reports.technician_report_texts[0].technician_name).toBe("John");
  });
});

// ─── generateFormattedWeeklyReports — formatted output correctness ────────────

describe("generateFormattedWeeklyReports — formatted output", () => {
  async function buildReports(): Promise<ReturnType<typeof generateFormattedWeeklyReports>> {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [
        makeValidMessage("msg-1", { closing: "John $250 check" }),
        makeValidMessage("msg-2", { closing: "Mike 700 cc" }),
        makeValidMessage("msg-3", { closing: "Sara 150 cash" }),
        makeValidMessage("msg-4", { closing: "John $300 zelle" }),
      ],
      repo
    );
    return generateFormattedWeeklyReports(repo, new Date("2000-01-01"), new Date("2099-12-31"));
  }

  test("main report contains correct total jobs count", async () => {
    const reports = await buildReports();
    expect(reports.main_report_text).toContain("Total Jobs: 4");
  });

  test("main report contains correct gross total (250+700+150+300 = 1400)", async () => {
    const reports = await buildReports();
    expect(reports.main_report_text).toContain("$1,400.00");
  });

  test("main report contains all technician names", async () => {
    const reports = await buildReports();
    expect(reports.main_report_text).toContain("John");
    expect(reports.main_report_text).toContain("Mike");
    expect(reports.main_report_text).toContain("Sara");
  });

  test("produces one technician report per unique technician", async () => {
    const reports = await buildReports();
    expect(reports.technician_report_texts).toHaveLength(3);
  });

  test("technician_report_texts includes all expected technician names", async () => {
    const reports = await buildReports();
    const names = reports.technician_report_texts.map((r) => r.technician_name);
    expect(names).toContain("John");
    expect(names).toContain("Mike");
    expect(names).toContain("Sara");
  });

  test("John's technician report shows 2 jobs and $550 total", async () => {
    const reports = await buildReports();
    const john = reports.technician_report_texts.find((r) => r.technician_name === "John");
    expect(john).toBeDefined();
    expect(john!.text).toContain("Total Jobs: 2");
    expect(john!.text).toContain("$550.00");
  });

  test("Mike's technician report shows 1 job and $700 total", async () => {
    const reports = await buildReports();
    const mike = reports.technician_report_texts.find((r) => r.technician_name === "Mike");
    expect(mike).toBeDefined();
    expect(mike!.text).toContain("Total Jobs: 1");
    expect(mike!.text).toContain("$700.00");
  });

  test("each technician report text is a non-empty string", async () => {
    const reports = await buildReports();
    for (const report of reports.technician_report_texts) {
      expect(typeof report.text).toBe("string");
      expect(report.text.length).toBeGreaterThan(0);
    }
  });
});

// ─── full pipeline integration ────────────────────────────────────────────────

describe("full pipeline integration", () => {
  test("invalid messages are not counted in the weekly report", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [
        makeValidMessage("msg-1", { closing: "John $250 check" }),
        makeInvalidMessage("bad-1", "not a job"),
        makeValidMessage("msg-2", { closing: "Mike 700 cc" }),
      ],
      repo
    );

    const reports = await generateFormattedWeeklyReports(
      repo,
      new Date("2000-01-01"),
      new Date("2099-12-31")
    );

    expect(reports.main_report_text).toContain("Total Jobs: 2");
  });

  test("duplicate messages are not double-counted in the weekly report", async () => {
    const repo = new InMemoryClosedJobRepository();
    const message = makeValidMessage("msg-1", { closing: "John $250 check" });

    await processIncomingMessages([message, message], repo);

    const reports = await generateFormattedWeeklyReports(
      repo,
      new Date("2000-01-01"),
      new Date("2099-12-31")
    );

    expect(reports.main_report_text).toContain("Total Jobs: 1");
    expect(reports.main_report_text).toContain("$250.00");
  });

  test("summary counts are consistent (processed = saved + invalid + duplicate)", async () => {
    const repo = new InMemoryClosedJobRepository();
    const message = makeValidMessage("msg-1");
    const messages = [
      message,
      makeValidMessage("msg-2", { closing: "Mike 700 cc" }),
      makeInvalidMessage("bad-1", "garbage"),
      message, // duplicate of msg-1
    ];

    const result = await processIncomingMessages(messages, repo);

    expect(result.processed_count).toBe(4);
    expect(result.saved_count + result.invalid_count + result.duplicate_count).toBe(4);
  });
});
