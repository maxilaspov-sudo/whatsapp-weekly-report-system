export interface WeekRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Returns the Monday–Sunday date range for the week immediately before the one
 * containing `now`. Uses local time so the server's timezone governs week boundaries.
 *
 * startDate: previous Monday 00:00:00.000
 * endDate:   previous Sunday 23:59:59.999
 *
 * Examples (any time on the given local date):
 *   Mon 2024-01-15  →  Mon 2024-01-08 … Sun 2024-01-14
 *   Wed 2024-01-17  →  Mon 2024-01-08 … Sun 2024-01-14
 *   Sun 2024-01-21  →  Mon 2024-01-08 … Sun 2024-01-14
 *   Wed 2025-01-01  →  Mon 2024-12-23 … Sun 2024-12-29
 */
export function getPreviousWeekRange(now: Date): WeekRange {
  // Days elapsed since the most recent Monday (Mon=0 … Sun=6)
  const daysSinceMonday = (now.getDay() + 6) % 7;

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - daysSinceMonday - 7);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}
