import { lookupGroup, GroupConfig } from "../../src/config/groupRegistry";

const GROUP_A = "120363111111111@g.us";
const GROUP_B = "120363222222222@g.us";
const REGISTRY = `${GROUP_A}:company-alpha,${GROUP_B}:company-beta`;

// ─── basic lookup ─────────────────────────────────────────────────────────────

describe("lookupGroup — basic lookup", () => {
  test("returns GroupConfig for a registered group", () => {
    const result = lookupGroup(GROUP_A, REGISTRY);
    expect(result).not.toBeNull();
  });

  test("returns correct company_id for Group A", () => {
    const result = lookupGroup(GROUP_A, REGISTRY);
    expect(result?.company_id).toBe("company-alpha");
  });

  test("returns correct company_id for Group B", () => {
    const result = lookupGroup(GROUP_B, REGISTRY);
    expect(result?.company_id).toBe("company-beta");
  });

  test("returns null for an unregistered group", () => {
    const result = lookupGroup("unknown-group@g.us", REGISTRY);
    expect(result).toBeNull();
  });

  test("returns null when registry is empty string", () => {
    expect(lookupGroup(GROUP_A, "")).toBeNull();
  });

  test("returns null when registry is whitespace only", () => {
    expect(lookupGroup(GROUP_A, "   ")).toBeNull();
  });

  test("returns null when registry is undefined and GROUP_REGISTRY env is not set", () => {
    const saved = process.env.GROUP_REGISTRY;
    delete process.env.GROUP_REGISTRY;
    try {
      expect(lookupGroup(GROUP_A)).toBeNull();
    } finally {
      if (saved !== undefined) process.env.GROUP_REGISTRY = saved;
    }
  });
});

// ─── whitespace tolerance ─────────────────────────────────────────────────────

describe("lookupGroup — whitespace tolerance", () => {
  test("trims spaces around group ID", () => {
    const registry = ` ${GROUP_A} :company-alpha`;
    expect(lookupGroup(GROUP_A, registry)?.company_id).toBe("company-alpha");
  });

  test("trims spaces around company ID", () => {
    const registry = `${GROUP_A}: company-alpha `;
    expect(lookupGroup(GROUP_A, registry)?.company_id).toBe("company-alpha");
  });

  test("trims spaces around entries separated by commas", () => {
    const registry = ` ${GROUP_A}:co-a , ${GROUP_B}:co-b `;
    expect(lookupGroup(GROUP_A, registry)?.company_id).toBe("co-a");
    expect(lookupGroup(GROUP_B, registry)?.company_id).toBe("co-b");
  });
});

// ─── malformed entries ────────────────────────────────────────────────────────

describe("lookupGroup — malformed entries", () => {
  test("skips entries that have no colon", () => {
    const registry = `bad-entry,${GROUP_A}:company-alpha`;
    expect(lookupGroup(GROUP_A, registry)?.company_id).toBe("company-alpha");
  });

  test("skips entries with empty company ID", () => {
    const registry = `${GROUP_A}:`;
    expect(lookupGroup(GROUP_A, registry)).toBeNull();
  });

  test("returns null for partial match (prefix of group ID)", () => {
    const registry = `${GROUP_A}:company-alpha`;
    expect(lookupGroup(GROUP_A.slice(0, -4), registry)).toBeNull();
  });
});

// ─── single-entry registry ────────────────────────────────────────────────────

describe("lookupGroup — single-entry registry", () => {
  test("works with one entry (no commas)", () => {
    const result = lookupGroup(GROUP_A, `${GROUP_A}:only-company`);
    expect(result?.company_id).toBe("only-company");
  });

  test("returns null for any group when only one is registered", () => {
    const result = lookupGroup(GROUP_B, `${GROUP_A}:only-company`);
    expect(result).toBeNull();
  });
});

// ─── process.env fallback ─────────────────────────────────────────────────────

describe("lookupGroup — reads from process.env.GROUP_REGISTRY", () => {
  test("uses GROUP_REGISTRY env var when registryEnv param is omitted", () => {
    const saved = process.env.GROUP_REGISTRY;
    process.env.GROUP_REGISTRY = REGISTRY;
    try {
      const result = lookupGroup(GROUP_A);
      expect(result?.company_id).toBe("company-alpha");
    } finally {
      if (saved === undefined) delete process.env.GROUP_REGISTRY;
      else process.env.GROUP_REGISTRY = saved;
    }
  });
});

// ─── return type ─────────────────────────────────────────────────────────────

describe("lookupGroup — return type", () => {
  test("returned object satisfies GroupConfig interface", () => {
    const result = lookupGroup(GROUP_A, REGISTRY);
    expect(result).not.toBeNull();
    expect(typeof (result as GroupConfig).company_id).toBe("string");
    expect(Array.isArray((result as GroupConfig).authorized_admin_ids)).toBe(true);
  });
});

// ─── authorized_admin_ids ─────────────────────────────────────────────────────

describe("lookupGroup — authorized_admin_ids", () => {
  const ADMIN_A1 = "1111111111@c.us";
  const ADMIN_A2 = "2222222222@c.us";
  const ADMIN_B = "3333333333@c.us";
  const ADMINS = `${GROUP_A}:${ADMIN_A1}|${ADMIN_A2},${GROUP_B}:${ADMIN_B}`;

  test("returns multiple admin IDs for Group A", () => {
    const result = lookupGroup(GROUP_A, REGISTRY, ADMINS);
    expect(result?.authorized_admin_ids).toEqual([ADMIN_A1, ADMIN_A2]);
  });

  test("returns single admin ID for Group B", () => {
    const result = lookupGroup(GROUP_B, REGISTRY, ADMINS);
    expect(result?.authorized_admin_ids).toEqual([ADMIN_B]);
  });

  test("returns empty array when adminsEnv is empty string", () => {
    const result = lookupGroup(GROUP_A, REGISTRY, "");
    expect(result?.authorized_admin_ids).toEqual([]);
  });

  test("returns empty array when group is not in adminsEnv", () => {
    const admins = `${GROUP_B}:${ADMIN_B}`;
    const result = lookupGroup(GROUP_A, REGISTRY, admins);
    expect(result?.authorized_admin_ids).toEqual([]);
  });

  test("authorized_admin_ids is always an array (never undefined or null)", () => {
    const result = lookupGroup(GROUP_A, REGISTRY, "");
    expect(Array.isArray(result?.authorized_admin_ids)).toBe(true);
  });

  test("trims whitespace around individual admin IDs", () => {
    const admins = `${GROUP_A}: ${ADMIN_A1} | ${ADMIN_A2} `;
    const result = lookupGroup(GROUP_A, REGISTRY, admins);
    expect(result?.authorized_admin_ids).toEqual([ADMIN_A1, ADMIN_A2]);
  });

  test("skips empty segments after pipe split", () => {
    const admins = `${GROUP_A}:${ADMIN_A1}||`;
    const result = lookupGroup(GROUP_A, REGISTRY, admins);
    expect(result?.authorized_admin_ids).toEqual([ADMIN_A1]);
  });

  test("reads GROUP_ADMINS from process.env when adminsEnv param is omitted", () => {
    const saved = process.env.GROUP_ADMINS;
    process.env.GROUP_ADMINS = `${GROUP_A}:${ADMIN_A1}`;
    try {
      const result = lookupGroup(GROUP_A, REGISTRY);
      expect(result?.authorized_admin_ids).toEqual([ADMIN_A1]);
    } finally {
      if (saved === undefined) delete process.env.GROUP_ADMINS;
      else process.env.GROUP_ADMINS = saved;
    }
  });

  test("returns empty array when GROUP_ADMINS env is not set and adminsEnv omitted", () => {
    const saved = process.env.GROUP_ADMINS;
    delete process.env.GROUP_ADMINS;
    try {
      const result = lookupGroup(GROUP_A, REGISTRY);
      expect(result?.authorized_admin_ids).toEqual([]);
    } finally {
      if (saved !== undefined) process.env.GROUP_ADMINS = saved;
    }
  });
});
