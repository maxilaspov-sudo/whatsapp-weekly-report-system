import cron from "node-cron";
import {
  WEEKLY_CRON_EXPRESSION,
  executeWeeklyReport,
} from "../../src/scheduler/weeklyCron";
import { InMemoryClosedJobRepository } from "../../src/db/inMemoryClosedJobRepository";
import { ReportSender } from "../../src/sender/reportSender";
import {
  processIncomingMessages,
  IncomingMessage,
} from "../../src/pipeline/weeklyReportPipeline";

// Wednesday 2024-01-17 at 09:00 local — previous week is Mon Jan 8 – Sun Jan 14
const NOW = new Date(2024, 0, 17, 9, 0, 0);
const IN_RANGE = new Date(2024, 0, 10, 10, 0, 0); // within previous week

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeMockSender() {
  const sendMainReport = jest.fn().mockResolvedValue(undefined);
  const sendTechnicianReport = jest.fn().mockResolvedValue(undefined);
  // Cast via unknown: established pattern for test mocks in this codebase
  const sender = { sendMainReport, sendTechnicianReport } as unknown as ReportSender;
  return { sender, sendMainReport, sendTechnicianReport };
}

function makeMessage(id: string, closing = "John $250 check"): IncomingMessage {
  return {
    source_message_id: id,
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

async function repoWithJobs(
  closings: string[],
  clock: () => Date = () => IN_RANGE
): Promise<InMemoryClosedJobRepository> {
  const repo = new InMemoryClosedJobRepository(clock);
  await processIncomingMessages(
    closings.map((c, i) => makeMessage(`msg-${i + 1}`, c)),
    repo
  );
  return repo;
}

// ─── cron expression ─────────────────────────────────────────────────────────

describe("WEEKLY_CRON_EXPRESSION", () => {
  test("is the exact string '0 9 * * 1' (Monday at 09:00)", () => {
    expect(WEEKLY_CRON_EXPRESSION).toBe("0 9 * * 1");
  });

  test("is recognised as valid by node-cron", () => {
    expect(cron.validate(WEEKLY_CRON_EXPRESSION)).toBe(true);
  });
});

// ─── executeWeeklyReport — empty week ────────────────────────────────────────

describe("executeWeeklyReport — empty week", () => {
  test("resolves without throwing", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { sender } = makeMockSender();
    await expect(
      executeWeeklyReport(repo, sender, "manager", "default-tech", NOW)
    ).resolves.toBeUndefined();
  });

  test("calls sendMainReport exactly once even with no jobs", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { sender, sendMainReport } = makeMockSender();
    await executeWeeklyReport(repo, sender, "manager", "default-tech", NOW);
    expect(sendMainReport).toHaveBeenCalledTimes(1);
  });

  test("does not call sendTechnicianReport when no jobs exist", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { sender, sendTechnicianReport } = makeMockSender();
    await executeWeeklyReport(repo, sender, "manager", "default-tech", NOW);
    expect(sendTechnicianReport).not.toHaveBeenCalled();
  });
});

// ─── executeWeeklyReport — manager report ────────────────────────────────────

describe("executeWeeklyReport — manager report", () => {
  test("passes the correct manager recipient to sendMainReport", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { sender, sendMainReport } = makeMockSender();
    await executeWeeklyReport(repo, sender, "the-manager", "default-tech", NOW);
    expect(sendMainReport).toHaveBeenCalledWith(expect.any(String), "the-manager");
  });

  test("sendMainReport receives a non-empty string as report text", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { sender, sendMainReport } = makeMockSender();
    await executeWeeklyReport(repo, sender, "manager", "default-tech", NOW);
    const [reportText] = sendMainReport.mock.calls[0] as [string, string];
    expect(typeof reportText).toBe("string");
    expect(reportText.length).toBeGreaterThan(0);
  });

  test("empty-week report text contains 'Total Jobs: 0'", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { sender, sendMainReport } = makeMockSender();
    await executeWeeklyReport(repo, sender, "manager", "default-tech", NOW);
    const [reportText] = sendMainReport.mock.calls[0] as [string, string];
    expect(reportText).toContain("Total Jobs: 0");
  });

  test("report text with jobs contains correct total", async () => {
    const repo = await repoWithJobs(["John $250 check", "Mike 700 cc"]);
    const { sender, sendMainReport } = makeMockSender();
    await executeWeeklyReport(repo, sender, "manager", "default-tech", NOW);
    const [reportText] = sendMainReport.mock.calls[0] as [string, string];
    expect(reportText).toContain("Total Jobs: 2");
    expect(reportText).toContain("$950.00");
  });
});

// ─── executeWeeklyReport — technician reports ────────────────────────────────

describe("executeWeeklyReport — technician reports", () => {
  test("calls sendTechnicianReport once per unique technician", async () => {
    const repo = await repoWithJobs([
      "John $250 check",
      "Mike 700 cc",
      "Sara 150 cash",
    ]);
    const { sender, sendTechnicianReport } = makeMockSender();
    await executeWeeklyReport(repo, sender, "manager", "default-tech", NOW);
    expect(sendTechnicianReport).toHaveBeenCalledTimes(3);
  });

  test("every technician report uses the default tech recipient", async () => {
    const repo = await repoWithJobs([
      "John $250 check",
      "Mike 700 cc",
    ]);
    const { sender, sendTechnicianReport } = makeMockSender();
    await executeWeeklyReport(repo, sender, "manager", "tech-default", NOW);
    const recipients = (sendTechnicianReport.mock.calls as [string, string, string][]).map(
      ([, , r]) => r
    );
    expect(recipients.every((r) => r === "tech-default")).toBe(true);
  });

  test("technician names are forwarded correctly", async () => {
    const repo = await repoWithJobs([
      "John $250 check",
      "Mike 700 cc",
      "Sara 150 cash",
    ]);
    const { sender, sendTechnicianReport } = makeMockSender();
    await executeWeeklyReport(repo, sender, "manager", "default-tech", NOW);
    const names = (sendTechnicianReport.mock.calls as [string, string, string][]).map(
      ([, name]) => name
    );
    expect(names).toContain("John");
    expect(names).toContain("Mike");
    expect(names).toContain("Sara");
  });

  test("sendMainReport is called exactly once regardless of technician count", async () => {
    const repo = await repoWithJobs([
      "John $250 check",
      "Mike 700 cc",
      "Sara 150 cash",
    ]);
    const { sender, sendMainReport } = makeMockSender();
    await executeWeeklyReport(repo, sender, "manager", "default-tech", NOW);
    expect(sendMainReport).toHaveBeenCalledTimes(1);
  });

  test("each technician report text is a non-empty string", async () => {
    const repo = await repoWithJobs([
      "John $250 check",
      "Mike 700 cc",
    ]);
    const { sender, sendTechnicianReport } = makeMockSender();
    await executeWeeklyReport(repo, sender, "manager", "default-tech", NOW);
    for (const [text] of sendTechnicianReport.mock.calls as [string, string, string][]) {
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

// ─── executeWeeklyReport — error isolation ────────────────────────────────────

describe("executeWeeklyReport — error isolation", () => {
  test("does not throw if sendMainReport rejects", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { sender, sendMainReport } = makeMockSender();
    sendMainReport.mockRejectedValue(new Error("network error"));
    await expect(
      executeWeeklyReport(repo, sender, "manager", "default-tech", NOW)
    ).resolves.toBeUndefined();
  });

  test("remaining technician sends proceed after one sendTechnicianReport rejects", async () => {
    const repo = await repoWithJobs([
      "John $250 check",
      "Mike 700 cc",
      "Sara 150 cash",
    ]);
    const { sender, sendTechnicianReport } = makeMockSender();
    sendTechnicianReport
      .mockRejectedValueOnce(new Error("send failed"))
      .mockResolvedValue(undefined);

    await expect(
      executeWeeklyReport(repo, sender, "manager", "default-tech", NOW)
    ).resolves.toBeUndefined();

    expect(sendTechnicianReport).toHaveBeenCalledTimes(3);
  });

  test("resolves even if every send call rejects", async () => {
    const repo = await repoWithJobs(["John $250 check"]);
    const { sender, sendMainReport, sendTechnicianReport } = makeMockSender();
    sendMainReport.mockRejectedValue(new Error("main fail"));
    sendTechnicianReport.mockRejectedValue(new Error("tech fail"));

    await expect(
      executeWeeklyReport(repo, sender, "manager", "default-tech", NOW)
    ).resolves.toBeUndefined();
  });

  test("sends after a rejected send still receive the correct arguments", async () => {
    const repo = await repoWithJobs([
      "John $250 check",
      "Mike 700 cc",
    ]);
    const { sender, sendTechnicianReport } = makeMockSender();
    sendTechnicianReport
      .mockRejectedValueOnce(new Error("first failed"))
      .mockResolvedValue(undefined);

    await executeWeeklyReport(repo, sender, "manager", "default-tech", NOW);

    // Second call still receives the correct arguments
    const secondCall = sendTechnicianReport.mock.calls[1] as [string, string, string];
    expect(typeof secondCall[0]).toBe("string"); // report text
    expect(typeof secondCall[1]).toBe("string"); // technician name
    expect(secondCall[2]).toBe("default-tech");  // recipient
  });
});

// ─── executeWeeklyReport — recipients from env ────────────────────────────────

describe("executeWeeklyReport — recipient forwarding", () => {
  test("empty string recipient is forwarded without error", async () => {
    const repo = new InMemoryClosedJobRepository();
    const { sender, sendMainReport } = makeMockSender();
    await executeWeeklyReport(repo, sender, "", "", NOW);
    expect(sendMainReport).toHaveBeenCalledWith(expect.any(String), "");
  });
});
