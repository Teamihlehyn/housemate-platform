// Usability round 1 (ENG-50–59, ENG-67): pure rules. Run: npm run test:unit
import { notificationHref } from "../lib/notificationTargets";
import { afterEarliestChange, dayLabel, latestMin, rangeError } from "../lib/dateRange";
import { CLIENT_EVENTS, cleanSource, countBucket, daysBucket, isClientEvent, isStep, msBucket, plausibleFunnelId } from "../lib/funnelEvents";
import { allValues, areaMatch, dealBreakersOf, habitCompatible, preferenceRow, stayRange, unanswered } from "../lib/matchRules";
import { profileStrength } from "../lib/profileStrength";
import { areasChip, budgetChip, datesChip } from "../lib/searchChips";
import { inboxOrder } from "../lib/reads";
import { callBookingUrl, testApprovalsAllowed } from "../lib/env";
import { fill } from "../lib/emails/render";
import { applicationReceivedEmail } from "../lib/emails";
import { applicationDto } from "../lib/applications";
import { canStaffAct } from "../lib/applications";
import { checkRows } from "../lib/checks";
import { budgetError, isDateInput, monthsError } from "../lib/searchInput";
import { bioChangedAfterReview } from "../lib/applications";
import { QUESTIONNAIRE } from "../lib/constants";

const cases: [string, boolean][] = [];
const check = (name: string, pass: boolean) => cases.push([name, pass]);

// ENG-50: deep links.
check("conversation → /messages/{id}", notificationHref("conversation", "c1") === "/messages/c1");
check("introduction → the inbox with it open", notificationHref("introduction", "i1") === "/messages?intro=i1");
check("household → /household; application → /join/status; none → no link",
  notificationHref("household", "h1") === "/household" && notificationHref("application", null) === "/join/status" && notificationHref("none", null) === null);
check("odd ids never make a link", notificationHref("conversation", "../x?y") === null && notificationHref("conversation", null) === null);

// ENG-51: inbox order: waiting for you first, then newest; closed never "waiting".
const t = (d: string) => new Date(d);
const ordered = inboxOrder([
  { id: "a", waiting_for_you: false, last_at: t("2026-11-21T10:00:00Z") },
  { id: "b", waiting_for_you: true, last_at: t("2026-11-20T10:00:00Z") },
  { id: "c", waiting_for_you: true, last_at: t("2026-11-21T09:00:00Z"), status: "closed" },
  { id: "d", waiting_for_you: true, last_at: t("2026-11-21T08:00:00Z") },
]).map((x) => x.id).join();
check("waiting-for-your-reply first (newest first), then the rest by activity", ordered === "d,b,a,c");

// ENG-55: dates.
check("latest can be the same day as earliest", latestMin("2027-01-15") === "2027-01-15" && rangeError("2027-01-15", "2027-01-15") === null);
check("14 Jan after a 15 Jan start is refused, with what to do", rangeError("2027-01-15", "2027-01-14") === "Choose your latest date again. It must be on or after 15 January 2027.");
const moved = afterEarliestChange("2027-02-01", "2027-01-20");
check("moving the start past the end clears the end and explains", moved.cleared && moved.latest === "" && !!moved.message?.includes("1 February 2027"));
check("moving the start within the range keeps the end", afterEarliestChange("2027-01-10", "2027-01-20").latest === "2027-01-20");
check("day labels", dayLabel("2027-03-05") === "5 March 2027");

// ENG-58: funnel rules (no personal data).
check("only the listed client events", isClientEvent("join.step_viewed") && !isClientEvent("join.submitted") && !isClientEvent("anything") && CLIENT_EVENTS.length === 8);
check("only known screen ids", isStep("bio") && isStep("h:cleaning") && !isStep("ada@example.com") && !isStep("<script>"));
check("funnel ids: random-looking only", plausibleFunnelId("3f2b9c1e-1111-4a2b-9c3d-0123456789ab") && !plausibleFunnelId("ada@example.com") && !plausibleFunnelId("x"));
check("sources: a fixed list only, no free text (HM-52)", cleanSource("WhatsApp") === "whatsapp" && cleanSource("twitter") === "x"
  && cleanSource("whatsapp-lagos") === null && cleanSource("ada@example.com") === null && cleanSource("a".repeat(100)) === null);
check("buckets", msBucket(3000) === "<5s" && msBucket(200000) === "3m+" && msBucket(-1) === null && countBucket(0) === "0" && countBucket(4) === "3-5" && daysBucket(0.5) === "0" && daysBucket(9) === "8+");

// ENG-56 (D-R4): explicit deal-breakers.
const none = preferenceRow({ dimension: "smoking", ownAnswer: "no", noDealBreakers: true });
const some = preferenceRow({ dimension: "smoking", ownAnswer: "no", dealBreakers: ["yes"] });
const skipped = preferenceRow({ dimension: "smoking", dealBreakers: [] });
check("no deal-breakers: accepts everything, state none", none.ok && none.row.state === "none" && none.row.acceptedValues.length === allValues("smoking").length);
check("deal-breakers: accepted = all − chosen, state some", some.ok && some.row.state === "some" && some.row.acceptedValues.join() === "no");
check("nothing chosen yet: state unanswered, own answer null (nothing pre-selected)", skipped.ok && skipped.row.state === "unanswered" && skipped.row.ownAnswer === null);
const both = preferenceRow({ dimension: "smoking", ownAnswer: "no", noDealBreakers: true, dealBreakers: ["yes"] });
check("'no deal-breakers' and specific choices are mutually exclusive (refused)", !both.ok);
check("ruling out every answer is refused", !preferenceRow({ dimension: "smoking", dealBreakers: ["yes", "no"] }).ok);
check("unknown question or answer is refused", !preferenceRow({ dimension: "pizza" }).ok && !preferenceRow({ dimension: "smoking", ownAnswer: "sometimes" }).ok);
check("dealBreakersOf only for 'some'", dealBreakersOf("smoking", ["no"], "some").join() === "yes" && dealBreakersOf("smoking", ["no", "yes"], "none").length === 0);

// ENG-56/57 matching semantics.
const ans = (own: string | null, accepted: string[], state: "none" | "some" | "unanswered") => ({ own, accepted, state });
check("answered + accepted both ways → compatible", habitCompatible(ans("no", ["no", "yes"], "none"), ans("yes", ["no", "yes"], "none"), "smoking"));
check("a deal-breaker excludes both ways", !habitCompatible(ans("no", ["no"], "some"), ans("yes", ["no", "yes"], "none"), "smoking")
  && !habitCompatible(ans("yes", ["no", "yes"], "none"), ans("no", ["no"], "some"), "smoking"));
check("an unanswered own answer can't satisfy someone with deal-breakers (conservative)",
  !habitCompatible(unanswered("smoking"), ans("no", ["no"], "some"), "smoking") && !habitCompatible(undefined, ans("no", ["no"], "some"), "smoking"));
check("…but is fine with someone without deal-breakers", habitCompatible(unanswered("smoking"), ans("no", ["no", "yes"], "none"), "smoking"));
check("your own unanswered deal-breakers accept everyone", habitCompatible(ans("yes", ["no", "yes"], "unanswered"), ans("yes", ["no", "yes"], "none"), "smoking"));
// Snapshot: for fully answered rows the new rule equals the old one (accepted.includes(own) both ways).
let same = true;
for (const q of QUESTIONNAIRE) {
  const vals = q.values.map((v) => v.id);
  const sets = [vals, vals.slice(0, 1), vals.slice(1), vals.slice(0, Math.max(1, vals.length - 1))];
  for (const ao of vals) for (const bo of vals) for (const aa of sets) for (const ba of sets) {
    const old = ba.includes(ao) && aa.includes(bo);
    const st = (s: string[]) => (s.length === vals.length ? "none" : "some") as "none" | "some";
    if (habitCompatible(ans(ao, aa, st(aa)), ans(bo, ba, st(ba)), q.id) !== old) same = false;
  }
}
check("migration snapshot: answered users match exactly as before", same);
check("stay not answered = open 1–36 months", JSON.stringify(stayRange(null, null)) === '{"min":1,"max":36}' && JSON.stringify(stayRange(6, 12)) === '{"min":6,"max":12}');

// ENG-59: chips.
check("budget chip, Lagos", budgetChip(150_000_000, 200_000_000, "NGN", "year") === "₦1.5m–₦2m/yr");
check("budget chip, London", budgetChip(80_000, 120_000, "GBP", "month") === "£800–£1,200/mo");
check("date chips", datesChip("range", "2027-01-05", "2027-03-20") === "Jan–Mar 2027" && datesChip("exact", "2027-01-05", "2027-01-05") === "5 Jan 2027"
  && datesChip("range", "2026-12-01", "2027-02-01") === "Dec 2026–Feb 2027" && datesChip("undecided", null, null) === "Dates not decided");
check("area chips", areasChip([{ label: "Yaba" }, { label: "Surulere" }]) === "Yaba, Surulere" && areasChip([{ label: "A" }, { label: "B" }, { label: "C" }]) === "A + 2 more");

// ENG-67: test approvals never in production.
check("flag off → no test approvals", !testApprovalsAllowed({}) && !testApprovalsAllowed({ ALLOW_TEST_APPROVALS: "false" }));
check("flag on, staging/preview/local → allowed", testApprovalsAllowed({ ALLOW_TEST_APPROVALS: "true" }) && testApprovalsAllowed({ ALLOW_TEST_APPROVALS: "true", VERCEL_ENV: "preview" }));
check("flag on, production → refused", !testApprovalsAllowed({ ALLOW_TEST_APPROVALS: "true", VERCEL_ENV: "production" }));
check("test approval from submitted, in review or call booked only", canStaffAct("approve_test", "submitted") && canStaffAct("approve_test", "call_booked") && !canStaffAct("approve_test", "approved"));
const testRows = checkRows([{ category: "test_account", status: "not_provided", checkedMonth: null }, { category: "email", status: "verified", checkedMonth: "2026-11" }], { own: true });
check("a test account says 'Test account — ID not checked' and never claims an ID check",
  testRows.some((r) => r.text === "Test account — ID not checked") && !testRows.some((r) => /Identity checked/.test(r.text)) && !testRows.some((r) => r.key === "identity"));

// ENG-60: the booking link.
check("booking link: https only, else none", callBookingUrl({ NEXT_PUBLIC_CALL_BOOKING_URL: "https://cal.com/peabudy/id-call" }) === "https://cal.com/peabudy/id-call"
  && callBookingUrl({ NEXT_PUBLIC_CALL_BOOKING_URL: "http://cal.com/x" }) === null && callBookingUrl({}) === null && callBookingUrl({ NEXT_PUBLIC_CALL_BOOKING_URL: "javascript:alert(1)" }) === null);
check("optional email sections are kept only with a value", fill("a{{#b}} [{{b}}]{{/b}} c", { b: "x" }, "text") === "a [x] c" && fill("a{{#b}} [{{b}}]{{/b}} c", { b: "" }, "text") === "a c");
const withLink = applicationReceivedEmail({ first_name: "Ada", status_url: "https://x.test/s", booking_url: "https://cal.com/peabudy/id-call" });
const without = applicationReceivedEmail({ first_name: "Ada", status_url: "https://x.test/s" });
check("E1 has the booking line when set, and leaves it out when not",
  withLink.text.includes("Book your 10-minute video call") && withLink.html.includes("https://cal.com/peabudy/id-call")
  && !without.text.includes("Book your") && !without.html.includes("Book your") && !/\{\{/.test(without.html + without.text));
const appB = { status: "submitted", submittedAt: new Date(), callAt: null, reapplyAfter: null };
check("the status object offers booking only while submitted or in review",
  applicationDto(appB, "lagos", { readOnly: false, cityOpen: true, bookingUrl: "https://cal.com/x" }).booking_url === "https://cal.com/x"
  && applicationDto({ ...appB, status: "call_booked" }, "lagos", { readOnly: false, cityOpen: true, bookingUrl: "https://cal.com/x" }).booking_url === null
  && applicationDto(appB, "lagos", { readOnly: false, cityOpen: true, bookingUrl: null }).booking_url === null);

// --- ENG-69: "Anywhere in {city}" ---
{
  const any = { anyArea: true, areas: [] as string[] };
  const yaba = { anyArea: false, areas: ["yaba"] };
  const lekki = { anyArea: false, areas: ["lekki"] };
  const ab = areaMatch(any, yaba), ba = areaMatch(yaba, any);
  check("ENG-69: anywhere matches a specific area, both directions", ab.ok && ba.ok);
  check("ENG-69: anywhere earns no common-area points and lists no common areas", ab.points === 0 && ba.points === 0 && ab.common.length === 0);
  check("ENG-69: two anywhere users match", areaMatch(any, any).ok && areaMatch(any, any).points === 0);
  check("ENG-69: specific areas still need an overlap", !areaMatch(yaba, lekki).ok && !areaMatch(lekki, yaba).ok);
  const two = areaMatch({ anyArea: false, areas: ["yaba", "lekki"] }, { anyArea: false, areas: ["lekki", "yaba", "ikeja"] });
  check("ENG-69: specific overlap scores 2 per area as before", two.ok && two.points === 4 && !two.anywhere);
  check("ENG-69: the chip says 'Anywhere in Lagos'", areasChip([{ label: "Yaba" }], { cityId: "lagos" }).includes("Anywhere in Lagos"));
}

// --- ENG-68: profile strength checklist ---
{
  const habits = (n: number) => QUESTIONNAIRE.map((q) => q.id).map((d, i) => ({ dimension: d, own: i < n ? "x" : null, state: i < n ? "none" : "unanswered" }));
  const empty = profileStrength({ bio: null, journey: null, stayAnswered: false, habits: habits(0) }, { applicant: true });
  check("ENG-68: checklist is ordered bio, habits, stay, journey", empty.items.map((i) => i.key).join() === "bio,habits,stay,journey");
  check("ENG-68: nothing done → 0 of 4, 0%", empty.done === 0 && empty.total === 4 && empty.percent === 0);
  check("ENG-68: every item has key, label, done, href, why, weight",
    empty.items.every((i) => i.key && i.label && typeof i.done === "boolean" && i.href.startsWith("/join/better") && i.why && i.weight > 0));
  check("ENG-68: weights add up to 100", empty.items.reduce((n, i) => n + i.weight, 0) === 100);
  const half = profileStrength({ bio: "x".repeat(60), journey: null, stayAnswered: false, habits: habits(3) }, { applicant: false });
  check("ENG-68: a bio of 40+ characters counts; habits show progress", half.items[0].done && !half.items[1].done && half.items[1].progress?.done === 3);
  check("ENG-68: partial habits earn partial weight", half.percent > 30 && half.percent < 70);
  check("ENG-68: users' links go to their profile", half.items.every((i) => i.href.startsWith("/profile")));
  const full = profileStrength({ bio: "x".repeat(60), journey: "find_together", stayAnswered: true, habits: habits(6) }, { applicant: false });
  check("ENG-68: everything done → 4 of 4, 100%", full.done === 4 && full.percent === 100);
  check("ENG-68: a short bio isn't done", !profileStrength({ bio: "hi", journey: null, stayAnswered: false, habits: habits(0) }, { applicant: true }).items[0].done);
}

// --- HM-55: budget and stay input checks ---
check("HM-55: 3,000,000,000 kobo (₦30m) is fine for NGN; ₦25m/yr saves", budgetError(3_000_000_000, "NGN", "max") === null && budgetError(2_500_000_000, "NGN", "max") === null);
check("HM-55: over the cap is refused (NGN ₦1bn, GBP £1m)", !!budgetError(100_000_000_001, "NGN", "max") && !!budgetError(100_000_001, "GBP", "min") && budgetError(100_000_000, "GBP", "min") === null);
check("HM-55: fractions, strings, NaN, Infinity and tiny values are refused",
  [150.5, "5", NaN, Infinity, 99, -1, null].every((v) => !!budgetError(v, "NGN", "min")));
check("HM-55: stay months must be whole numbers in range", monthsError(6, 24) === null && [0, 25, 6.5, "x", "6", null].every((v) => !!monthsError(v, 24)));
check("HM-55: dates must be YYYY-MM-DD (or null)", isDateInput("2027-01-31") && isDateInput(null) && ![20270131, "31/01/2027", "2027-1-3", "", {}].some((v) => isDateInput(v)));
// --- HM-54: bio changed after review ---
{
  const decided = new Date("2026-11-20T10:00:00Z");
  check("HM-54: a bio edited after the decision is flagged", bioChangedAfterReview(new Date("2026-11-21T10:00:00Z"), decided));
  check("HM-54: before the decision, or no decision, or never edited: not flagged",
    !bioChangedAfterReview(new Date("2026-11-19T10:00:00Z"), decided) && !bioChangedAfterReview(new Date(), null) && !bioChangedAfterReview(null, decided));
}

let failed = 0;
for (const [name, pass] of cases) {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
