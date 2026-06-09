import {
  isAdminCommand,
  checkCommandAccess,
  ADMIN_COMMANDS,
  PUBLIC_COMMANDS,
} from "../../src/commands/accessControl";
import type { GroupConfig } from "../../src/config/groupRegistry";

const ADMIN = "1234567890@c.us";
const NON_ADMIN = "9999999999@c.us";

const REGISTERED_GROUP: GroupConfig = {
  company_id: "test-company",
  authorized_admin_ids: [ADMIN],
};

const EMPTY_ADMINS: GroupConfig = {
  company_id: "test-company",
  authorized_admin_ids: [],
};

// ─── ADMIN_COMMANDS / PUBLIC_COMMANDS sets ────────────────────────────────────

describe("ADMIN_COMMANDS / PUBLIC_COMMANDS classification", () => {
  test("ADMIN_COMMANDS contains exactly start, stop, status, report", () => {
    expect([...ADMIN_COMMANDS].sort()).toEqual(["report", "start", "status", "stop"]);
  });

  test("PUBLIC_COMMANDS contains exactly help and format", () => {
    expect([...PUBLIC_COMMANDS].sort()).toEqual(["format", "help"]);
  });

  test("ADMIN_COMMANDS and PUBLIC_COMMANDS are disjoint", () => {
    for (const cmd of ADMIN_COMMANDS) {
      expect(PUBLIC_COMMANDS.has(cmd)).toBe(false);
    }
  });
});

// ─── isAdminCommand ───────────────────────────────────────────────────────────

describe("isAdminCommand", () => {
  test.each(["start", "stop", "status", "report"])(
    "%s is an admin command",
    (cmd) => {
      expect(isAdminCommand(cmd)).toBe(true);
    }
  );

  test.each(["help", "format"])(
    "%s is NOT an admin command",
    (cmd) => {
      expect(isAdminCommand(cmd)).toBe(false);
    }
  );

  test("unknown command is treated as non-admin (returns false)", () => {
    expect(isAdminCommand("xyz")).toBe(false);
    expect(isAdminCommand("")).toBe(false);
    expect(isAdminCommand("REPORT")).toBe(false); // case-sensitive; parser normalises first
  });
});

// ─── checkCommandAccess — private chat ───────────────────────────────────────

describe("checkCommandAccess — private chat (isGroupChat = false)", () => {
  test("admin command in private chat → private_chat", () => {
    const d = checkCommandAccess("start", false, REGISTERED_GROUP, ADMIN);
    expect(d.granted).toBe(false);
    if (!d.granted) expect(d.reason).toBe("private_chat");
  });

  test("public command in private chat → private_chat", () => {
    const d = checkCommandAccess("help", false, REGISTERED_GROUP, ADMIN);
    expect(d.granted).toBe(false);
    if (!d.granted) expect(d.reason).toBe("private_chat");
  });

  test("private chat check short-circuits even when groupConfig is null", () => {
    const d = checkCommandAccess("help", false, null, ADMIN);
    expect(d.granted).toBe(false);
    if (!d.granted) expect(d.reason).toBe("private_chat");
  });

  test("private chat check short-circuits even for non-admin sender", () => {
    const d = checkCommandAccess("start", false, REGISTERED_GROUP, NON_ADMIN);
    expect(d.granted).toBe(false);
    if (!d.granted) expect(d.reason).toBe("private_chat");
  });
});

// ─── checkCommandAccess — unregistered group ─────────────────────────────────

describe("checkCommandAccess — unregistered group (groupConfig = null)", () => {
  test("admin command → unregistered_group", () => {
    const d = checkCommandAccess("start", true, null, ADMIN);
    expect(d.granted).toBe(false);
    if (!d.granted) expect(d.reason).toBe("unregistered_group");
  });

  test("public command in unregistered group → unregistered_group", () => {
    const d = checkCommandAccess("help", true, null, NON_ADMIN);
    expect(d.granted).toBe(false);
    if (!d.granted) expect(d.reason).toBe("unregistered_group");
  });
});

// ─── checkCommandAccess — public commands in registered group ─────────────────

describe("checkCommandAccess — public commands", () => {
  test("help → granted for any sender in registered group", () => {
    expect(checkCommandAccess("help", true, REGISTERED_GROUP, NON_ADMIN).granted).toBe(true);
  });

  test("format → granted for any sender in registered group", () => {
    expect(checkCommandAccess("format", true, REGISTERED_GROUP, NON_ADMIN).granted).toBe(true);
  });

  test("public command granted even when authorized_admin_ids is empty", () => {
    expect(checkCommandAccess("help", true, EMPTY_ADMINS, NON_ADMIN).granted).toBe(true);
  });

  test("public command granted for the admin sender too", () => {
    expect(checkCommandAccess("help", true, REGISTERED_GROUP, ADMIN).granted).toBe(true);
  });
});

// ─── checkCommandAccess — admin commands: authorized ─────────────────────────

describe("checkCommandAccess — admin commands: authorized sender", () => {
  test.each(["start", "stop", "status", "report"])(
    ".%s → granted for admin",
    (cmd) => {
      expect(checkCommandAccess(cmd, true, REGISTERED_GROUP, ADMIN).granted).toBe(true);
    }
  );

  test("second admin in a multi-admin list is also granted", () => {
    const multi: GroupConfig = {
      company_id: "test",
      authorized_admin_ids: [ADMIN, "2222222222@c.us"],
    };
    expect(checkCommandAccess("start", true, multi, "2222222222@c.us").granted).toBe(true);
  });

  test("first admin in a multi-admin list is still granted", () => {
    const multi: GroupConfig = {
      company_id: "test",
      authorized_admin_ids: [ADMIN, "2222222222@c.us"],
    };
    expect(checkCommandAccess("report", true, multi, ADMIN).granted).toBe(true);
  });
});

// ─── checkCommandAccess — admin commands: unauthorized ───────────────────────

describe("checkCommandAccess — admin commands: unauthorized sender", () => {
  test.each(["start", "stop", "status", "report"])(
    ".%s → access_denied for non-admin",
    (cmd) => {
      const d = checkCommandAccess(cmd, true, REGISTERED_GROUP, NON_ADMIN);
      expect(d.granted).toBe(false);
      if (!d.granted) expect(d.reason).toBe("access_denied");
    }
  );

  test("empty authorized_admin_ids → access_denied for any sender", () => {
    const d = checkCommandAccess("start", true, EMPTY_ADMINS, ADMIN);
    expect(d.granted).toBe(false);
    if (!d.granted) expect(d.reason).toBe("access_denied");
  });

  test("unknown command is treated as public → granted for non-admin", () => {
    expect(checkCommandAccess("xyz", true, REGISTERED_GROUP, NON_ADMIN).granted).toBe(true);
  });

  test("non-admin in a multi-admin group is still denied", () => {
    const multi: GroupConfig = {
      company_id: "test",
      authorized_admin_ids: [ADMIN, "2222222222@c.us"],
    };
    const d = checkCommandAccess("start", true, multi, NON_ADMIN);
    expect(d.granted).toBe(false);
    if (!d.granted) expect(d.reason).toBe("access_denied");
  });
});

// ─── isolation: same sender, different groups ─────────────────────────────────

describe("checkCommandAccess — cross-group isolation", () => {
  test("admin in Group A is not automatically admin in Group B", () => {
    const groupB: GroupConfig = {
      company_id: "company-b",
      authorized_admin_ids: ["9876543210@c.us"], // different admin
    };
    // ADMIN is an admin in REGISTERED_GROUP but not in groupB
    const d = checkCommandAccess("start", true, groupB, ADMIN);
    expect(d.granted).toBe(false);
    if (!d.granted) expect(d.reason).toBe("access_denied");
  });
});

// ─── reply message constants ──────────────────────────────────────────────────

describe("ACCESS_DENIED and UNREGISTERED reply text contracts", () => {
  test("access_denied reason is the literal string 'access_denied'", () => {
    const d = checkCommandAccess("start", true, REGISTERED_GROUP, NON_ADMIN);
    if (!d.granted) expect(d.reason).toBe("access_denied");
  });

  test("unregistered_group reason is the literal string 'unregistered_group'", () => {
    const d = checkCommandAccess("start", true, null, NON_ADMIN);
    if (!d.granted) expect(d.reason).toBe("unregistered_group");
  });

  test("private_chat reason is the literal string 'private_chat'", () => {
    const d = checkCommandAccess("start", false, null, NON_ADMIN);
    if (!d.granted) expect(d.reason).toBe("private_chat");
  });
});
