// Money is stored as integer minor units + ISO currency. No floating-point storage.
// Search budgets are BigInt columns (HM-55: Lagos annual rents in kobo pass 2^31); the API caps
// them far below 2^53, so converting to a JS number for maths and display is exact.
export type Minor = number | bigint;
export function minorNum(v: Minor): number;
export function minorNum(v: Minor | null | undefined): number | null;
export function minorNum(v: Minor | null | undefined): number | null {
  return v == null ? null : Number(v);
}

/** HM-55: the largest budget the API accepts, per currency (minor units, any period). */
export const MAX_BUDGET_MINOR: Record<string, number> = {
  NGN: 100_000_000_000, // ₦1bn
  GBP: 100_000_000, // £1m
};

export function formatMoney(minor: Minor, currency: string): string {
  const major = Number(minor) / 100;
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(major);
}

// Normalised monthly-equivalent minor units for cross-period comparison (display only).
export function monthlyEquivalentMinor(minor: Minor, period: string): number {
  if (period === "year") return Math.round(Number(minor) / 12);
  return Number(minor);
}

export function formatPeriodPrice(minor: Minor, period: string, currency: string): string {
  return `${formatMoney(minor, currency)}/${period === "year" ? "yr" : "mo"}`;
}
