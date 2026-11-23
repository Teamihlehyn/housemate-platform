import { QUESTIONNAIRE } from "./constants";

// Pure matching rules for answers that may be missing (D-R4, D-R5; ENG-56, ENG-57). Two-way and
// deterministic. Unit-tested in tests/matchRules.unit.ts.

export type DealBreakerState = "none" | "some" | "unanswered";
export interface HabitAnswer {
  own: string | null; // null = not answered yet
  accepted: string[]; // every value unless deal-breakers were chosen
  state: DealBreakerState;
}

export function allValues(dimension: string): string[] {
  return QUESTIONNAIRE.find((q) => q.id === dimension)?.values.map((v) => v.id) ?? [];
}

// A missing row is an unanswered question: no own answer, no deal-breakers.
export function unanswered(dimension: string): HabitAnswer {
  return { own: null, accepted: allValues(dimension), state: "unanswered" };
}

// Can `x`'s own answer live with `y`'s deal-breakers? An unanswered own answer can't satisfy
// someone who has deal-breakers on that question (conservative); anyone else is fine with it.
function satisfies(x: HabitAnswer, y: HabitAnswer): boolean {
  if (x.own == null) return y.state !== "some";
  return y.accepted.includes(x.own);
}

export function habitCompatible(a: HabitAnswer | undefined, b: HabitAnswer | undefined, dimension: string): boolean {
  const x = a ?? unanswered(dimension);
  const y = b ?? unanswered(dimension);
  return satisfies(x, y) && satisfies(y, x);
}

// Stay length not answered yet counts as open (1–36 months), instead of dropping the person.
export function stayRange(min: number | null | undefined, max: number | null | undefined): { min: number; max: number } {
  return { min: min ?? 1, max: max ?? 36 };
}

// What a PATCH /me/search preference item means (D-R4). Returns the stored row, or an error.
//   {dimension, ownAnswer?: string|null, dealBreakers?: string[], noDealBreakers?: boolean}
//   legacy {dimension, ownAnswer, acceptedValues}: still accepted (older clients, tests).
export function preferenceRow(
  item: { dimension?: unknown; ownAnswer?: unknown; dealBreakers?: unknown; noDealBreakers?: unknown; acceptedValues?: unknown }
): { ok: true; row: { dimension: string; ownAnswer: string | null; acceptedValues: string[]; state: DealBreakerState } } | { ok: false; error: string } {
  const dim = typeof item.dimension === "string" ? item.dimension : "";
  const values = allValues(dim);
  if (!values.length) return { ok: false, error: "Unknown question." };
  const own = item.ownAnswer == null || item.ownAnswer === "" ? null : String(item.ownAnswer);
  if (own != null && !values.includes(own)) return { ok: false, error: "Choose one of the answers." };

  if (item.dealBreakers !== undefined || item.noDealBreakers !== undefined) {
    const picked = Array.isArray(item.dealBreakers) ? [...new Set(item.dealBreakers.map(String))] : [];
    if (picked.some((v) => !values.includes(v))) return { ok: false, error: "Choose from the listed answers." };
    if (item.noDealBreakers === true && picked.length) {
      return { ok: false, error: "Choose “No deal-breakers” or specific deal-breakers, not both." };
    }
    if (picked.length >= values.length) return { ok: false, error: "You can't rule out every answer. Leave at least one." };
    if (item.noDealBreakers === true) return { ok: true, row: { dimension: dim, ownAnswer: own, acceptedValues: values, state: "none" } };
    if (picked.length) {
      return { ok: true, row: { dimension: dim, ownAnswer: own, acceptedValues: values.filter((v) => !picked.includes(v)), state: "some" } };
    }
    return { ok: true, row: { dimension: dim, ownAnswer: own, acceptedValues: values, state: "unanswered" } };
  }

  // Legacy accepted set.
  const accepted = Array.isArray(item.acceptedValues) ? [...new Set(item.acceptedValues.map(String))].filter((v) => values.includes(v)) : [];
  const finalAccepted = accepted.length ? accepted : own ? [own] : values;
  return {
    ok: true,
    row: { dimension: dim, ownAnswer: own, acceptedValues: finalAccepted, state: finalAccepted.length >= values.length ? "none" : "some" },
  };
}

// For GET /me and the review screens: the deal-breakers a row implies.
export function dealBreakersOf(dimension: string, accepted: string[], state: string): string[] {
  return state === "some" ? allValues(dimension).filter((v) => !accepted.includes(v)) : [];
}

// Areas (ENG-69). "Anywhere in {city}" (anyArea) shares an area with anyone in the same city,
// both ways; two "anywhere" people match too. Only specific overlaps earn area points, so the
// ranking still favours people who named the same places. Same-city is checked elsewhere.
export function areaMatch(
  a: { anyArea: boolean; areas: string[] },
  b: { anyArea: boolean; areas: string[] }
): { ok: boolean; common: string[]; points: number; anywhere: boolean } {
  if (a.anyArea || b.anyArea) return { ok: true, common: [], points: 0, anywhere: true };
  const common = b.areas.filter((x) => a.areas.includes(x));
  return { ok: common.length > 0, common, points: Math.min(10, common.length * 2), anywhere: false };
}
