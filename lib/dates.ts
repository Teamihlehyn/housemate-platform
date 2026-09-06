// Move-in dates are YYYY-MM-DD strings in the destination timezone.
// TEST_TODAY makes seeded fixtures deterministic so examples never expire accidentally.

export function testToday(): string {
  return process.env.TEST_TODAY || new Date().toISOString().slice(0, 10);
}

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Inclusive overlap between two date ranges. Returns the overlapping interval or null.
export function dateOverlap(
  aEarliest: string,
  aLatest: string,
  bEarliest: string,
  bLatest: string
): { start: string; end: string; days: number } | null {
  const start = aEarliest > bEarliest ? aEarliest : bEarliest;
  const end = aLatest < bLatest ? aLatest : bLatest;
  if (start > end) return null;
  const days =
    Math.round(
      (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000
    ) + 1;
  return { start, end, days };
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateRange(earliest: string, latest: string): string {
  if (earliest === latest) return formatDate(earliest);
  return `${formatDate(earliest)} – ${formatDate(latest)}`;
}
