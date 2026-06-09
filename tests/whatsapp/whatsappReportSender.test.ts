import path from "path";
import fs from "fs";
import os from "os";
import WAWebJS from "whatsapp-web.js";
import { WhatsAppReportSender, PdfReportSender } from "../../src/whatsapp/whatsappReportSender";
import { CommandHandler, CommandContext } from "../../src/commands/commandHandler";
import { parseCommand } from "../../src/commands/commandParser";
import { InMemoryClosedJobRepository } from "../../src/db/inMemoryClosedJobRepository";
import { processIncomingMessages, IncomingMessage } from "../../src/pipeline/weeklyReportPipeline";
import { generateWeeklyReport } from "../../src/reports/weeklyReportGenerator";
import { generateWeeklyReportPdf } from "../../src/pdf/pdfReportGenerator";

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_CHAT_ID = "test-group@g.us";
// Reference: Wed 2024-01-17 → previous week Mon Jan 8 – Sun Jan 14
const NOW = new Date(2024, 0, 17, 12, 0, 0);
const IN_RANGE = new Date(2024, 0, 10, 10, 0, 0);
const WEEK_START = new Date(2024, 0, 8, 0, 0, 0, 0);
const WEEK_END = new Date(2024, 0, 14, 23, 59, 59, 999);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeJobMessage(id: string, closing = "DemoTech $250 check"): IncomingMessage {
  return {
    source_message_id: id,
    whatsapp_group_id: TEST_CHAT_ID,
    company_id: "demo-company",
    raw_message: [
      "Example Service Company",
      "",
      "Name: Demo Customer",
      "Phone: (555) 000-0000",
      "Address: 123 Demo Street, Demo City, FL 00000",
      "Job type: Dryer vent cleaning",
      "Appointment Monday @ 9am",
      "",
      closing,
    ].join("\n"),
  };
}

function makeMockClient(): { client: WAWebJS.Client; sendMessage: jest.Mock } {
  const sendMessage = jest.fn().mockResolvedValue({ id: { _serialized: "sent-id" } });
  return { client: { sendMessage } as unknown as WAWebJS.Client, sendMessage };
}

async function makeRepoWithJobs(): Promise<InMemoryClosedJobRepository> {
  const repo = new InMemoryClosedJobRepository(() => IN_RANGE);
  await processIncomingMessages(
    [
      makeJobMessage("msg-1", "DemoTech $250 check"),
      makeJobMessage("msg-2", "DemoTech2 300 cash"),
    ],
    repo
  );
  return repo;
}

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    repository: new InMemoryClosedJobRepository(),
    repositoryType: "in-memory",
    whatsapp_group_id: TEST_CHAT_ID,
    company_id: "demo-company",
    getNow: () => NOW,
    ...overrides,
  };
}

async function cmd(handler: CommandHandler, text: string): Promise<string> {
  const parsed = parseCommand(text);
  if (!parsed) throw new Error(`"${text}" is not a valid command`);
  return handler.handle(parsed);
}

// ─── Temp dir + real PDF fixture ─────────────────────────────────────────────

let tmpDir: string;
let realPdfPath: string;

beforeAll(async () => {
  tmpDir = path.join(os.tmpdir(), `sender-test-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  // Pre-generate a valid (empty) PDF so tests that mock the generator can
  // still pass a real file to MessageMedia.fromFilePath().
  const emptyReport = generateWeeklyReport([]);
  realPdfPath = await generateWeeklyReportPdf(emptyReport, WEEK_START, WEEK_END, {
    outputDir: tmpDir,
    compress: false,
  });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── WhatsAppReportSender — sendReportWithPdf ─────────────────────────────────

describe("WhatsAppReportSender — sendReportWithPdf", () => {
  test("calls sendMessage twice (summary text + PDF media)", async () => {
    const { client, sendMessage } = makeMockClient();
    const mockGenerator = jest.fn().mockResolvedValue(realPdfPath);
    const sender = new WhatsAppReportSender(client, tmpDir, mockGenerator);
    const repo = await makeRepoWithJobs();

    await sender.sendReportWithPdf(TEST_CHAT_ID, repo, WEEK_START, WEEK_END);

    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  test("second sendMessage call carries a MessageMedia instance (the PDF)", async () => {
    const { client, sendMessage } = makeMockClient();
    const mockGenerator = jest.fn().mockResolvedValue(realPdfPath);
    const sender = new WhatsAppReportSender(client, tmpDir, mockGenerator);
    const repo = await makeRepoWithJobs();

    await sender.sendReportWithPdf(TEST_CHAT_ID, repo, WEEK_START, WEEK_END);

    const mediaArg: unknown = sendMessage.mock.calls[1][1];
    expect(mediaArg).toBeInstanceOf(WAWebJS.MessageMedia);
  });

  test("all sendMessage calls target the correct chatId (group isolation)", async () => {
    const { client, sendMessage } = makeMockClient();
    const mockGenerator = jest.fn().mockResolvedValue(realPdfPath);
    const sender = new WhatsAppReportSender(client, tmpDir, mockGenerator);
    const repo = await makeRepoWithJobs();

    await sender.sendReportWithPdf(TEST_CHAT_ID, repo, WEEK_START, WEEK_END);

    for (const call of sendMessage.mock.calls) {
      expect(call[0]).toBe(TEST_CHAT_ID);
    }
  });

  test("queries repository with the correct chatId for group isolation", async () => {
    const { client } = makeMockClient();
    const mockGenerator = jest.fn().mockResolvedValue(realPdfPath);
    const sender = new WhatsAppReportSender(client, tmpDir, mockGenerator);
    const repo = await makeRepoWithJobs();
    const spy = jest.spyOn(repo, "findByDateRangeForGroup");

    await sender.sendReportWithPdf(TEST_CHAT_ID, repo, WEEK_START, WEEK_END);

    expect(spy).toHaveBeenCalledWith(WEEK_START, WEEK_END, TEST_CHAT_ID);
  });

  test("throws 'Failed to generate report PDF.' when PDF generation fails", async () => {
    const { client } = makeMockClient();
    const failingGenerator = jest.fn().mockRejectedValue(new Error("disk full"));
    const sender = new WhatsAppReportSender(client, tmpDir, failingGenerator);
    const repo = new InMemoryClosedJobRepository();

    await expect(
      sender.sendReportWithPdf(TEST_CHAT_ID, repo, WEEK_START, WEEK_END)
    ).rejects.toThrow("Failed to generate report PDF.");
  });

  test("throws 'Failed to send report.' when WhatsApp PDF send fails", async () => {
    const { client, sendMessage } = makeMockClient();
    // First call (summary text) resolves; second call (PDF media) rejects
    sendMessage
      .mockResolvedValueOnce({ id: { _serialized: "ok" } })
      .mockRejectedValueOnce(new Error("network timeout"));
    const mockGenerator = jest.fn().mockResolvedValue(realPdfPath);
    const sender = new WhatsAppReportSender(client, tmpDir, mockGenerator);
    const repo = await makeRepoWithJobs();

    await expect(
      sender.sendReportWithPdf(TEST_CHAT_ID, repo, WEEK_START, WEEK_END)
    ).rejects.toThrow("Failed to send report.");
  });

  test("empty repository still generates and sends PDF without throwing", async () => {
    const { client, sendMessage } = makeMockClient();
    const sender = new WhatsAppReportSender(client, tmpDir); // uses real PDF generator
    const repo = new InMemoryClosedJobRepository();

    await expect(
      sender.sendReportWithPdf(TEST_CHAT_ID, repo, WEEK_START, WEEK_END)
    ).resolves.not.toThrow();
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});

// ─── WhatsAppReportSender — ReportSender interface ────────────────────────────

describe("WhatsAppReportSender — ReportSender interface", () => {
  test("sendMainReport calls sendMessage with report text and recipient", async () => {
    const { client, sendMessage } = makeMockClient();
    const sender = new WhatsAppReportSender(client, tmpDir);

    await sender.sendMainReport("Total Jobs: 3", "manager@c.us");

    expect(sendMessage).toHaveBeenCalledWith("manager@c.us", "Total Jobs: 3");
  });

  test("sendTechnicianReport calls sendMessage with report text and recipient", async () => {
    const { client, sendMessage } = makeMockClient();
    const sender = new WhatsAppReportSender(client, tmpDir);

    await sender.sendTechnicianReport("Tech report text", "DemoTech", "tech@c.us");

    expect(sendMessage).toHaveBeenCalledWith("tech@c.us", "Tech report text");
  });
});

// ─── CommandHandler — .report with pdfReportSender ───────────────────────────

describe("CommandHandler — .report with pdfReportSender", () => {
  function makeMockPdfSender(): { sender: PdfReportSender; sendFn: jest.Mock } {
    const sendFn = jest.fn().mockResolvedValue(undefined);
    return { sender: { sendReportWithPdf: sendFn }, sendFn };
  }

  test("calls pdfReportSender.sendReportWithPdf when sender is present in context", async () => {
    const { sender, sendFn } = makeMockPdfSender();
    const handler = new CommandHandler(makeContext({ pdfReportSender: sender }));

    await cmd(handler, ".report");

    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  test("passes the handler's whatsapp_group_id as chatId", async () => {
    const { sender, sendFn } = makeMockPdfSender();
    const handler = new CommandHandler(makeContext({ pdfReportSender: sender }));

    await cmd(handler, ".report");

    expect(sendFn.mock.calls[0][0]).toBe(TEST_CHAT_ID);
  });

  test("returns 'PDF report sent.' on success", async () => {
    const { sender } = makeMockPdfSender();
    const handler = new CommandHandler(makeContext({ pdfReportSender: sender }));

    const response = await cmd(handler, ".report");

    expect(response).toBe("PDF report sent.");
  });

  test("returns 'Failed to generate report PDF.' when PDF generation fails", async () => {
    const sendFn = jest
      .fn()
      .mockRejectedValue(new Error("Failed to generate report PDF."));
    const handler = new CommandHandler(
      makeContext({ pdfReportSender: { sendReportWithPdf: sendFn } })
    );

    const response = await cmd(handler, ".report");

    expect(response).toBe("Failed to generate report PDF.");
  });

  test("returns 'Failed to send report.' when WhatsApp send fails", async () => {
    const sendFn = jest
      .fn()
      .mockRejectedValue(new Error("Failed to send report."));
    const handler = new CommandHandler(
      makeContext({ pdfReportSender: { sendReportWithPdf: sendFn } })
    );

    const response = await cmd(handler, ".report");

    expect(response).toBe("Failed to send report.");
  });

  test("falls back to text report when no pdfReportSender in context (unauthorized user path)", async () => {
    const handler = new CommandHandler(makeContext()); // listener never injects pdfReportSender for unauthorized users

    const response = await cmd(handler, ".report");

    expect(response).toContain("Total Jobs: 0");
    expect(response).not.toBe("PDF report sent.");
  });

  test("pdfReportSender receives week date range derived from getNow()", async () => {
    const { sender, sendFn } = makeMockPdfSender();
    const handler = new CommandHandler(makeContext({ pdfReportSender: sender }));

    await cmd(handler, ".report");

    // NOW = Wed 2024-01-17 → previous week Mon Jan 8 – Sun Jan 14
    const [, , startArg, endArg]: [string, unknown, Date, Date] = sendFn.mock.calls[0];
    expect(startArg.getFullYear()).toBe(2024);
    expect(startArg.getMonth()).toBe(0); // January
    expect(startArg.getDate()).toBe(8);
    expect(endArg.getDate()).toBe(14);
  });
});
