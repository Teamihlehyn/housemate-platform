// DES-37: budget helpers. FOUNDER-TUNABLE: the thresholds and quick picks below are guesses to
// help people type sensible numbers, not market data. Change them freely; nothing else depends
// on the exact values. All amounts are whole currency units per person.

export type Period = "month" | "year";

/** A note (never a block) when a value looks unusual for the city and period. */
export const BUDGET_SANITY: Record<string, { period: Period; low: number; high: number; place: string }> = {
  NGN: { period: "year", low: 100_000, high: 50_000_000, place: "Lagos" },
  GBP: { period: "month", low: 200, high: 5_000, place: "London" },
};

/** Tappable range suggestions per currency, in that city's usual period. */
export const BUDGET_PICKS: Record<string, { period: Period; picks: { label: string; min: number; max: number }[] }> = {
  NGN: {
    period: "year",
    picks: [
      { label: "₦500k–1m", min: 500_000, max: 1_000_000 },
      { label: "₦1m–2m", min: 1_000_000, max: 2_000_000 },
      { label: "₦2m–3.5m", min: 2_000_000, max: 3_500_000 },
      { label: "₦3.5m+", min: 3_500_000, max: 6_000_000 },
    ],
  },
  GBP: {
    period: "month",
    picks: [
      { label: "£600–900", min: 600, max: 900 },
      { label: "£900–1,200", min: 900, max: 1_200 },
      { label: "£1,200–1,600", min: 1_200, max: 1_600 },
    ],
  },
};

/** Convert a whole-unit amount between periods. Monthly naira round to ₦100, pounds to £1. */
export function convertPeriod(amount: number, from: Period, to: Period, currency: string): number {
  if (from === to) return amount;
  if (to === "year") return amount * 12;
  const step = currency === "NGN" ? 100 : 1;
  return Math.round(amount / 12 / step) * step;
}

/** The thresholds expressed in the period the person is using. */
export function sanityFor(currency: string, period: Period) {
  const s = BUDGET_SANITY[currency];
  if (!s) return null;
  return {
    place: s.place,
    low: convertPeriod(s.low, s.period, period, currency),
    high: convertPeriod(s.high, s.period, period, currency),
  };
}
