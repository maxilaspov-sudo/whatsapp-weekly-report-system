import { CommandHandler, CommandContext } from "../../src/commands/commandHandler";
import { parseCommand } from "../../src/commands/commandParser";
import { InMemoryClosedJobRepository } from "../../src/db/inMemoryClosedJobRepository";
import { processIncomingMessages, IncomingMessage } from "../../src/pipeline/weeklyReportPipeline";

// Fixed reference point: Wednesday 2024-01-17 — previous week Mon Jan 8 – Sun Jan 14
const NOW = new Date(2024, 0, 17, 12, 0, 0);
const IN_RANGE = new Date(2024, 0, 10, 10, 0, 0);

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    repository: new InMemoryClosedJobRepository(),
    repositoryType: "in-memory",
    getNow: () => NOW,
    ...overrides,
  };
}

async function cmd(handler: CommandHandler, text: string): Promise<string> {
  const parsed = parseCommand(text);
  if (!parsed) throw new Error(`"${text}" is not a command`);
  return handler.handle(parsed);
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

// ─── .help ────────────────────────────────────────────────────────────────────

describe("CommandHandler — .help", () => {
  test("returns a non-empty string", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".help");
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);
  });

  test("lists all 6 supported commands", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".help");
    for (const name of ["help", "start", "stop", "status", "format", "report"]) {
      expect(response).toContain(`.${name}`);
    }
  });

  test("includes a description for each command", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".help");
    // Each command entry has " — " separating name from description
    expect(response.match(/ — /g)?.length).toBeGreaterThanOrEqual(6);
  });

  test("is case-insensitive (.HELP works)", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".HELP");
    expect(response).toContain(".help");
  });
});

// ─── .start / .stop state ────────────────────────────────────────────────────

describe("CommandHandler — .start", () => {
  test("activates processing state", async () => {
    const handler = new CommandHandler(makeContext());
    expect(handler.isActive()).toBe(false);
    await cmd(handler, ".start");
    expect(handler.isActive()).toBe(true);
  });

  test("returns confirmation text", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".start");
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);
  });

  test("calling .start when already active returns an already-active message", async () => {
    const handler = new CommandHandler(makeContext());
    await cmd(handler, ".start");
    const second = await cmd(handler, ".start");
    expect(second.toLowerCase()).toContain("already");
    expect(handler.isActive()).toBe(true);
  });
});

describe("CommandHandler — .stop", () => {
  test("deactivates processing state", async () => {
    const handler = new CommandHandler(makeContext());
    await cmd(handler, ".start");
    await cmd(handler, ".stop");
    expect(handler.isActive()).toBe(false);
  });

  test("returns confirmation text", async () => {
    const handler = new CommandHandler(makeContext());
    await cmd(handler, ".start");
    const response = await cmd(handler, ".stop");
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);
  });

  test("calling .stop when already inactive returns an already-inactive message", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".stop");
    expect(response.toLowerCase()).toContain("already");
    expect(handler.isActive()).toBe(false);
  });

  test("start → stop → start cycle works correctly", async () => {
    const handler = new CommandHandler(makeContext());
    await cmd(handler, ".start");
    expect(handler.isActive()).toBe(true);
    await cmd(handler, ".stop");
    expect(handler.isActive()).toBe(false);
    await cmd(handler, ".start");
    expect(handler.isActive()).toBe(true);
  });
});

// ─── .status ──────────────────────────────────────────────────────────────────

describe("CommandHandler — .status", () => {
  test("shows 'inactive' when not started", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".status");
    expect(response.toLowerCase()).toContain("inactive");
  });

  test("shows 'active' after .start", async () => {
    const handler = new CommandHandler(makeContext());
    await cmd(handler, ".start");
    const response = await cmd(handler, ".status");
    expect(response.toLowerCase()).toContain("active");
  });

  test("shows 'inactive' after .start then .stop", async () => {
    const handler = new CommandHandler(makeContext());
    await cmd(handler, ".start");
    await cmd(handler, ".stop");
    const response = await cmd(handler, ".status");
    expect(response.toLowerCase()).toContain("inactive");
  });

  test("includes the repository type", async () => {
    const handler = new CommandHandler(makeContext({ repositoryType: "supabase" }));
    const response = await cmd(handler, ".status");
    expect(response).toContain("supabase");
  });

  test("includes cron schedule information", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".status");
    expect(response.toLowerCase()).toContain("monday");
  });
});

// ─── .format ─────────────────────────────────────────────────────────────────

describe("CommandHandler — .format", () => {
  test("returns a non-empty string", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".format");
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);
  });

  test("includes key field labels", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".format");
    expect(response).toContain("Name:");
    expect(response).toContain("Phone:");
    expect(response).toContain("Address:");
    expect(response).toContain("Job type:");
    expect(response).toContain("Appointment");
  });

  test("includes payment method examples", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".format");
    expect(response).toContain("check");
    expect(response).toContain("cc");
    expect(response).toContain("cash");
  });

  test("includes a closing-line example with amount", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".format");
    expect(response).toContain("$");
  });

  test("uses COMPANY_NAME env var when set", async () => {
    const original = process.env.COMPANY_NAME;
    process.env.COMPANY_NAME = "Acme Field Services";
    try {
      const handler = new CommandHandler(makeContext());
      const response = await cmd(handler, ".format");
      expect(response).toContain("Acme Field Services");
    } finally {
      if (original === undefined) delete process.env.COMPANY_NAME;
      else process.env.COMPANY_NAME = original;
    }
  });

  test("falls back to placeholder when COMPANY_NAME is not set", async () => {
    const original = process.env.COMPANY_NAME;
    delete process.env.COMPANY_NAME;
    try {
      const handler = new CommandHandler(makeContext());
      const response = await cmd(handler, ".format");
      expect(response).toContain("[Company Name]");
    } finally {
      if (original !== undefined) process.env.COMPANY_NAME = original;
    }
  });
});

// ─── .report ─────────────────────────────────────────────────────────────────

describe("CommandHandler — .report (empty week)", () => {
  test("resolves without throwing", async () => {
    const handler = new CommandHandler(makeContext());
    await expect(cmd(handler, ".report")).resolves.toBeTruthy();
  });

  test("response contains 'Total Jobs: 0' for an empty week", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".report");
    expect(response).toContain("Total Jobs: 0");
  });

  test("response contains the week date range", async () => {
    const handler = new CommandHandler(makeContext());
    const response = await cmd(handler, ".report");
    // Week range is Jan 8 – Jan 14, 2024
    expect(response).toContain("Jan");
    expect(response).toContain("2024");
  });
});

describe("CommandHandler — .report (with jobs)", () => {
  async function contextWithJobs(): Promise<CommandContext> {
    const repo = new InMemoryClosedJobRepository(() => IN_RANGE);
    await processIncomingMessages(
      [
        makeMessage("msg-1", "John $250 check"),
        makeMessage("msg-2", "Mike 700 cc"),
        makeMessage("msg-3", "Sara 150 cash"),
      ],
      repo
    );
    return makeContext({ repository: repo });
  }

  test("response contains correct total job count", async () => {
    const context = await contextWithJobs();
    const handler = new CommandHandler(context);
    const response = await cmd(handler, ".report");
    expect(response).toContain("Total Jobs: 3");
  });

  test("response contains correct gross total", async () => {
    const context = await contextWithJobs();
    const handler = new CommandHandler(context);
    const response = await cmd(handler, ".report");
    // 250 + 700 + 150 = 1100
    expect(response).toContain("$1,100.00");
  });

  test("response contains technician names", async () => {
    const context = await contextWithJobs();
    const handler = new CommandHandler(context);
    const response = await cmd(handler, ".report");
    expect(response).toContain("John");
    expect(response).toContain("Mike");
    expect(response).toContain("Sara");
  });
});

describe("CommandHandler — .report (repository error)", () => {
  test("returns an error message instead of throwing when repository fails", async () => {
    const failingRepo = {
      save: jest.fn().mockRejectedValue(new Error("DB down")),
      findByDateRange: jest.fn().mockRejectedValue(new Error("DB down")),
      findBySourceMessageId: jest.fn().mockRejectedValue(new Error("DB down")),
      listAll: jest.fn().mockRejectedValue(new Error("DB down")),
    };
    const context = makeContext({
      repository: failingRepo as unknown as ReturnType<typeof makeContext>["repository"],
    });
    const handler = new CommandHandler(context);
    const response = await cmd(handler, ".report");
    expect(response.toLowerCase()).toContain("failed");
  });
});

// ─── unknown command ──────────────────────────────────────────────────────────

describe("CommandHandler — unknown command", () => {
  test("returns a message mentioning the unknown command", async () => {
    const handler = new CommandHandler(makeContext());
    const parsed = parseCommand(".xyz");
    const response = await handler.handle(parsed!);
    expect(response).toContain(".xyz");
  });

  test("response directs user to .help", async () => {
    const handler = new CommandHandler(makeContext());
    const parsed = parseCommand(".xyz");
    const response = await handler.handle(parsed!);
    expect(response).toContain(".help");
  });

  test("unknown command does not crash or throw", async () => {
    const handler = new CommandHandler(makeContext());
    const parsed = parseCommand(".gibberish");
    await expect(handler.handle(parsed!)).resolves.toBeTruthy();
  });
});

// ─── response type invariants ─────────────────────────────────────────────────

describe("CommandHandler — all commands return strings", () => {
  const commands = [".help", ".start", ".stop", ".status", ".format", ".xyz"];

  test.each(commands)("%s resolves to a non-empty string", async (text) => {
    const handler = new CommandHandler(makeContext());
    const parsed = parseCommand(text)!;
    const response = await handler.handle(parsed);
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);
  });
});
