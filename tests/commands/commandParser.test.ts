import {
  parseCommand,
  SUPPORTED_COMMANDS,
  SupportedCommand,
} from "../../src/commands/commandParser";

// ─── non-commands ─────────────────────────────────────────────────────────────

describe("parseCommand — non-commands", () => {
  test("plain text returns null", () => {
    expect(parseCommand("hello")).toBeNull();
  });

  test("empty string returns null", () => {
    expect(parseCommand("")).toBeNull();
  });

  test("whitespace-only string returns null", () => {
    expect(parseCommand("   ")).toBeNull();
  });

  test("job message (does not start with '.') returns null", () => {
    expect(parseCommand("John $250 check")).toBeNull();
  });

  test("lone '.' returns null", () => {
    expect(parseCommand(".")).toBeNull();
  });

  test("'. ' (dot + only spaces) returns null", () => {
    expect(parseCommand(".   ")).toBeNull();
  });
});

// ─── recognised supported commands ───────────────────────────────────────────

describe("parseCommand — supported commands", () => {
  test.each(SUPPORTED_COMMANDS)(".%s returns correct command name", (name) => {
    const result = parseCommand(`.${name}`);
    expect(result).not.toBeNull();
    expect(result!.command).toBe(name);
    expect(result!.args).toHaveLength(0);
  });
});

// ─── case insensitivity ───────────────────────────────────────────────────────

describe("parseCommand — case insensitivity", () => {
  test(".HELP is normalised to 'help'", () => {
    expect(parseCommand(".HELP")!.command).toBe("help");
  });

  test(".REPORT is normalised to 'report'", () => {
    expect(parseCommand(".REPORT")!.command).toBe("report");
  });

  test(".Start is normalised to 'start'", () => {
    expect(parseCommand(".Start")!.command).toBe("start");
  });

  test(".STATUS is normalised to 'status'", () => {
    expect(parseCommand(".STATUS")!.command).toBe("status");
  });

  test(".FoRmAt is normalised to 'format'", () => {
    expect(parseCommand(".FoRmAt")!.command).toBe("format");
  });
});

// ─── whitespace handling ──────────────────────────────────────────────────────

describe("parseCommand — whitespace handling", () => {
  test("leading and trailing whitespace around message is stripped", () => {
    const result = parseCommand("  .help  ");
    expect(result).not.toBeNull();
    expect(result!.command).toBe("help");
  });

  test("space between dot and command name is handled", () => {
    const result = parseCommand(". help");
    expect(result).not.toBeNull();
    expect(result!.command).toBe("help");
  });

  test("multiple spaces between dot and command are collapsed", () => {
    const result = parseCommand(".   report");
    expect(result).not.toBeNull();
    expect(result!.command).toBe("report");
  });
});

// ─── arguments ────────────────────────────────────────────────────────────────

describe("parseCommand — arguments", () => {
  test("args is empty when no tokens follow the command", () => {
    expect(parseCommand(".help")!.args).toEqual([]);
  });

  test("single arg is captured", () => {
    expect(parseCommand(".report weekly")!.args).toEqual(["weekly"]);
  });

  test("multiple args are captured in order", () => {
    expect(parseCommand(".report last week")!.args).toEqual(["last", "week"]);
  });

  test("extra whitespace between args is collapsed", () => {
    expect(parseCommand(".report   last   week")!.args).toEqual(["last", "week"]);
  });

  test("args are NOT lowercased", () => {
    expect(parseCommand(".report LAST")!.args).toEqual(["LAST"]);
  });
});

// ─── unknown commands ─────────────────────────────────────────────────────────

describe("parseCommand — unknown commands", () => {
  test("unknown command is returned (parser does not filter)", () => {
    const result = parseCommand(".xyz");
    expect(result).not.toBeNull();
    expect(result!.command).toBe("xyz");
  });

  test("unknown command with args is returned", () => {
    const result = parseCommand(".doSomething arg1 arg2");
    expect(result).not.toBeNull();
    expect(result!.command).toBe("dosomething");
    expect(result!.args).toEqual(["arg1", "arg2"]);
  });
});

// ─── SUPPORTED_COMMANDS completeness ─────────────────────────────────────────

describe("SUPPORTED_COMMANDS", () => {
  test("contains exactly 6 entries", () => {
    expect(SUPPORTED_COMMANDS).toHaveLength(6);
  });

  test("contains all expected command names", () => {
    const expected: SupportedCommand[] = [
      "help", "start", "stop", "status", "format", "report",
    ];
    for (const name of expected) {
      expect(SUPPORTED_COMMANDS).toContain(name);
    }
  });
});
