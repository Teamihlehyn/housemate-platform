// Application status object (docs/engineering/approval-first-api.md §1) and display helpers.

export type ApplicationStatus =
  | "draft" | "submitted" | "in_review" | "call_booked" | "approved" | "declined" | "waitlisted" | "withdrawn";

export interface Application {
  status: ApplicationStatus;
  city: "lagos" | "london" | null;
  city_open: boolean;
  submitted_at: string | null;
  call_at: string | null;
  reapply_after: string | null;
  can_edit: boolean;
  can_withdraw: boolean;
  read_only: boolean;
}

export const CITY_NAME: Record<string, string> = { lagos: "Lagos", london: "London" };

/** "Wednesday 18 November" (UTC date, so it never shifts a day). */
export function longDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/** The ID call time, in Lagos time (the pilot city) with the zone said out loud. */
export function callTime(iso: string | null | undefined, city: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tz = city === "london" ? "Europe/London" : "Africa/Lagos";
  const day = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  return `${day}, ${time} (${city === "london" ? "London" : "Lagos"} time)`;
}

/** Activation codes: any case, spaces or hyphens are fine (contract §3). */
export function normaliseCode(raw: string) {
  return raw.trim().replace(/[\s]+/g, "").toUpperCase();
}
