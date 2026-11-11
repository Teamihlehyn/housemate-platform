// Unit checks for approval-first sign-up (ENG-39–44): the application state machine, the
// verify outcomes, completeness, the status object, the applicant guard and the emails.
// Run: npm run test:unit
import {
  ACTION_RESULT, APPLICATION_STATUSES, DECLINE_REASONS, STAFF_ACTIONS, applicationDto, callTimeLabel, canEdit, canStaffAct,
  canStaffRoleAct, canWithdraw, dateLabel, hashStatusToken, isStaffAction, missingFields, missingMessage, newStatusToken,
  plausibleStatusToken, purgeKind, submitStatus, verifyOutcome, waitingLabel,
} from "../lib/applications";
import { isApplicantSession } from "../lib/guard";
import {
  applicationReceivedEmail, applicationWaitlistedEmail, approvedEmail, callBookedEmail, codeEmail, declinedEmail,
} from "../lib/emails";
import { OPTIONAL_TEMPLATES } from "../scripts/sync-email-templates.mjs";

const cases: [string, boolean][] = [];
const check = (name: string, pass: boolean) => cases.push([name, pass]);

// --- Staff transitions (R3.3) ---
const allowed = (a: keyof typeof STAFF_ACTIONS) => APPLICATION_STATUSES.filter((s) => canStaffAct(a, s));
check("start review: from submitted or waitlisted", JSON.stringify(allowed("start_review")) === '["submitted","waitlisted"]');
check("approve: only once review has locked the answers (HM-36)", JSON.stringify(allowed("approve")) === '["in_review","call_booked"]');
check("approve is impossible from draft, submitted, approved, declined, waitlisted or withdrawn",
  ["draft", "submitted", "approved", "declined", "waitlisted", "withdrawn"].every((s) => !canStaffAct("approve", s)));
check("decline: any reviewed state, including approved-not-activated", allowed("decline").includes("approved") && !allowed("decline").includes("draft") && !allowed("decline").includes("withdrawn"));
check("waitlist: not from approved or declined", !canStaffAct("waitlist", "approved") && !canStaffAct("waitlist", "declined"));
check("resend activation: approved only", JSON.stringify(allowed("resend_activation")) === '["approved"]');
check("call booked can be rescheduled", canStaffAct("call_booked", "call_booked"));
check("action results", ACTION_RESULT.approve === "approved" && ACTION_RESULT.decline === "declined" && ACTION_RESULT.resend_activation === "approved"
  && ACTION_RESULT.start_review === "in_review" && ACTION_RESULT.waitlist === "waitlisted" && ACTION_RESULT.call_booked === "call_booked");
check("unknown actions are rejected", !isStaffAction("publish") && !isStaffAction("__proto__") && !isStaffAction(undefined) && isStaffAction("approve"));
check("only verifiers and admins act; moderators and members don't (R3.6)",
  canStaffRoleAct("verifier") && canStaffRoleAct("admin") && !canStaffRoleAct("moderator") && !canStaffRoleAct("member"));
check("decline reasons are the allow-list", DECLINE_REASONS.join(",") === "not_genuine,agent_or_landlord,id_failed,no_show,duplicate,other");

// --- Applicant rules ---
check("answers editable only in draft and submitted", APPLICATION_STATUSES.filter(canEdit).join(",") === "draft,submitted");
check("withdraw: open applications only", !canWithdraw("declined") && !canWithdraw("withdrawn") && canWithdraw("approved") && canWithdraw("waitlisted"));
check("submit: open city → submitted, other city → waitlisted (F4)", submitStatus(true) === "submitted" && submitStatus(false) === "waitlisted");

// --- /applications/verify outcomes (R1.2) ---
const now = new Date("2026-11-20T12:00:00Z");
const later = new Date("2026-12-20T12:00:00Z");
const earlier = new Date("2026-11-01T12:00:00Z");
const member = { accountStatus: "active", role: "member" };
const applicant = { accountStatus: "applicant", role: "member" };
check("new address → create", verifyOutcome(null, null, { now }) === "create");
check("new ADMIN_EMAILS address → unavailable (staff don't apply)", verifyOutcome(null, null, { now, bootstrapAdmin: true }) === "unavailable");
check("active member → member session", verifyOutcome(member, null, { now }) === "member");
check("restricted member → member session", verifyOutcome({ ...member, accountStatus: "restricted" }, null, { now }) === "member");
check("staff (active) → member session; staff never become applicants", verifyOutcome({ accountStatus: "active", role: "verifier" }, null, { now }) === "member");
check("suspended → unavailable", verifyOutcome({ ...member, accountStatus: "suspended" }, null, { now }) === "unavailable");
check("being deleted → unavailable", verifyOutcome({ ...member, accountStatus: "deletion_pending" }, null, { now }) === "unavailable");
for (const s of ["draft", "submitted", "in_review", "call_booked", "approved", "waitlisted"]) {
  check(`applicant in ${s} → resume`, verifyOutcome(applicant, { status: s, reapplyAfter: null }, { now }) === "resume");
}
check("declined before the reapply date → status page only (case 11)", verifyOutcome(applicant, { status: "declined", reapplyAfter: later }, { now }) === "declined_wait");
check("declined after the reapply date → reopen", verifyOutcome(applicant, { status: "declined", reapplyAfter: earlier }, { now }) === "reopen");
check("withdrawn → reopen", verifyOutcome(applicant, { status: "withdrawn", reapplyAfter: null }, { now }) === "reopen");

// --- Completeness (R1.4, case 15) ---
const complete = {
  displayName: "Ada",
  emailVerified: true,
  profile: { journey: "find_together", bio: "x".repeat(80) },
  search: { cityId: "lagos", rentMinMinor: 1, rentMaxMinor: 2, moveMode: "range", earliestDate: "2026-12-01", latestDate: "2026-12-31",
            stayMinMonths: 6, stayMaxMonths: 12, areaCount: 1, preferenceCount: 6 },
};
check("a complete application has nothing missing", missingFields(complete).length === 0);
check("a fresh draft lists every field",
  missingFields({ displayName: "", emailVerified: true, profile: { journey: null, bio: null }, search: null }).join(",")
  === "journey,displayName,bio,cityId,areaIds,budget,moveMode,stay,preferences");
check("five habits isn't enough", missingFields({ ...complete, search: { ...complete.search, preferenceCount: 5 } }).join() === "preferences");
check("ranged dates need both ends", missingFields({ ...complete, search: { ...complete.search, latestDate: null } }).join() === "dates");
check("undecided dates aren't 'missing' (submit refuses them separately)", missingFields({ ...complete, search: { ...complete.search, moveMode: "undecided", earliestDate: null, latestDate: null } }).length === 0);
check("a 79-character bio is too short", missingFields({ ...complete, profile: { ...complete.profile, bio: "x".repeat(79) } }).join() === "bio");
check("the message names fields in plain words", missingMessage(["bio", "areaIds"]) === "Complete these before you submit: a short bio (80 characters or more), areas.");

// --- Status object ---
const app = { status: "call_booked", submittedAt: now, callAt: later, reapplyAfter: later };
const dto = applicationDto(app, "lagos", { readOnly: false, cityOpen: true, applicant: true });
check("status object: call time shown when booked; reapply date hidden unless declined", dto.call_at === later && dto.reapply_after === null);
check("status object: call booked can't be edited but can be withdrawn", !dto.can_edit && dto.can_withdraw);
const ro = applicationDto({ ...app, status: "submitted" }, "lagos", { readOnly: true, cityOpen: true });
check("magic link view is read-only", ro.read_only && !ro.can_edit && !ro.can_withdraw);
const asMember = applicationDto({ ...app, status: "approved" }, "lagos", { readOnly: false, cityOpen: true, applicant: false });
check("an activated member can't withdraw their approved application", !asMember.can_withdraw && !asMember.can_edit);
check("status object carries no name, email or answers",
  Object.keys(dto).sort().join() === "call_at,can_edit,can_withdraw,city,city_open,read_only,reapply_after,status,submitted_at");

// --- Magic-link tokens ---
const t1 = newStatusToken();
const t2 = newStatusToken();
check("tokens are long, random and stored only as a hash", t1.token !== t2.token && t1.token.length >= 40 && t1.hash === hashStatusToken(t1.token) && !t1.hash.includes(t1.token));
check("token shape check rejects junk", plausibleStatusToken(t1.token) && !plausibleStatusToken("short") && !plausibleStatusToken("x".repeat(40) + "'") && !plausibleStatusToken(null));

// --- Queue waiting labels (R3.1) ---
check("waiting: on time under 24 h, amber from 24 h, red from 72 h",
  waitingLabel(23) === "On time" && waitingLabel(24) === "Over 24 h" && waitingLabel(71) === "Over 24 h" && waitingLabel(72) === "Over 72 h");

// --- Applicant guard (ENG-39, case 9) ---
check("an applicant is never a member session", isApplicantSession({ accountStatus: "applicant", sessionScope: "member" }));
check("an application-scoped session is never a member session", isApplicantSession({ accountStatus: "active", sessionScope: "application" }));
check("an active member with a member session passes", !isApplicantSession({ accountStatus: "active", sessionScope: "member" }));

// --- Emails (R6) ---
const c = codeEmail({ code: "123456" });
check("E0 subject carries the code and no hint about an account", c.subject === "Your Peabudy code: 123456" && !/your account|member|approved|application/i.test(c.text));
const e1 = applicationReceivedEmail({ first_name: "Ada", status_url: "https://x.test/join/status?t=abc" });
check("E1: next step, status link, never asks for money", /video ID call/.test(e1.text) && e1.text.includes("https://x.test/join/status?t=abc") && /never ask you for money/.test(e1.text));
const e5 = applicationWaitlistedEmail({ first_name: "Ada", status_url: "https://x.test/s", city_name: "London" });
check("E5: London opens later, with the status link", /London/.test(e5.text) && e5.text.includes("https://x.test/s") && e5.subject === e1.subject);
const e2 = approvedEmail({ first_name: "Ada", activation_url: "https://x.test/invite/ABCDEFGH", code: "ABCDEFGH", expires_on: "4 December 2026" });
check("E2: link, code typed out, expiry, never share", e2.text.includes("https://x.test/invite/ABCDEFGH") && e2.text.includes("ABCDEFGH") && e2.text.includes("4 December 2026") && /Never share/.test(e2.text));
const e3 = declinedEmail({ first_name: "Ada", reapply_on: "20 December 2026" });
check("E3: generic, reapply date, no reason codes", e3.text.includes("20 December 2026") && !DECLINE_REASONS.some((r) => e3.text.includes(r) || e3.html.includes(r)) && !/genuine|id check failed|no-show|duplicate/i.test(e3.text));
const e4 = callBookedEmail({ first_name: "Ada", call_time: callTimeLabel(new Date("2026-11-19T13:30:00Z"), "lagos"), call_link: "https://meet.example/abc" });
check("E4: Lagos time in the subject, what ID to bring, no copy kept", e4.subject.includes("Thursday 19 November, 14:30 (Lagos time)") && /photo ID/.test(e4.text) && /record/.test(e4.text));
check("no unfilled placeholders in any email", [c, e1, e5, e2, e3, e4].every((m) => !/\{\{/.test(m.subject + m.html + m.text)));
check("HTML parts escape values", applicationReceivedEmail({ first_name: "<b>A</b>", status_url: "https://x.test" }).html.includes("&lt;b&gt;A&lt;/b&gt;"));
check("dates in emails are plain UK English", dateLabel(new Date("2026-12-04T00:00:00Z")) === "4 December 2026");
check("the template list covers E0–E5", Object.keys(OPTIONAL_TEMPLATES).sort().join() === "application_received,application_waitlisted,approved,call_booked,code,declined");

// --- Retention (R7) ---
const pNow = new Date("2026-12-31T12:00:00Z");
const old = new Date("2026-11-30T12:00:00Z"); // 31 days before
const recent = new Date("2026-12-10T12:00:00Z");
const row = (status: string, at: Date, reviewedAt: Date | null = null) => ({ status, updatedAt: at, reviewedAt });
check("a draft untouched for 30 days is purged", purgeKind(row("draft", old), "applicant", old, pNow) === "stale_draft");
check("…but not if its answers changed recently", purgeKind(row("draft", old), "applicant", recent, pNow) === null);
check("declined: 30 days after the decision", purgeKind(row("declined", recent, old), "applicant", recent, pNow) === "declined"
  && purgeKind(row("declined", old, recent), "applicant", old, pNow) === null);
check("withdrawn: 30 days after withdrawing", purgeKind(row("withdrawn", old), "deletion_pending", old, pNow) === "withdrawn");
check("never submitted, in-review, waitlisted or approved applications",
  ["submitted", "in_review", "call_booked", "waitlisted", "approved"].every((st) => purgeKind(row(st, old, old), "applicant", old, pNow) === null));
check("never anyone who became a user", ["active", "restricted", "suspended"].every((acc) => purgeKind(row("declined", old, old), acc, old, pNow) === null));

let failed = 0;
for (const [name, pass] of cases) {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
