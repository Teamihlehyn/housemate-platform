import { createHash, randomBytes } from "crypto";
import { CITIES } from "./constants";

// Approval-first sign-up (ENG-39–43): the application state machine and its pure rules.
// Kept free of database access so tests/applications.unit.ts can cover every transition.

export const APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "call_booked",
  "approved",
  "declined",
  "waitlisted",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const DECLINE_REASONS = ["not_genuine", "agent_or_landlord", "id_failed", "no_show", "duplicate", "other"] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export const REAPPLY_DAYS = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;

// Staff actions and the statuses each may start from (spec R3.3).
export const STAFF_ACTIONS = {
  start_review: ["submitted", "waitlisted"],
  call_booked: ["submitted", "in_review", "call_booked"],
  approve: ["submitted", "in_review", "call_booked"],
  decline: ["submitted", "in_review", "call_booked", "waitlisted", "approved"],
  waitlist: ["submitted", "in_review", "call_booked"],
  resend_activation: ["approved"],
} as const satisfies Record<string, readonly ApplicationStatus[]>;
export type StaffAction = keyof typeof STAFF_ACTIONS;

export const ACTION_RESULT: Record<StaffAction, ApplicationStatus> = {
  start_review: "in_review",
  call_booked: "call_booked",
  approve: "approved",
  decline: "declined",
  waitlist: "waitlisted",
  resend_activation: "approved",
};

export function isStaffAction(a: unknown): a is StaffAction {
  return typeof a === "string" && Object.prototype.hasOwnProperty.call(STAFF_ACTIONS, a);
}

export function canStaffAct(action: StaffAction, status: string): boolean {
  return (STAFF_ACTIONS[action] as readonly string[]).includes(status);
}

// Which staff roles may act (view is any staff role). Moderators only look (R3.6).
export function canStaffRoleAct(role: string): boolean {
  return role === "verifier" || role === "admin";
}

// The applicant may change answers while nobody is reviewing them yet.
export function canEdit(status: string): boolean {
  return status === "draft" || status === "submitted";
}

export function canWithdraw(status: string): boolean {
  return ["draft", "submitted", "in_review", "call_booked", "waitlisted", "approved"].includes(status);
}

// Where a submitted application goes: waitlisted when its city isn't open yet (F4).
export function submitStatus(cityOpen: boolean): ApplicationStatus {
  return cityOpen ? "submitted" : "waitlisted";
}

// What /applications/verify does for an address that has just proved it owns the inbox.
export type VerifyOutcome =
  | "create" // new address → applicant + draft
  | "resume" // an applicant with an application to show (draft or any status)
  | "reopen" // withdrawn, or declined after the reapply date → back to draft
  | "declined_wait" // declined, reapply date not reached → status page only
  | "member" // an active member → a normal member session
  | "unavailable"; // suspended, being deleted, staff → no session, neutral message

export function verifyOutcome(
  user: { accountStatus: string; role: string } | null,
  application: { status: string; reapplyAfter: Date | null } | null,
  opts: { now?: Date; bootstrapAdmin?: boolean } = {}
): VerifyOutcome {
  const now = opts.now ?? new Date();
  if (!user) return opts.bootstrapAdmin ? "unavailable" : "create";
  if (user.role !== "member") return user.accountStatus === "active" ? "member" : "unavailable";
  if (user.accountStatus === "active" || user.accountStatus === "restricted") return "member";
  if (user.accountStatus !== "applicant") return "unavailable";
  if (!application) return "reopen";
  if (application.status === "withdrawn") return "reopen";
  if (application.status === "declined") {
    return application.reapplyAfter && application.reapplyAfter > now ? "declined_wait" : "reopen";
  }
  return "resume";
}

// Waiting time in the staff queue: amber after 24 h, red after 72 h, always with a text label.
export function waitingLabel(hours: number): "On time" | "Over 24 h" | "Over 72 h" {
  return hours >= 72 ? "Over 72 h" : hours >= 24 ? "Over 24 h" : "On time";
}

// The magic link on the status page (E1). Only the SHA-256 is stored.
export function newStatusToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashStatusToken(token) };
}
export function hashStatusToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function plausibleStatusToken(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{40,60}$/.test(t);
}

// Completeness: the same checks as publishing a profile (spec R1.4). Returns the missing
// fields keyed for field_errors, in the order people answer them.
export interface CompletenessInput {
  displayName: string | null;
  emailVerified: boolean;
  profile: { journey: string | null; bio: string | null } | null;
  search: {
    cityId: string | null;
    rentMinMinor: number | null;
    rentMaxMinor: number | null;
    moveMode: string | null;
    earliestDate: string | null;
    latestDate: string | null;
    stayMinMonths: number | null;
    stayMaxMonths: number | null;
    areaCount: number;
    preferenceCount: number;
  } | null;
}

export const MISSING_LABELS: Record<string, string> = {
  journey: "what you're looking for",
  displayName: "your first name",
  bio: "a short bio (80 characters or more)",
  cityId: "city",
  areaIds: "areas",
  budget: "budget",
  moveMode: "move-in timing",
  dates: "move-in dates",
  stay: "how long you want to stay",
  preferences: "all six living habits",
  email: "a confirmed email address",
};

export function missingFields(u: CompletenessInput): string[] {
  const p = u.profile;
  const s = u.search;
  const m: string[] = [];
  if (!p?.journey) m.push("journey");
  if (!u.displayName || u.displayName.trim().length < 2) m.push("displayName");
  if (!p?.bio || p.bio.length < 80) m.push("bio");
  if (!s?.cityId) m.push("cityId");
  if (!s || s.areaCount === 0) m.push("areaIds");
  if (s?.rentMinMinor == null || s?.rentMaxMinor == null) m.push("budget");
  if (!s?.moveMode) m.push("moveMode");
  if (s?.moveMode && s.moveMode !== "undecided" && (!s.earliestDate || !s.latestDate)) m.push("dates");
  if (s?.stayMinMonths == null || s?.stayMaxMonths == null) m.push("stay");
  if (!s || s.preferenceCount < 6) m.push("preferences");
  if (!u.emailVerified) m.push("email");
  return m;
}

export function missingMessage(missing: string[], verb = "submit"): string {
  return `Complete these before you ${verb}: ${missing.map((k) => MISSING_LABELS[k] ?? k).join(", ")}.`;
}

// The applicant-facing status object (see docs/engineering/approval-first-api.md).
export function applicationDto(
  a: { status: string; submittedAt: Date | null; callAt: Date | null; reapplyAfter: Date | null },
  cityId: string | null,
  opts: { readOnly: boolean; cityOpen: boolean; applicant?: boolean }
) {
  const actionable = !opts.readOnly && opts.applicant !== false;
  return {
    status: a.status,
    city: cityId,
    city_open: opts.cityOpen,
    submitted_at: a.submittedAt,
    call_at: a.status === "call_booked" ? a.callAt : null,
    reapply_after: a.status === "declined" ? a.reapplyAfter : null,
    can_edit: actionable && canEdit(a.status),
    can_withdraw: actionable && canWithdraw(a.status),
    read_only: opts.readOnly,
  };
}

export function cityName(cityId: string | null): string {
  return cityId === "london" ? "London" : cityId === "lagos" ? "Lagos" : "your city";
}

// "Thursday 19 November, 14:30 (Lagos time)" in the city's own time zone.
export function callTimeLabel(at: Date, cityId: string | null): string {
  const tz = cityId && cityId in CITIES ? CITIES[cityId as keyof typeof CITIES].timezone : "Africa/Lagos";
  const place = cityId === "london" ? "London" : "Lagos";
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(at);
  return `${day}, ${time} (${place} time)`;
}

// "18 December 2026" (UTC) for reapply and expiry dates in emails.
export function dateLabel(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(at);
}

// Retention (R7, privacy notice): what a purge may delete. Only accounts that never became
// users (applicants, or applicants who asked for deletion), and only once 30 days have passed:
//   stale_draft — a draft nobody has touched (application, profile or search) for 30 days
//   declined    — 30 days after the decision (a hashed email + reapply date are kept)
//   withdrawn   — 30 days after the withdrawal
export const RETENTION_DAYS = 30;
export type PurgeKind = "stale_draft" | "declined" | "withdrawn";

export function purgeKind(
  a: { status: string; updatedAt: Date; reviewedAt: Date | null },
  accountStatus: string,
  lastTouched: Date,
  now: Date = new Date()
): PurgeKind | null {
  if (accountStatus !== "applicant" && accountStatus !== "deletion_pending") return null;
  const cutoff = now.getTime() - RETENTION_DAYS * DAY_MS;
  if (a.status === "draft") return lastTouched.getTime() < cutoff ? "stale_draft" : null;
  if (a.status === "declined") return (a.reviewedAt ?? a.updatedAt).getTime() < cutoff ? "declined" : null;
  if (a.status === "withdrawn") return a.updatedAt.getTime() < cutoff ? "withdrawn" : null;
  return null;
}
