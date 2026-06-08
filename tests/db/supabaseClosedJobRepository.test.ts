/**
 * Mock-based tests for SupabaseClosedJobRepository.
 *
 * These tests do not require a real Supabase project or network connection.
 * They verify that the repository correctly maps query results to domain types,
 * handles the UNIQUE constraint error code, and propagates unexpected errors.
 *
 * The mock client simulates Supabase's fluent builder pattern:
 *   client.from(table).insert(data).select().single()
 *   client.from(table).select('*').gte(...).lte(...)
 *   client.from(table).select('*').eq(col, val).maybeSingle()
 *   client.from(table).select('*')          ← awaited directly
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseClosedJobRepository } from "../../src/db/supabaseClosedJobRepository";
import { NewClosedJob } from "../../src/db/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** A raw database row as Supabase would return it (created_at as ISO string). */
interface MockRow {
  id: string;
  raw_message: string;
  company_name: string;
  customer_name: string;
  phone: string;
  address: string;
  service: string;
  appointment: string;
  technician_name: string;
  closed_amount: number;
  payment_method: string;
  created_at: string;
  source_message_id: string;
  needs_review: boolean;
}

function makeRow(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    raw_message: "Sunshine Home Services\n\nName: Test Customer\nPhone: (205) 555-0000\nAddress: 1 Test St\nJob type: Test\nAppointment Monday\n\nJohn $250 check",
    company_name: "Sunshine Home Services",
    customer_name: "Test Customer",
    phone: "(205) 555-0000",
    address: "1 Test St",
    service: "Test Service",
    appointment: "Monday",
    technician_name: "John",
    closed_amount: 250,
    payment_method: "Check",
    created_at: "2024-01-15T10:00:00.000Z",
    source_message_id: "wa-msg-001",
    needs_review: false,
    ...overrides,
  };
}

function makeNewJob(overrides: Partial<NewClosedJob> = {}): NewClosedJob {
  return {
    raw_message: "raw",
    company_name: "Sunshine Home Services",
    customer_name: "Test Customer",
    phone: "(205) 555-0000",
    address: "1 Test St",
    service: "Test Service",
    appointment: "Monday",
    technician_name: "John",
    closed_amount: 250,
    payment_method: "Check",
    source_message_id: "wa-msg-001",
    needs_review: false,
    ...overrides,
  };
}

/**
 * Builds a minimal Supabase-like client mock.
 *
 * Every builder method returns the same builder object so the fluent chain
 * works regardless of call order. The two terminal methods (single,
 * maybeSingle) resolve to `terminalResult`. The builder itself is thenable
 * so it also resolves when awaited directly (used by listAll / findByDateRange).
 */
function makeClient(terminalResult: { data: unknown; error: unknown }): SupabaseClient {
  const builder: Record<string, jest.Mock> = {
    insert: jest.fn(),
    select: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
    eq: jest.fn(),
    single: jest.fn().mockResolvedValue(terminalResult),
    maybeSingle: jest.fn().mockResolvedValue(terminalResult),
    // Thenable: lets `await builder` resolve without calling .single()
    then: jest.fn((resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(terminalResult).then(resolve, reject)
    ),
  };

  // All chaining methods return the same builder object
  builder.insert.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);

  const client = {
    from: jest.fn().mockReturnValue(builder),
  };

  return client as unknown as SupabaseClient;
}

function makeErrorClient(code: string, message = "db error"): SupabaseClient {
  return makeClient({ data: null, error: { code, message } });
}

// ─── save — success ───────────────────────────────────────────────────────────

describe("SupabaseClosedJobRepository.save — success", () => {
  const row = makeRow();
  let repo: SupabaseClosedJobRepository;

  beforeEach(() => {
    repo = new SupabaseClosedJobRepository(makeClient({ data: row, error: null }));
  });

  test("returns ok: true", async () => {
    const result = await repo.save(makeNewJob());
    expect(result.ok).toBe(true);
  });

  test("record.id matches row id", async () => {
    const result = await repo.save(makeNewJob());
    expect(result.ok && result.record.id).toBe(row.id);
  });

  test("record.technician_name matches row", async () => {
    const result = await repo.save(makeNewJob());
    expect(result.ok && result.record.technician_name).toBe("John");
  });

  test("record.closed_amount is a number", async () => {
    const result = await repo.save(makeNewJob());
    expect(result.ok && result.record.closed_amount).toBe(250);
  });

  test("record.created_at is a Date object", async () => {
    const result = await repo.save(makeNewJob());
    expect(result.ok && result.record.created_at).toBeInstanceOf(Date);
  });

  test("record.created_at has the correct UTC value", async () => {
    const result = await repo.save(makeNewJob());
    expect(result.ok && result.record.created_at.toISOString()).toBe(row.created_at);
  });

  test("record.source_message_id matches", async () => {
    const result = await repo.save(makeNewJob());
    expect(result.ok && result.record.source_message_id).toBe("wa-msg-001");
  });

  test("record.needs_review is false", async () => {
    const result = await repo.save(makeNewJob());
    expect(result.ok && result.record.needs_review).toBe(false);
  });

  test("closed_amount is converted via Number() even when stored as numeric string", async () => {
    // Defensive: some drivers might deserialize numeric as string
    const rowWithStringAmount = { ...row, closed_amount: "250.50" as unknown as number };
    const client = makeClient({ data: rowWithStringAmount, error: null });
    const r = new SupabaseClosedJobRepository(client);
    const result = await r.save(makeNewJob());
    expect(result.ok && result.record.closed_amount).toBe(250.50);
  });
});

// ─── save — duplicate ────────────────────────────────────────────────────────

describe("SupabaseClosedJobRepository.save — duplicate source_message_id", () => {
  test("returns ok: false with DUPLICATE_SOURCE_MESSAGE_ID", async () => {
    const repo = new SupabaseClosedJobRepository(
      makeErrorClient("23505", "duplicate key value violates unique constraint")
    );
    const result = await repo.save(makeNewJob());
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe("DUPLICATE_SOURCE_MESSAGE_ID");
  });
});

// ─── save — unexpected error ──────────────────────────────────────────────────

describe("SupabaseClosedJobRepository.save — unexpected DB error", () => {
  test("throws with a descriptive message", async () => {
    const repo = new SupabaseClosedJobRepository(
      makeErrorClient("42P01", "relation does not exist")
    );
    await expect(repo.save(makeNewJob())).rejects.toThrow("[SupabaseRepo] save failed");
  });
});

// ─── findByDateRange ──────────────────────────────────────────────────────────

describe("SupabaseClosedJobRepository.findByDateRange", () => {
  const row1 = makeRow({ source_message_id: "msg-1", closed_amount: 100 });
  const row2 = makeRow({ source_message_id: "msg-2", closed_amount: 200 });

  test("returns empty array when no rows", async () => {
    const repo = new SupabaseClosedJobRepository(
      makeClient({ data: [], error: null })
    );
    const results = await repo.findByDateRange(new Date("2024-01-01"), new Date("2024-01-07"));
    expect(results).toHaveLength(0);
  });

  test("returns one mapped record", async () => {
    const repo = new SupabaseClosedJobRepository(
      makeClient({ data: [row1], error: null })
    );
    const results = await repo.findByDateRange(new Date("2024-01-01"), new Date("2024-01-31"));
    expect(results).toHaveLength(1);
    expect(results[0].closed_amount).toBe(100);
  });

  test("returns multiple mapped records", async () => {
    const repo = new SupabaseClosedJobRepository(
      makeClient({ data: [row1, row2], error: null })
    );
    const results = await repo.findByDateRange(new Date("2024-01-01"), new Date("2024-01-31"));
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.closed_amount)).toEqual([100, 200]);
  });

  test("converts created_at to Date", async () => {
    const repo = new SupabaseClosedJobRepository(
      makeClient({ data: [row1], error: null })
    );
    const results = await repo.findByDateRange(new Date("2024-01-01"), new Date("2024-01-31"));
    expect(results[0].created_at).toBeInstanceOf(Date);
  });

  test("throws on DB error", async () => {
    const repo = new SupabaseClosedJobRepository(
      makeErrorClient("42P01", "table not found")
    );
    await expect(
      repo.findByDateRange(new Date("2024-01-01"), new Date("2024-01-31"))
    ).rejects.toThrow("[SupabaseRepo] findByDateRange failed");
  });
});

// ─── findBySourceMessageId ────────────────────────────────────────────────────

describe("SupabaseClosedJobRepository.findBySourceMessageId", () => {
  const row = makeRow({ source_message_id: "wa-msg-abc" });

  test("returns null when no row found", async () => {
    const repo = new SupabaseClosedJobRepository(
      makeClient({ data: null, error: null })
    );
    const result = await repo.findBySourceMessageId("wa-msg-abc");
    expect(result).toBeNull();
  });

  test("returns mapped record when found", async () => {
    const repo = new SupabaseClosedJobRepository(
      makeClient({ data: row, error: null })
    );
    const result = await repo.findBySourceMessageId("wa-msg-abc");
    expect(result).not.toBeNull();
    expect(result?.source_message_id).toBe("wa-msg-abc");
    expect(result?.technician_name).toBe("John");
  });

  test("record.created_at is a Date", async () => {
    const repo = new SupabaseClosedJobRepository(
      makeClient({ data: row, error: null })
    );
    const result = await repo.findBySourceMessageId("wa-msg-abc");
    expect(result?.created_at).toBeInstanceOf(Date);
  });

  test("throws on DB error", async () => {
    const repo = new SupabaseClosedJobRepository(
      makeErrorClient("42P01", "query failed")
    );
    await expect(repo.findBySourceMessageId("wa-msg-abc")).rejects.toThrow(
      "[SupabaseRepo] findBySourceMessageId failed"
    );
  });
});

// ─── listAll ──────────────────────────────────────────────────────────────────

describe("SupabaseClosedJobRepository.listAll", () => {
  test("returns empty array when table is empty", async () => {
    const repo = new SupabaseClosedJobRepository(
      makeClient({ data: [], error: null })
    );
    const results = await repo.listAll();
    expect(results).toHaveLength(0);
  });

  test("returns all rows mapped to ClosedJobRecord", async () => {
    const rows = [
      makeRow({ source_message_id: "msg-1", closed_amount: 100 }),
      makeRow({ source_message_id: "msg-2", closed_amount: 200 }),
      makeRow({ source_message_id: "msg-3", closed_amount: 300 }),
    ];
    const repo = new SupabaseClosedJobRepository(
      makeClient({ data: rows, error: null })
    );
    const results = await repo.listAll();
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.closed_amount)).toEqual([100, 200, 300]);
  });

  test("every record has a Date for created_at", async () => {
    const rows = [
      makeRow({ source_message_id: "msg-1" }),
      makeRow({ source_message_id: "msg-2" }),
    ];
    const repo = new SupabaseClosedJobRepository(
      makeClient({ data: rows, error: null })
    );
    const results = await repo.listAll();
    for (const r of results) {
      expect(r.created_at).toBeInstanceOf(Date);
    }
  });

  test("throws on DB error", async () => {
    const repo = new SupabaseClosedJobRepository(
      makeErrorClient("42P01", "permission denied")
    );
    await expect(repo.listAll()).rejects.toThrow("[SupabaseRepo] listAll failed");
  });
});

// ─── rowToRecord field mapping ────────────────────────────────────────────────

describe("SupabaseClosedJobRepository — field mapping completeness", () => {
  test("all ClosedJobRecord fields are present in the returned record", async () => {
    const row = makeRow({
      id: "uuid-123",
      company_name: "Acme Corp",
      customer_name: "Jane Doe",
      phone: "555-1234",
      address: "42 Main St",
      service: "Plumbing",
      appointment: "Friday 9am",
      technician_name: "Mike",
      closed_amount: 450,
      payment_method: "Zelle",
      raw_message: "original raw text",
      source_message_id: "unique-id",
      needs_review: true,
    });

    const repo = new SupabaseClosedJobRepository(makeClient({ data: row, error: null }));
    const result = await repo.save(makeNewJob());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { record } = result;
    expect(record.id).toBe("uuid-123");
    expect(record.company_name).toBe("Acme Corp");
    expect(record.customer_name).toBe("Jane Doe");
    expect(record.phone).toBe("555-1234");
    expect(record.address).toBe("42 Main St");
    expect(record.service).toBe("Plumbing");
    expect(record.appointment).toBe("Friday 9am");
    expect(record.technician_name).toBe("Mike");
    expect(record.closed_amount).toBe(450);
    expect(record.payment_method).toBe("Zelle");
    expect(record.raw_message).toBe("original raw text");
    expect(record.source_message_id).toBe("unique-id");
    expect(record.needs_review).toBe(true);
    expect(record.created_at).toBeInstanceOf(Date);
  });
});
