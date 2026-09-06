// Money is stored as integer minor units + ISO currency. No floating-point storage.

export function formatMoney(minor: number, currency: string): string {
  const major = minor / 100;
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(major);
}

// Normalised monthly-equivalent minor units for cross-period comparison (display only).
export function monthlyEquivalentMinor(minor: number, period: string): number {
  if (period === "year") return Math.round(minor / 12);
  return minor;
}

export function formatMonthlyEquivalent(minor: number, period: string, currency: string): string {
  const eq = monthlyEquivalentMinor(minor, period);
  return `${formatMoney(eq, currency)}/mo equivalent`;
}

export function formatPeriodPrice(minor: number, period: string, currency: string): string {
  return `${formatMoney(minor, currency)}/${period === "year" ? "yr" : "mo"}`;
}
