import { CITIES } from "./constants";

// Labels for the Discover preference chips (ENG-59). Pure; unit-tested.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function compact(major: number): string {
  if (major >= 1_000_000) return `${+(major / 1_000_000).toFixed(major % 1_000_000 === 0 ? 0 : 1)}m`;
  if (major >= 10_000) return `${+(major / 1_000).toFixed(0)}k`;
  return major.toLocaleString("en-GB");
}

export function budgetChip(minMinor: number, maxMinor: number, currency: string, period: string): string {
  const sym = currency === "NGN" ? "₦" : currency === "GBP" ? "£" : "";
  const lo = compact(Math.round(minMinor / 100));
  const hi = compact(Math.round(maxMinor / 100));
  return `${sym}${lo}–${sym}${hi}/${period === "year" ? "yr" : "mo"}`;
}

// "Jan–Mar 2027", "15 Jan 2027" (exact), "Dec 2026–Feb 2027" across years.
export function datesChip(mode: string | null, earliest: string | null, latest: string | null): string | null {
  if (!mode || mode === "undecided" || !earliest) return mode === "undecided" ? "Dates not decided" : null;
  const [ey, em, ed] = earliest.split("-").map(Number);
  if (mode === "exact" || !latest || latest === earliest) return `${ed} ${MONTHS[em - 1]} ${ey}`;
  const [ly, lm] = latest.split("-").map(Number);
  if (ey === ly && em === lm) return `${MONTHS[em - 1]} ${ey}`;
  return ey === ly ? `${MONTHS[em - 1]}–${MONTHS[lm - 1]} ${ly}` : `${MONTHS[em - 1]} ${ey}–${MONTHS[lm - 1]} ${ly}`;
}

export function areaLabels(cityId: string | null, ids: string[]): { id: string; label: string }[] {
  const city = cityId && cityId in CITIES ? CITIES[cityId as keyof typeof CITIES] : null;
  return ids.map((id) => ({ id, label: city?.areas.find((a) => a.id === id)?.label ?? id }));
}

export function areasChip(labels: { label: string }[], anywhere?: { cityId: string | null }): string {
  if (anywhere) return `Anywhere in ${anywhere.cityId === "lagos" ? "Lagos" : anywhere.cityId === "london" ? "London" : "the city"}`;
  if (!labels.length) return "No areas";
  return labels.length <= 2 ? labels.map((a) => a.label).join(", ") : `${labels[0].label} + ${labels.length - 1} more`;
}
