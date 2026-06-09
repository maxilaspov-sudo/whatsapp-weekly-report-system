/**
 * Phase 16 group isolation tests.
 *
 * Critical requirement: a report MUST NEVER include jobs from a different
 * WhatsApp group or company.
 */

import { InMemoryClosedJobRepository } from "../../src/db/inMemoryClosedJobRepository";
import {
  processIncomingMessages,
  generateFormattedWeeklyReports,
  IncomingMessage,
} from "../../src/pipeline/weeklyReportPipeline";
import { lookupGroup } from "../../src/config/groupRegistry";

const GROUP_A = "120363111111111@g.us";
const GROUP_B = "120363222222222@g.us";
const GROUP_C = "120363333333333@g.us";
const COMPANY_A = "company-alpha";
const COMPANY_B = "company-beta";

const ALWAYS = new Date("2000-01-01");
const NEVER = new Date("2099-12-31");

function makeMessage(
  id: string,
  whatsapp_group_id: string,
  company_id: string,
  closing = "John $250 check"
): IncomingMessage {
  return {
    source_message_id: id,
    whatsapp_group_id,
    company_id,
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

// ─── findByDateRangeForGroup isolation ────────────────────────────────────────

describe("findByDateRangeForGroup — group isolation", () => {
  test("returns only records whose whatsapp_group_id matches", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [
        makeMessage("msg-a1", GROUP_A, COMPANY_A, "John $100 check"),
        makeMessage("msg-b1", GROUP_B, COMPANY_B, "Mike $200 cc"),
        makeMessage("msg-a2", GROUP_A, COMPANY_A, "Sara $300 cash"),
      ],
      repo
    );

    const groupARecords = await repo.findByDateRangeForGroup(ALWAYS, NEVER, GROUP_A);
    const groupBRecords = await repo.findByDateRangeForGroup(ALWAYS, NEVER, GROUP_B);

    expect(groupARecords).toHaveLength(2);
    expect(groupBRecords).toHaveLength(1);
  });

  test("Group A records do not appear in Group B result", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [
        makeMessage("msg-a1", GROUP_A, COMPANY_A, "John $100 check"),
        makeMessage("msg-b1", GROUP_B, COMPANY_B, "Mike $200 cc"),
      ],
      repo
    );

    const groupBRecords = await repo.findByDateRangeForGroup(ALWAYS, NEVER, GROUP_B);
    const ids = groupBRecords.map((r) => r.source_message_id);
    expect(ids).not.toContain("msg-a1");
  });

  test("Group B records do not appear in Group A result", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [
        makeMessage("msg-a1", GROUP_A, COMPANY_A, "John $100 check"),
        makeMessage("msg-b1", GROUP_B, COMPANY_B, "Mike $200 cc"),
      ],
      repo
    );

    const groupARecords = await repo.findByDateRangeForGroup(ALWAYS, NEVER, GROUP_A);
    const ids = groupARecords.map((r) => r.source_message_id);
    expect(ids).not.toContain("msg-b1");
  });

  test("returns empty array for a group with no saved jobs", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [makeMessage("msg-a1", GROUP_A, COMPANY_A)],
      repo
    );
    const result = await repo.findByDateRangeForGroup(ALWAYS, NEVER, GROUP_B);
    expect(result).toHaveLength(0);
  });

  test("returns empty for an unregistered group ID even if records exist", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [makeMessage("msg-a1", GROUP_A, COMPANY_A)],
      repo
    );
    const result = await repo.findByDateRangeForGroup(ALWAYS, NEVER, GROUP_C);
    expect(result).toEqual([]);
  });
});

// ─── generateFormattedWeeklyReports isolation ────────────────────────────────

describe("generateFormattedWeeklyReports — group-scoped totals", () => {
  test("Group A report shows only Group A job totals", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [
        makeMessage("msg-a1", GROUP_A, COMPANY_A, "John $100 check"),
        makeMessage("msg-a2", GROUP_A, COMPANY_A, "Mike $200 cc"),
        makeMessage("msg-b1", GROUP_B, COMPANY_B, "Sara $9999 cash"),
      ],
      repo
    );

    const reportA = await generateFormattedWeeklyReports(repo, ALWAYS, NEVER, GROUP_A);
    expect(reportA.main_report_text).toContain("Total Jobs: 2");
    expect(reportA.main_report_text).not.toContain("9999");
  });

  test("Group B report shows only Group B job totals", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [
        makeMessage("msg-a1", GROUP_A, COMPANY_A, "John $9999 check"),
        makeMessage("msg-b1", GROUP_B, COMPANY_B, "Mike $300 cc"),
      ],
      repo
    );

    const reportB = await generateFormattedWeeklyReports(repo, ALWAYS, NEVER, GROUP_B);
    expect(reportB.main_report_text).toContain("Total Jobs: 1");
    expect(reportB.main_report_text).not.toContain("9999");
  });

  test("correct gross total per group", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [
        makeMessage("msg-a1", GROUP_A, COMPANY_A, "John $250 check"),
        makeMessage("msg-a2", GROUP_A, COMPANY_A, "John $150 cash"),
        makeMessage("msg-b1", GROUP_B, COMPANY_B, "Sara $9999 cc"),
      ],
      repo
    );

    const reportA = await generateFormattedWeeklyReports(repo, ALWAYS, NEVER, GROUP_A);
    // Group A total: 250 + 150 = 400
    expect(reportA.main_report_text).toContain("$400.00");
  });

  test("technician names from other groups do not appear in report", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [
        makeMessage("msg-a1", GROUP_A, COMPANY_A, "Alice $250 check"),
        makeMessage("msg-b1", GROUP_B, COMPANY_B, "Bob $300 cc"),
      ],
      repo
    );

    const reportA = await generateFormattedWeeklyReports(repo, ALWAYS, NEVER, GROUP_A);
    expect(reportA.main_report_text).toContain("Alice");
    expect(reportA.main_report_text).not.toContain("Bob");
  });

  test("three groups remain fully isolated", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [
        makeMessage("msg-a1", GROUP_A, COMPANY_A, "John $100 check"),
        makeMessage("msg-b1", GROUP_B, COMPANY_B, "Mike $200 cc"),
        makeMessage("msg-c1", GROUP_C, "company-gamma", "Sara $300 cash"),
      ],
      repo
    );

    const [rA, rB, rC] = await Promise.all([
      generateFormattedWeeklyReports(repo, ALWAYS, NEVER, GROUP_A),
      generateFormattedWeeklyReports(repo, ALWAYS, NEVER, GROUP_B),
      generateFormattedWeeklyReports(repo, ALWAYS, NEVER, GROUP_C),
    ]);

    expect(rA.main_report_text).toContain("Total Jobs: 1");
    expect(rB.main_report_text).toContain("Total Jobs: 1");
    expect(rC.main_report_text).toContain("Total Jobs: 1");
  });
});

// ─── unregistered group rejection ────────────────────────────────────────────

describe("lookupGroup — unregistered group rejection", () => {
  const REGISTRY = `${GROUP_A}:${COMPANY_A},${GROUP_B}:${COMPANY_B}`;

  test("registered Group A is found", () => {
    expect(lookupGroup(GROUP_A, REGISTRY)).not.toBeNull();
  });

  test("registered Group B is found", () => {
    expect(lookupGroup(GROUP_B, REGISTRY)).not.toBeNull();
  });

  test("unregistered Group C returns null", () => {
    expect(lookupGroup(GROUP_C, REGISTRY)).toBeNull();
  });

  test("completely unknown group ID returns null", () => {
    expect(lookupGroup("9999999999@g.us", REGISTRY)).toBeNull();
  });

  test("empty group ID returns null", () => {
    expect(lookupGroup("", REGISTRY)).toBeNull();
  });
});

// ─── duplicate source_message_id safety across groups ────────────────────────

describe("duplicate source_message_id safety", () => {
  test("same source_message_id from two different groups is rejected as duplicate", async () => {
    const repo = new InMemoryClosedJobRepository();

    // First message from Group A with this ID
    const first = await processIncomingMessages(
      [makeMessage("shared-id", GROUP_A, COMPANY_A, "John $100 check")],
      repo
    );
    expect(first.saved_count).toBe(1);

    // Second message from Group B with the same ID — must be treated as duplicate
    const second = await processIncomingMessages(
      [makeMessage("shared-id", GROUP_B, COMPANY_B, "Mike $200 cc")],
      repo
    );
    expect(second.saved_count).toBe(0);
    expect(second.duplicate_count).toBe(1);
  });

  test("only the first save is persisted when IDs collide across groups", async () => {
    const repo = new InMemoryClosedJobRepository();

    await processIncomingMessages(
      [makeMessage("shared-id", GROUP_A, COMPANY_A, "John $100 check")],
      repo
    );
    await processIncomingMessages(
      [makeMessage("shared-id", GROUP_B, COMPANY_B, "Mike $200 cc")],
      repo
    );

    const all = await repo.listAll();
    expect(all).toHaveLength(1);
    expect(all[0].whatsapp_group_id).toBe(GROUP_A);
  });

  test("distinct source_message_ids from different groups are both saved", async () => {
    const repo = new InMemoryClosedJobRepository();

    await processIncomingMessages(
      [
        makeMessage("id-a", GROUP_A, COMPANY_A, "John $100 check"),
        makeMessage("id-b", GROUP_B, COMPANY_B, "Mike $200 cc"),
      ],
      repo
    );

    const all = await repo.listAll();
    expect(all).toHaveLength(2);
  });
});

// ─── saved record fields ──────────────────────────────────────────────────────

describe("processIncomingMessages — group fields on saved records", () => {
  test("saved record carries whatsapp_group_id from IncomingMessage", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [makeMessage("msg-1", GROUP_A, COMPANY_A)],
      repo
    );
    const record = await repo.findBySourceMessageId("msg-1");
    expect(record?.whatsapp_group_id).toBe(GROUP_A);
  });

  test("saved record carries company_id from IncomingMessage", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [makeMessage("msg-1", GROUP_A, COMPANY_A)],
      repo
    );
    const record = await repo.findBySourceMessageId("msg-1");
    expect(record?.company_id).toBe(COMPANY_A);
  });

  test("company_id and company_name are independent fields", async () => {
    const repo = new InMemoryClosedJobRepository();
    await processIncomingMessages(
      [makeMessage("msg-1", GROUP_A, COMPANY_A)],
      repo
    );
    const record = await repo.findBySourceMessageId("msg-1");
    // company_id comes from IncomingMessage.company_id (registry)
    expect(record?.company_id).toBe(COMPANY_A);
    // company_name comes from the parsed message header
    expect(record?.company_name).toBe("Test Company");
  });
});
