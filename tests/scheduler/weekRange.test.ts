import { getPreviousWeekRange } from "../../src/scheduler/weekRange";

// Creates a local-time date at noon to avoid DST / timezone edge cases around midnight.
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

// ─── day-of-week coverage ─────────────────────────────────────────────────────
// All inputs below fall in the same local week (Mon Jan 15 – Sun Jan 21, 2024).
// The expected previous week is always Mon Jan 8 – Sun Jan 14, 2024.

describe("getPreviousWeekRange — day-of-week coverage", () => {
  test("Monday input → previous Mon Jan 8 – Sun Jan 14", () => {
    const { startDate, endDate } = getPreviousWeekRange(d(2024, 1, 15));
    expect(startDate.getFullYear()).toBe(2024);
    expect(startDate.getMonth()).toBe(0);
    expect(startDate.getDate()).toBe(8);
    expect(endDate.getDate()).toBe(14);
  });

  test("Tuesday input → previous Mon Jan 8 – Sun Jan 14", () => {
    const { startDate, endDate } = getPreviousWeekRange(d(2024, 1, 16));
    expect(startDate.getDate()).toBe(8);
    expect(endDate.getDate()).toBe(14);
  });

  test("Wednesday input → previous Mon Jan 8 – Sun Jan 14", () => {
    const { startDate, endDate } = getPreviousWeekRange(d(2024, 1, 17));
    expect(startDate.getDate()).toBe(8);
    expect(endDate.getDate()).toBe(14);
  });

  test("Friday input → previous Mon Jan 8 – Sun Jan 14", () => {
    const { startDate, endDate } = getPreviousWeekRange(d(2024, 1, 19));
    expect(startDate.getDate()).toBe(8);
    expect(endDate.getDate()).toBe(14);
  });

  test("Saturday input → previous Mon Jan 8 – Sun Jan 14", () => {
    const { startDate, endDate } = getPreviousWeekRange(d(2024, 1, 20));
    expect(startDate.getDate()).toBe(8);
    expect(endDate.getDate()).toBe(14);
  });

  test("Sunday input → previous Mon Jan 8 – Sun Jan 14", () => {
    const { startDate, endDate } = getPreviousWeekRange(d(2024, 1, 21));
    expect(startDate.getDate()).toBe(8);
    expect(endDate.getDate()).toBe(14);
  });
});

// ─── year boundary ────────────────────────────────────────────────────────────

describe("getPreviousWeekRange — year boundary", () => {
  test("Wed Jan 1 2025 → Mon Dec 23 – Sun Dec 29 2024", () => {
    const { startDate, endDate } = getPreviousWeekRange(d(2025, 1, 1));
    expect(startDate.getFullYear()).toBe(2024);
    expect(startDate.getMonth()).toBe(11); // December
    expect(startDate.getDate()).toBe(23);
    expect(endDate.getFullYear()).toBe(2024);
    expect(endDate.getMonth()).toBe(11);
    expect(endDate.getDate()).toBe(29);
  });

  test("Mon Jan 5 2026 → Mon Dec 29 2025 – Sun Jan 4 2026", () => {
    // Jan 1 2026 = Thursday → Jan 5 2026 = Monday
    const { startDate, endDate } = getPreviousWeekRange(d(2026, 1, 5));
    expect(startDate.getFullYear()).toBe(2025);
    expect(startDate.getMonth()).toBe(11); // December
    expect(startDate.getDate()).toBe(29);
    expect(endDate.getFullYear()).toBe(2026);
    expect(endDate.getMonth()).toBe(0); // January
    expect(endDate.getDate()).toBe(4);
  });
});

// ─── time components ──────────────────────────────────────────────────────────

describe("getPreviousWeekRange — time components", () => {
  test("startDate is exactly midnight (00:00:00.000 local)", () => {
    const { startDate } = getPreviousWeekRange(d(2024, 1, 17));
    expect(startDate.getHours()).toBe(0);
    expect(startDate.getMinutes()).toBe(0);
    expect(startDate.getSeconds()).toBe(0);
    expect(startDate.getMilliseconds()).toBe(0);
  });

  test("endDate is exactly end of day (23:59:59.999 local)", () => {
    const { endDate } = getPreviousWeekRange(d(2024, 1, 17));
    expect(endDate.getHours()).toBe(23);
    expect(endDate.getMinutes()).toBe(59);
    expect(endDate.getSeconds()).toBe(59);
    expect(endDate.getMilliseconds()).toBe(999);
  });
});

// ─── structural invariants ────────────────────────────────────────────────────

describe("getPreviousWeekRange — structural invariants", () => {
  const nows = [
    d(2024, 1, 15), // Monday
    d(2024, 1, 17), // Wednesday
    d(2024, 1, 21), // Sunday
    d(2025, 1, 1),  // New Year
    d(2026, 1, 5),  // Cross-year Monday
  ];

  test("startDate is always a Monday (getDay() === 1)", () => {
    for (const now of nows) {
      expect(getPreviousWeekRange(now).startDate.getDay()).toBe(1);
    }
  });

  test("endDate is always a Sunday (getDay() === 0)", () => {
    for (const now of nows) {
      expect(getPreviousWeekRange(now).endDate.getDay()).toBe(0);
    }
  });

  test("endDate date component is exactly 6 days after startDate", () => {
    for (const now of nows) {
      const { startDate, endDate } = getPreviousWeekRange(now);
      const expected = new Date(startDate);
      expected.setDate(startDate.getDate() + 6);
      expect(endDate.getFullYear()).toBe(expected.getFullYear());
      expect(endDate.getMonth()).toBe(expected.getMonth());
      expect(endDate.getDate()).toBe(expected.getDate());
    }
  });

  test("startDate is strictly before endDate", () => {
    for (const now of nows) {
      const { startDate, endDate } = getPreviousWeekRange(now);
      expect(startDate.getTime()).toBeLessThan(endDate.getTime());
    }
  });

  test("previous week does not contain 'now'", () => {
    for (const now of nows) {
      const { endDate } = getPreviousWeekRange(now);
      expect(now.getTime()).toBeGreaterThan(endDate.getTime());
    }
  });

  test("does not mutate the input date", () => {
    const now = d(2024, 1, 17);
    const original = now.getTime();
    getPreviousWeekRange(now);
    expect(now.getTime()).toBe(original);
  });
});
