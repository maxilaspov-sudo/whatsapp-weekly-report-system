import { ConsoleReportSender } from "../../src/sender/consoleReportSender";
import { ReportSender } from "../../src/sender/reportSender";

const MAIN_REPORT = "WEEKLY CLOSED JOBS REPORT\nTotal Jobs: 3\nTotal Gross: $1,100.00";
const TECH_REPORT = "TECHNICIAN WEEKLY REPORT\nTechnician: John\nTotal Jobs: 2";

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── interface compliance ─────────────────────────────────────────────────────

describe("ConsoleReportSender — interface compliance", () => {
  test("is assignable to ReportSender", () => {
    const sender: ReportSender = new ConsoleReportSender();
    expect(sender).toBeDefined();
  });

  test("sendMainReport returns a Promise", () => {
    const sender = new ConsoleReportSender();
    const result = sender.sendMainReport(MAIN_REPORT, "manager");
    expect(result).toBeInstanceOf(Promise);
    return result;
  });

  test("sendTechnicianReport returns a Promise", () => {
    const sender = new ConsoleReportSender();
    const result = sender.sendTechnicianReport(TECH_REPORT, "John", "john-recipient");
    expect(result).toBeInstanceOf(Promise);
    return result;
  });
});

// ─── sendMainReport ───────────────────────────────────────────────────────────

describe("ConsoleReportSender.sendMainReport", () => {
  test("resolves without throwing", async () => {
    const sender = new ConsoleReportSender();
    await expect(sender.sendMainReport(MAIN_REPORT, "manager")).resolves.toBeUndefined();
  });

  test("calls console.log", async () => {
    const sender = new ConsoleReportSender();
    await sender.sendMainReport(MAIN_REPORT, "manager");
    expect(console.log).toHaveBeenCalled();
  });

  test("logs the recipient", async () => {
    const sender = new ConsoleReportSender();
    await sender.sendMainReport(MAIN_REPORT, "the-manager");
    const calls = (console.log as jest.Mock).mock.calls.flat().join("\n");
    expect(calls).toContain("the-manager");
  });

  test("logs the report text", async () => {
    const sender = new ConsoleReportSender();
    await sender.sendMainReport(MAIN_REPORT, "manager");
    const calls = (console.log as jest.Mock).mock.calls.flat().join("\n");
    expect(calls).toContain(MAIN_REPORT);
  });

  test("works with an empty recipient string", async () => {
    const sender = new ConsoleReportSender();
    await expect(sender.sendMainReport(MAIN_REPORT, "")).resolves.toBeUndefined();
  });

  test("works with an empty report string", async () => {
    const sender = new ConsoleReportSender();
    await expect(sender.sendMainReport("", "manager")).resolves.toBeUndefined();
  });

  test("can be called multiple times without error", async () => {
    const sender = new ConsoleReportSender();
    await sender.sendMainReport(MAIN_REPORT, "manager-1");
    await sender.sendMainReport(MAIN_REPORT, "manager-2");
    expect(console.log).toHaveBeenCalledTimes(8); // 4 log calls per send (divider, header, divider, text)
  });
});

// ─── sendTechnicianReport ─────────────────────────────────────────────────────

describe("ConsoleReportSender.sendTechnicianReport", () => {
  test("resolves without throwing", async () => {
    const sender = new ConsoleReportSender();
    await expect(
      sender.sendTechnicianReport(TECH_REPORT, "John", "john-recipient")
    ).resolves.toBeUndefined();
  });

  test("calls console.log", async () => {
    const sender = new ConsoleReportSender();
    await sender.sendTechnicianReport(TECH_REPORT, "John", "john-recipient");
    expect(console.log).toHaveBeenCalled();
  });

  test("logs the technician name", async () => {
    const sender = new ConsoleReportSender();
    await sender.sendTechnicianReport(TECH_REPORT, "John", "john-recipient");
    const calls = (console.log as jest.Mock).mock.calls.flat().join("\n");
    expect(calls).toContain("John");
  });

  test("logs the recipient", async () => {
    const sender = new ConsoleReportSender();
    await sender.sendTechnicianReport(TECH_REPORT, "John", "john-recipient");
    const calls = (console.log as jest.Mock).mock.calls.flat().join("\n");
    expect(calls).toContain("john-recipient");
  });

  test("logs the report text", async () => {
    const sender = new ConsoleReportSender();
    await sender.sendTechnicianReport(TECH_REPORT, "John", "john-recipient");
    const calls = (console.log as jest.Mock).mock.calls.flat().join("\n");
    expect(calls).toContain(TECH_REPORT);
  });

  test("works with an empty recipient string", async () => {
    const sender = new ConsoleReportSender();
    await expect(
      sender.sendTechnicianReport(TECH_REPORT, "John", "")
    ).resolves.toBeUndefined();
  });

  test("different instances are independent", async () => {
    const sender1 = new ConsoleReportSender();
    const sender2 = new ConsoleReportSender();
    await sender1.sendTechnicianReport(TECH_REPORT, "John", "r1");
    await sender2.sendTechnicianReport(TECH_REPORT, "Mike", "r2");
    const calls = (console.log as jest.Mock).mock.calls.flat().join("\n");
    expect(calls).toContain("John");
    expect(calls).toContain("Mike");
  });
});

// ─── separation of concerns ───────────────────────────────────────────────────

describe("ConsoleReportSender — separation of concerns", () => {
  test("sendMainReport output does not contain technician report header", async () => {
    const sender = new ConsoleReportSender();
    await sender.sendMainReport(MAIN_REPORT, "manager");
    const calls = (console.log as jest.Mock).mock.calls.flat().join("\n");
    expect(calls).not.toContain("Technician report (");
  });

  test("sendTechnicianReport output contains technician report label", async () => {
    const sender = new ConsoleReportSender();
    await sender.sendTechnicianReport(TECH_REPORT, "Sara", "sara-recipient");
    const calls = (console.log as jest.Mock).mock.calls.flat().join("\n");
    expect(calls).toContain("Technician report (Sara)");
  });
});
