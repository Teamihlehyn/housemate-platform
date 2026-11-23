// Step funnel (ENG-58): the allowed events, steps and buckets. Pure and client-safe, so the
// rules are unit-tested and the browser and server agree. No personal data ever: no answers,
// names, emails, user ids or IPs.

// Bump when the application's screens change, so reports compare like with like.
export const FLOW_VERSION = "v2";

export const CLIENT_EVENTS = [
  "join.viewed", "join.code_sent", "join.email_confirmed", "join.step_viewed", "join.step_completed", "join.step_skipped",
  // ENG-68: the profile-strength checklist (step = the item key).
  "profile.item_opened", "profile.item_completed",
] as const;
export const SERVER_EVENTS = [
  "join.submitted",
  "application.call_booked",
  "application.approved",
  "application.activated",
  "prefs.deferred_answered",
  "discover.first_viewed",
] as const;
export type FunnelEventName = (typeof CLIENT_EVENTS)[number] | (typeof SERVER_EVENTS)[number];

// Screen ids from components/apply/useProfileDraft.ts (both flow versions) and the
// "better first matches" step.
export const STEPS = [
  "email", "code", "consent",
  "name", "journey", "city", "areas", "where", "location", "budget", "dates", "money", "moneyDates", "stay", "gender", "genderPref", "livingWith", "bio", "review",
  "habits", // ENG-68 checklist item
  "h:cleaning", "h:quiet", "h:guests", "h:smoking", "h:pets", "h:social",
] as const;

export function isClientEvent(e: unknown): e is (typeof CLIENT_EVENTS)[number] {
  return typeof e === "string" && (CLIENT_EVENTS as readonly string[]).includes(e);
}
export function isStep(s: unknown): s is string {
  return typeof s === "string" && (STEPS as readonly string[]).includes(s);
}
// A browser-made random id: letters, digits and hyphens only, 8–40 characters.
export function plausibleFunnelId(s: unknown): s is string {
  return typeof s === "string" && /^[A-Za-z0-9-]{8,40}$/.test(s);
}
// Where someone came from: one of a fixed list of channels, never free text (HM-52). Anything
// else is dropped.
export const SOURCES = ["whatsapp", "instagram", "x", "facebook", "tiktok", "linkedin", "email", "friend", "flyer", "google", "direct"] as const;
export function cleanSource(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const v = s.trim().toLowerCase();
  const alias: Record<string, string> = { twitter: "x", wa: "whatsapp", ig: "instagram", fb: "facebook" };
  const k = alias[v] ?? v;
  return (SOURCES as readonly string[]).includes(k) ? k : null;
}

export function msBucket(ms: unknown): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
  const s = ms / 1000;
  return s < 5 ? "<5s" : s < 15 ? "5-15s" : s < 30 ? "15-30s" : s < 60 ? "30-60s" : s < 180 ? "1-3m" : "3m+";
}
export function countBucket(n: number): string {
  return n <= 0 ? "0" : n <= 2 ? "1-2" : n <= 5 ? "3-5" : "6+";
}
export function daysBucket(days: number): string {
  return days < 1 ? "0" : days < 2 ? "1" : days < 4 ? "2-3" : days < 8 ? "4-7" : "8+";
}
