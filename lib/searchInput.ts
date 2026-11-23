import { MAX_BUDGET_MINOR } from "./money";

// Input checks for PATCH /me/search (HM-55). Pure; unit-tested in tests/round1.unit.ts.
// Anything malformed is a 422 with a field error, never a 500.

const MIN_BUDGET_MINOR = 100;

/** A budget in minor units: a whole number, at least 1.00, at most the currency's cap. */
export function budgetError(v: unknown, currency: string | null | undefined, which: "min" | "max"): string | null {
  const word = which === "min" ? "lowest" : "highest";
  if (typeof v !== "number" || !Number.isInteger(v) || v < MIN_BUDGET_MINOR) return `Enter your ${word} budget as a whole amount.`;
  const cap = MAX_BUDGET_MINOR[currency ?? ""] ?? Math.max(...Object.values(MAX_BUDGET_MINOR));
  if (v > cap) return currency === "GBP" ? "Enter a budget of £1,000,000 or less." : "Enter a budget of ₦1,000,000,000 or less.";
  return null;
}

/** Stay length in whole months, 1..max. */
export function monthsError(v: unknown, max: number): string | null {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > max) return `Enter a whole number of months, 1–${max}.`;
  return null;
}

/** A YYYY-MM-DD date string (or null to clear). */
export function isDateInput(v: unknown): v is string | null {
  return v === null || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z")));
}
