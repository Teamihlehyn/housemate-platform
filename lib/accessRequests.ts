import { CITIES, CityId } from "./constants";
import { testToday } from "./dates";

// Access requests (D15): validation for the public form. Pure, so it's unit-tested.
export const HOW_HEARD = ["friend", "whatsapp", "social", "search", "other"] as const;
export const NOTE_MAX = 300;
export const NAME_MAX = 80;
export const MONTHS_AHEAD = 24;
export const NOT_SURE = "not_sure";
// One address: exactly one @, no spaces, commas or angle brackets (HM-32).
export const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
export function validEmail(e: string): boolean {
  return e.length <= 254 && EMAIL_RE.test(e);
}

export interface AccessRequestInput {
  name: string;
  email: string;
  city: CityId;
  area: string;
  moveInMonth: string;
  howHeard: string | null;
  note: string | null;
}

// Months people can choose: this month to MONTHS_AHEAD ahead (UTC, respects TEST_TODAY).
export function monthInRange(month: string, today: string = testToday()): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  const [y, m] = today.split("-").map(Number);
  const [my, mm] = month.split("-").map(Number);
  const diff = (my - y) * 12 + (mm - m);
  return diff >= 0 && diff <= MONTHS_AHEAD;
}

export function validateAccessRequest(
  body: Record<string, unknown>,
  today: string = testToday()
): { ok: true; value: AccessRequestInput } | { ok: false; fieldErrors: Record<string, string>; consentMissing: boolean } {
  const e: Record<string, string> = {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const city = str(body.city) as CityId;
  const area = str(body.area);
  const month = str(body.move_in_month);
  const howHeard = str(body.how_heard) || null;
  const note = str(body.note) || null;

  if (!name) e.name = "Tell us your first name.";
  else if (name.length > NAME_MAX) e.name = `Keep your name under ${NAME_MAX} characters.`;
  if (!validEmail(email)) e.email = "Enter an email address, like name@example.com.";
  if (!(city in CITIES)) e.city = "Choose a city.";
  else if (area !== NOT_SURE && !CITIES[city].areas.some((a) => a.id === area)) e.area = "Choose an area, or “Not sure yet”.";
  if (month !== NOT_SURE && !monthInRange(month, today)) e.move_in_month = "Choose a month, or “Not sure yet”.";
  if (howHeard && !(HOW_HEARD as readonly string[]).includes(howHeard)) e.how_heard = "Choose one of the options.";
  if (note && note.length > NOTE_MAX) e.note = `Keep your note under ${NOTE_MAX} characters.`;
  const consentMissing = body.consent !== true;
  if (consentMissing) e.consent = "Tick this box so we can store your request.";

  if (Object.keys(e).length) return { ok: false, fieldErrors: e, consentMissing };
  return { ok: true, value: { name, email, city, area, moveInMonth: month, howHeard, note } };
}
