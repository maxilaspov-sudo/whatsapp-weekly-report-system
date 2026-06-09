import { InMemoryClosedJobRepository } from "../../src/db/inMemoryClosedJobRepository";
import { NewClosedJob, ClosedJobRecord } from "../../src/db/types";

// ─── factory ─────────────────────────────────────────────────────────────────

let msgCounter = 0;

function makeJob(overrides: Partial<NewClosedJob> = {}): NewClosedJob {
  msgCounter += 1;
  return {
    source_message_id: `msg-${msgCounter}`,
    raw_message: "raw message text",
    company_id: "test-company",
    whatsapp_group_id: "test-group@g.us",
    company_name: "Example Service Company",
    customer_name: "Demo Customer",
    phone: "(555) 000-0000",
    address: "123 Demo Street, Demo City, FL 00000",
    service: "Dryer vent cleaning",
    appointment: "Tuesday 02/06 @ 9am - 11am",
    technician_name: "John",
    closed_amount: 250,
    payment_method: "Check",
    needs_review: false,
    ...overrides,
  };
}

beforeEach(() => {
  msgCounter = 0;
});

// ─── save — success ──────────────────────────────────────────────────────────

describe("save — success", () => {
  test("returns ok: true with a record", async () => {
    const repo = new InMemoryClosedJobRepository();
    const result = await repo.save(makeJob());
    expect(result.ok).toBe(true);
  });

  test("record has a non-empty generated id", async () => {
    const repo = new InMemoryClosedJobRepository();
    const result = await repo.save(makeJob());
    if (!result.ok) throw new Error("expected ok");
    expect(typeof result.record.id).toBe("string");
    expect(result.record.id.length).toBeGreaterThan(0);
  });

  test("each save produces a unique id", async () => {
    const repo = new InMemoryClosedJobRepository();
    const r1 = await repo.save(makeJob());
    const r2 = await repo.save(makeJob());
    if (!r1.ok || !r2.ok) throw new Error("expected ok");
    expect(r1.record.id).not.toBe(r2.record.id);
  });

  test("record has created_at set", async () => {
    const fixed = new Date("2024-06-01T10:00:00Z");
    const repo = new InMemoryClosedJobRepository(() => fixed);
    const result = await repo.save(makeJob());
    if (!result.ok) throw new Error("expected ok");
    expect(result.record.created_at).toEqual(fixed);
  });

  test("all input fields are preserved on the record", async () => {
    const repo = new InMemoryClosedJobRepository();
    const job = makeJob({
      source_message_id: "wa-abc-123",
      raw_message: "the full original message",
      company_id: "acme-hvac",
      whatsapp_group_id: "group-123@g.us",
      company_name: "Acme HVAC",
      customer_name: "Demo Customer 2",
      phone: "(555) 000-0002",
      address: "456 Demo Avenue, Demo City, FL 00001",
      service: "AC service",
      appointment: "Wednesday 02/07 @ 1pm - 3pm",
      technician_name: "Mike",
      closed_amount: 700,
      payment_method: "Credit Card",
      needs_review: true,
    });
    const result = await repo.save(job);
    if (!result.ok) throw new Error("expected ok");
    const r = result.record;

    expect(r.source_message_id).toBe("wa-abc-123");
    expect(r.raw_message).toBe("the full original message");
    expect(r.company_id).toBe("acme-hvac");
    expect(r.whatsapp_group_id).toBe("group-123@g.us");
    expect(r.company_name).toBe("Acme HVAC");
    expect(r.customer_name).toBe("Demo Customer 2");
    expect(r.phone).toBe("(555) 000-0002");
    expect(r.address).toBe("456 Demo Avenue, Demo City, FL 00001");
    expect(r.service).toBe("AC service");
    expect(r.appointment).toBe("Wednesday 02/07 @ 1pm - 3pm");
    expect(r.technician_name).toBe("Mike");
    expect(r.closed_amount).toBe(700);
    expect(r.payment_method).toBe("Credit Card");
    expect(r.needs_review).toBe(true);
  });

  test("raw_message is always preserved verbatim", async () => {
    const repo = new InMemoryClosedJobRepository();
    const raw = "Sunshine Home Services\n\nName: X\nPhone: 555\nAddress: Y\n\nJohn 100 cash";
    const result = await repo.save(makeJob({ raw_message: raw }));
    if (!result.ok) throw new Error("expected ok");
    expect(result.record.raw_message).toBe(raw);
  });

  test("needs_review: false is preserved", async () => {
    const repo = new InMemoryClosedJobRepository();
    const result = await repo.save(makeJob({ needs_review: false }));
    if (!result.ok) throw new Error("expected ok");
    expect(result.record.needs_review).toBe(false);
  });

  test("needs_review: true is preserved", async () => {
    const repo = new InMemoryClosedJobRepository();
    const result = await repo.save(makeJob({ needs_review: true }));
    if (!result.ok) throw new Error("expected ok");
    expect(result.record.needs_review).toBe(true);
  });
});

// ─── save — duplicate prevention ─────────────────────────────────────────────

describe("save — duplicate source_message_id", () => {
  test("returns ok: false with DUPLICATE_SOURCE_MESSAGE_ID", async () => {
    const repo = new InMemoryClosedJobRepository();
    await repo.save(makeJob({ source_message_id: "dup-id" }));
    const result = await repo.save(makeJob({ source_message_id: "dup-id" }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toBe("DUPLICATE_SOURCE_MESSAGE_ID");
  });

  test("original record is not overwritten after duplicate attempt", async () => {
    const repo = new InMemoryClosedJobRepository();
    await repo.save(makeJob({ source_message_id: "dup-id", technician_name: "John" }));
    await repo.save(makeJob({ source_message_id: "dup-id", technician_name: "Mike" }));
    const record = await repo.findBySourceMessageId("dup-id");
    expect(record?.technician_name).toBe("John");
  });

  test("different source_message_ids do not conflict", async () => {
    const repo = new InMemoryClosedJobRepository();
    const r1 = await repo.save(makeJob({ source_message_id: "id-1" }));
    const r2 = await repo.save(makeJob({ source_message_id: "id-2" }));
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });
});

// ─── listAll ─────────────────────────────────────────────────────────────────

describe("listAll", () => {
  test("returns empty array from empty repository", async () => {
    const repo = new InMemoryClosedJobRepository();
    expect(await repo.listAll()).toEqual([]);
  });

  test("returns all saved records", async () => {
    const repo = new InMemoryClosedJobRepository();
    await repo.save(makeJob());
    await repo.save(makeJob());
    await repo.save(makeJob());
    expect(await repo.listAll()).toHaveLength(3);
  });

  test("count matches number of successful saves", async () => {
    const repo = new InMemoryClosedJobRepository();
    await repo.save(makeJob({ source_message_id: "a" }));
    await repo.save(makeJob({ source_message_id: "a" })); // duplicate — skipped
    await repo.save(makeJob({ source_message_id: "b" }));
    expect(await repo.listAll()).toHaveLength(2);
  });

  test("preserves insertion order", async () => {
    const repo = new InMemoryClosedJobRepository();
    await repo.save(makeJob({ source_message_id: "first",  technician_name: "Alice" }));
    await repo.save(makeJob({ source_message_id: "second", technician_name: "Bob"   }));
    await repo.save(makeJob({ source_message_id: "third",  technician_name: "Carol" }));
    const all = await repo.listAll();
    expect(all[0].technician_name).toBe("Alice");
    expect(all[1].technician_name).toBe("Bob");
    expect(all[2].technician_name).toBe("Carol");
  });
});

// ─── findBySourceMessageId ────────────────────────────────────────────────────

describe("findBySourceMessageId", () => {
  test("returns null when repository is empty", async () => {
    const repo = new InMemoryClosedJobRepository();
    expect(await repo.findBySourceMessageId("missing")).toBeNull();
  });

  test("returns null when id does not match any record", async () => {
    const repo = new InMemoryClosedJobRepository();
    await repo.save(makeJob({ source_message_id: "real-id" }));
    expect(await repo.findBySourceMessageId("other-id")).toBeNull();
  });

  test("returns the matching record", async () => {
    const repo = new InMemoryClosedJobRepository();
    await repo.save(makeJob({ source_message_id: "wa-999", technician_name: "Sara" }));
    const record = await repo.findBySourceMessageId("wa-999");
    expect(record).not.toBeNull();
    expect(record?.technician_name).toBe("Sara");
    expect(record?.source_message_id).toBe("wa-999");
  });

  test("returned record contains all saved fields", async () => {
    const repo = new InMemoryClosedJobRepository();
    const job = makeJob({ source_message_id: "full-check", closed_amount: 1250.5, needs_review: true });
    await repo.save(job);
    const record = await repo.findBySourceMessageId("full-check");
    expect(record?.closed_amount).toBe(1250.5);
    expect(record?.needs_review).toBe(true);
  });
});

// ─── findByDateRange ─────────────────────────────────────────────────────────

describe("findByDateRange", () => {
  function makeTimedRepo() {
    let current = new Date("2024-01-10T00:00:00Z");
    const repo = new InMemoryClosedJobRepository(() => new Date(current));
    const setDate = (iso: string) => { current = new Date(iso); };
    return { repo, setDate };
  }

  test("returns empty array when repository is empty", async () => {
    const repo = new InMemoryClosedJobRepository();
    const results = await repo.findByDateRange(
      new Date("2024-01-01"),
      new Date("2024-12-31")
    );
    expect(results).toEqual([]);
  });

  test("returns only records within the date range", async () => {
    const { repo, setDate } = makeTimedRepo();

    setDate("2024-01-05T12:00:00Z");
    await repo.save(makeJob({ source_message_id: "before" }));

    setDate("2024-01-15T12:00:00Z");
    await repo.save(makeJob({ source_message_id: "inside" }));

    setDate("2024-01-25T12:00:00Z");
    await repo.save(makeJob({ source_message_id: "after" }));

    const results = await repo.findByDateRange(
      new Date("2024-01-10T00:00:00Z"),
      new Date("2024-01-20T23:59:59Z")
    );
    expect(results).toHaveLength(1);
    expect(results[0].source_message_id).toBe("inside");
  });

  test("range is inclusive on the start boundary", async () => {
    const boundary = new Date("2024-01-15T00:00:00Z");
    const repo = new InMemoryClosedJobRepository(() => new Date(boundary));
    await repo.save(makeJob({ source_message_id: "on-start" }));

    const results = await repo.findByDateRange(boundary, new Date("2024-01-20T00:00:00Z"));
    expect(results).toHaveLength(1);
    expect(results[0].source_message_id).toBe("on-start");
  });

  test("range is inclusive on the end boundary", async () => {
    const boundary = new Date("2024-01-20T00:00:00Z");
    const repo = new InMemoryClosedJobRepository(() => new Date(boundary));
    await repo.save(makeJob({ source_message_id: "on-end" }));

    const results = await repo.findByDateRange(new Date("2024-01-15T00:00:00Z"), boundary);
    expect(results).toHaveLength(1);
    expect(results[0].source_message_id).toBe("on-end");
  });

  test("returns empty array when all records fall outside the range", async () => {
    const { repo, setDate } = makeTimedRepo();
    setDate("2024-03-01T00:00:00Z");
    await repo.save(makeJob());

    const results = await repo.findByDateRange(
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-02-01T00:00:00Z")
    );
    expect(results).toEqual([]);
  });

  test("returns multiple records when all fall within range", async () => {
    const { repo, setDate } = makeTimedRepo();
    setDate("2024-01-15T08:00:00Z");
    await repo.save(makeJob({ source_message_id: "m1" }));
    setDate("2024-01-16T08:00:00Z");
    await repo.save(makeJob({ source_message_id: "m2" }));
    setDate("2024-01-17T08:00:00Z");
    await repo.save(makeJob({ source_message_id: "m3" }));

    const results = await repo.findByDateRange(
      new Date("2024-01-14T00:00:00Z"),
      new Date("2024-01-18T00:00:00Z")
    );
    expect(results).toHaveLength(3);
  });

  test("returned records have correct created_at timestamps", async () => {
    const { repo, setDate } = makeTimedRepo();
    const t1 = new Date("2024-01-15T09:00:00Z");
    const t2 = new Date("2024-01-16T14:30:00Z");

    setDate(t1.toISOString());
    await repo.save(makeJob({ source_message_id: "r1" }));
    setDate(t2.toISOString());
    await repo.save(makeJob({ source_message_id: "r2" }));

    const results = await repo.findByDateRange(
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );
    const r1 = results.find((r) => r.source_message_id === "r1");
    const r2 = results.find((r) => r.source_message_id === "r2");
    expect(r1?.created_at).toEqual(t1);
    expect(r2?.created_at).toEqual(t2);
  });
});

// ─── findByDateRangeForGroup ──────────────────────────────────────────────────

describe("findByDateRangeForGroup", () => {
  const GROUP_A = "group-a@g.us";
  const GROUP_B = "group-b@g.us";
  const ALWAYS = new Date("2000-01-01");
  const NEVER = new Date("2099-12-31");

  test("returns empty array from empty repository", async () => {
    const repo = new InMemoryClosedJobRepository();
    const results = await repo.findByDateRangeForGroup(ALWAYS, NEVER, GROUP_A);
    expect(results).toEqual([]);
  });

  test("returns only records for the matching group", async () => {
    const repo = new InMemoryClosedJobRepository();
    await repo.save(makeJob({ source_message_id: "a1", whatsapp_group_id: GROUP_A }));
    await repo.save(makeJob({ source_message_id: "b1", whatsapp_group_id: GROUP_B }));
    await repo.save(makeJob({ source_message_id: "a2", whatsapp_group_id: GROUP_A }));

    const results = await repo.findByDateRangeForGroup(ALWAYS, NEVER, GROUP_A);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.source_message_id)).toEqual(expect.arrayContaining(["a1", "a2"]));
  });

  test("returns empty array for a group with no records", async () => {
    const repo = new InMemoryClosedJobRepository();
    await repo.save(makeJob({ source_message_id: "a1", whatsapp_group_id: GROUP_A }));

    const results = await repo.findByDateRangeForGroup(ALWAYS, NEVER, GROUP_B);
    expect(results).toEqual([]);
  });

  test("combines date range and group filters correctly", async () => {
    const inRange = new Date("2024-01-15T10:00:00Z");
    const outOfRange = new Date("2024-03-01T10:00:00Z");

    let tick = 0;
    const clocks = [inRange, outOfRange];
    const repo = new InMemoryClosedJobRepository(() => clocks[tick++] ?? inRange);

    await repo.save(makeJob({ source_message_id: "a-in",  whatsapp_group_id: GROUP_A }));
    await repo.save(makeJob({ source_message_id: "a-out", whatsapp_group_id: GROUP_A }));

    const results = await repo.findByDateRangeForGroup(
      new Date("2024-01-01"),
      new Date("2024-01-31"),
      GROUP_A
    );
    expect(results).toHaveLength(1);
    expect(results[0].source_message_id).toBe("a-in");
  });

  test("Group B records do not appear in Group A scoped query", async () => {
    const repo = new InMemoryClosedJobRepository();
    await repo.save(makeJob({ source_message_id: "b1", whatsapp_group_id: GROUP_B }));

    const results = await repo.findByDateRangeForGroup(ALWAYS, NEVER, GROUP_A);
    expect(results).toHaveLength(0);
  });
});

// ─── interface contract: ClosedJobRepository ─────────────────────────────────

describe("interface contract", () => {
  test("InMemoryClosedJobRepository satisfies ClosedJobRepository interface at runtime", async () => {
    const repo = new InMemoryClosedJobRepository();
    expect(typeof repo.save).toBe("function");
    expect(typeof repo.findByDateRange).toBe("function");
    expect(typeof repo.findByDateRangeForGroup).toBe("function");
    expect(typeof repo.findBySourceMessageId).toBe("function");
    expect(typeof repo.listAll).toBe("function");
  });

  test("all methods return Promises", async () => {
    const repo = new InMemoryClosedJobRepository();
    const job = makeJob();
    expect(repo.save(job)).toBeInstanceOf(Promise);
    expect(repo.listAll()).toBeInstanceOf(Promise);
    expect(repo.findBySourceMessageId("x")).toBeInstanceOf(Promise);
    expect(repo.findByDateRange(new Date(), new Date())).toBeInstanceOf(Promise);
    expect(repo.findByDateRangeForGroup(new Date(), new Date(), "g")).toBeInstanceOf(Promise);
  });
});
