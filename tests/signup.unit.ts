// Unit checks for invite-only sign-up (D15), access requests, survey opt-in links (ENG-29),
// survey email rendering and export helpers (D17, ENG-30), and the legal drafts (ENG-25).
// Run: npm run test:unit
import { existsSync, readFileSync } from "fs";
import {
  INVITE_ALPHABET, INVITE_CODE_LENGTH, generateInviteCode, hashInviteCode, inviteState, inviteTtlMs, inviteUsable, maskEmail, normaliseInviteCode,
} from "../lib/invites";
import { monthInRange, validEmail, validateAccessRequest } from "../lib/accessRequests";
import { emailLinkSecret, surveyRef, unsubscribeToken, verifyUnsubscribeToken } from "../lib/emailLinks";
import { escapeHtml, fill, firstName, placeholders } from "../lib/emails/render";
import { INVITE_HTML, INVITE_TEXT, SURVEY_HTML, SURVEY_TEXT } from "../lib/emails/templates";
import { inviteEmail, surveyEmail } from "../lib/emails";
import { csvCell, validCampaign, validSurveyUrl, withRef } from "../lib/survey";
import { isCityOpen, openCities, siteUrl } from "../lib/env";
import { placeholdersIn, readLegal, stripInternal } from "../lib/legal/source";
import { parseBlocks, safeHref } from "../lib/legal/Markdown";
import { stripComments } from "../scripts/sync-email-templates.mjs";

const cases: [string, boolean][] = [];
const check = (name: string, pass: boolean) => cases.push([name, pass]);

// Invite codes
const codes = Array.from({ length: 500 }, generateInviteCode);
check("codes are 8 characters from the unambiguous alphabet",
  codes.every((c) => c.length === INVITE_CODE_LENGTH && [...c].every((ch) => INVITE_ALPHABET.includes(ch))));
check("no look-alike characters in the alphabet", !/[01OILUV]/.test(INVITE_ALPHABET));
check("codes don't repeat (500 draws)", new Set(codes).size === 500);
check("typed codes are normalised: case, spaces, hyphens", normaliseInviteCode(" abcd-efgh ") === "ABCDEFGH");
check("junk isn't a code", normaliseInviteCode("ABCD1EFG") === null && normaliseInviteCode("short") === null && normaliseInviteCode(42) === null);
check("hash is sha256 hex and stable", hashInviteCode("ABCDEFGH").length === 64 && hashInviteCode("ABCDEFGH") === hashInviteCode("ABCDEFGH"));
const now = new Date("2026-11-12T10:00:00Z");
const later = new Date("2026-11-20T10:00:00Z");
const inv = { id: "i", email: null, expiresAt: later, usedAt: null };
check("open invite usable by anyone", inviteUsable(inv, "a@b.co", now));
check("bound invite: right address only", inviteUsable({ ...inv, email: "a@b.co" }, "a@b.co", now) && !inviteUsable({ ...inv, email: "a@b.co" }, "c@d.co", now));
check("bound invite: valid when no address is given (invite page)", inviteUsable({ ...inv, email: "a@b.co" }, null, now));
check("expired invite unusable", !inviteUsable({ ...inv, expiresAt: now }, "a@b.co", now));
check("used invite unusable", !inviteUsable({ ...inv, usedAt: now }, "a@b.co", now));
check("missing invite unusable", !inviteUsable(null, "a@b.co", now));
check("masked hint keeps the domain, hides the name", maskEmail("adaeze@example.com") === "ad•••@example.com" && maskEmail("ab@x.co") === "a•••@x.co");
check("revoked invite unusable (HM-29)", !inviteUsable({ ...inv, revokedAt: now }, "a@b.co", now));
check("invite states", inviteState({ usedAt: null, revokedAt: now, expiresAt: later }, now) === "revoked"
  && inviteState({ usedAt: now, revokedAt: null, expiresAt: later }, now) === "used"
  && inviteState({ usedAt: null, revokedAt: null, expiresAt: now }, now) === "expired"
  && inviteState({ usedAt: null, revokedAt: null, expiresAt: later }, now) === "active");
check("unbound codes last 72 h, bound invites 14 days (HM-29)",
  inviteTtlMs(false) === 72 * 3600_000 && inviteTtlMs(true) === 14 * 24 * 3600_000);

// Access requests
const good = { name: "Ada", email: " Ada@Example.COM ", city: "lagos", area: "yaba", move_in_month: "2026-12", consent: true };
const v = validateAccessRequest(good, "2026-11-10");
check("valid request passes, email lower-cased", v.ok && v.value.email === "ada@example.com");
check("London is accepted (waitlisted later)", validateAccessRequest({ ...good, city: "london", area: "hackney" }, "2026-11-10").ok);
check("'not sure' area and month are accepted", validateAccessRequest({ ...good, area: "not_sure", move_in_month: "not_sure" }, "2026-11-10").ok);
const bad = validateAccessRequest({ ...good, city: "paris", email: "nope", note: "x".repeat(301), how_heard: "tv" }, "2026-11-10");
check("bad fields are named", !bad.ok && ["city", "email", "note", "how_heard"].every((k) => k in bad.fieldErrors));
check("area must be in the city", !validateAccessRequest({ ...good, area: "hackney" }, "2026-11-10").ok);
const noConsent = validateAccessRequest({ ...good, consent: "yes" }, "2026-11-10");
check("consent must be exactly true", !noConsent.ok && noConsent.consentMissing);
check("one address only (HM-32)", validEmail("ada@example.com") && !validEmail("a@b.c,d@e.f") && !validEmail("a@b@c.d")
  && !validEmail("a@b.c d@e.f") && !validEmail("<a@b.co>") && !validEmail("a@b.c;d@e.f") && !validEmail("x".repeat(250) + "@b.co"));
check("month window: this month to 24 ahead", monthInRange("2026-11", "2026-11-10") && monthInRange("2028-11", "2026-11-10") && !monthInRange("2028-12", "2026-11-10") && !monthInRange("2026-10", "2026-11-10") && !monthInRange("2026-13", "2026-11-10"));

// Cities and site URL
check("OPEN_CITIES unset: Lagos only (F4 default)", JSON.stringify(openCities("")) === '["lagos"]' && !isCityOpen("london", openCities("")) && isCityOpen("lagos", openCities("")));
check("OPEN_CITIES=*: every city open", openCities("*") === null && isCityOpen("london", openCities("*")));
check("OPEN_CITIES=lagos: London waitlisted", isCityOpen("lagos", openCities("Lagos")) && !isCityOpen("london", openCities("lagos")));
check("site URL: explicit first, no trailing slash", siteUrl({ NEXT_PUBLIC_SITE_URL: "https://peabudy.com/" }) === "https://peabudy.com");
check("site URL: Vercel production fallback", siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }) === "https://x.vercel.app");

// Unsubscribe tokens
const secret = "s".repeat(40);
const tok = unsubscribeToken("ckuser123456", secret)!;
check("token round-trips to the user", verifyUnsubscribeToken(tok, secret) === "ckuser123456");
check("tampered signature rejected", verifyUnsubscribeToken(tok.slice(0, -2) + "xx", secret) === null);
check("swapped user ID rejected", verifyUnsubscribeToken(tok.replace("ckuser123456", "ckuser654321"), secret) === null);
check("other secret rejected", verifyUnsubscribeToken(tok, "t".repeat(40)) === null);
check("junk rejected", [null, "", "abc", "x.y", 5, "a".repeat(300)].every((t) => verifyUnsubscribeToken(t, secret) === null));
check("deployed without EMAIL_LINK_SECRET: no links", emailLinkSecret({ VERCEL_ENV: "production" }) === null && unsubscribeToken("ckuser123456", null) === null);
check("deployed with a short secret: treated as missing", emailLinkSecret({ VERCEL_ENV: "preview", EMAIL_LINK_SECRET: "short" }) === null);
check("survey ref is pseudonymous and stable", surveyRef("ckuser123456", secret) === surveyRef("ckuser123456", secret) && !surveyRef("ckuser123456", secret)!.includes("ckuser"));

// Email rendering
check("HTML values are escaped", fill("<a href=\"{{u}}\">{{n}}</a>", { u: "https://x/?a=1&b=\"2\"", n: "<b>Ada</b>" }, "html") === "<a href=\"https://x/?a=1&amp;b=&quot;2&quot;\">&lt;b&gt;Ada&lt;/b&gt;</a>");
check("text values are not escaped", fill("Hi {{n}}", { n: "A&B" }, "text") === "Hi A&B");
let threw = false; try { fill("{{missing}}", {}, "html"); } catch { threw = true; }
check("a missing value throws instead of sending {{…}}", threw);
check("survey template uses exactly the three placeholders",
  JSON.stringify(placeholders(SURVEY_HTML)) === JSON.stringify(["first_name", "survey_url", "unsubscribe_url"]) &&
  JSON.stringify(placeholders(SURVEY_TEXT)) === JSON.stringify(["first_name", "survey_url", "unsubscribe_url"]));
const se = surveyEmail({ first_name: "<Ada>", survey_url: "https://tally.so/r/x?ref=1", unsubscribe_url: "https://p.com/unsubscribe?token=a.b" });
check("survey email fills and escapes", se.html.includes("&lt;Ada&gt;") && !se.html.includes("{{") && se.text.includes("https://p.com/unsubscribe?token=a.b"));
check("invite template uses exactly code and invite_url",
  JSON.stringify(placeholders(INVITE_HTML)) === JSON.stringify(["code", "invite_url"]) &&
  JSON.stringify(placeholders(INVITE_TEXT)) === JSON.stringify(["code", "invite_url"]));
const ie = inviteEmail({ invite_url: "https://p.com/invite/ABCDEFGH?x=1&y=2", code: "ABCDEFGH" });
check("invite email has link (escaped) and code", ie.html.includes("https://p.com/invite/ABCDEFGH?x=1&amp;y=2") && !ie.html.includes("{{") && ie.text.includes("ABCDEFGH"));
for (const [n, body] of [["invite", INVITE_HTML + INVITE_TEXT], ["survey", SURVEY_HTML + SURVEY_TEXT]]) {
  const lit = body.match(/\[[A-Z][A-Z ]+\]/g);
  if (lit) console.log(`WARNING ${n} email still contains ${[...new Set(lit)].join(" ")} — fill it before real sends`);
}
check("first name: first word or 'there'", firstName("Ada Obi") === "Ada" && firstName("") === "there" && firstName(null) === "there");
check("escapeHtml covers quotes", escapeHtml(`'"`) === "&#39;&quot;");
for (const [file, synced] of [["survey.html", SURVEY_HTML], ["survey.txt", SURVEY_TEXT], ["invite.html", INVITE_HTML], ["invite.txt", INVITE_TEXT]]) {
  const path = `docs/design/emails/${file}`;
  check(`${file} is in sync with lib/emails/templates.ts (run scripts/sync-email-templates.mjs)`,
    !existsSync(path) || (file.endsWith(".html") ? stripComments(readFileSync(path, "utf8")) : readFileSync(path, "utf8")) === synced);
}

check("designer comments are stripped, Outlook conditionals kept",
  stripComments("a<!-- note -->b<!--[if mso]>x<![endif]--><!--[if !mso]><!-->y<!--<![endif]-->") === "ab<!--[if mso]>x<![endif]--><!--[if !mso]><!-->y<!--<![endif]-->");
check("synced HTML has no designer comments", ![SURVEY_HTML, INVITE_HTML].some((h) => /<!--(?!\[if)(?!<!\[endif\])(?!>)/.test(h)));

// Survey helpers
check("campaign slugs", validCampaign("survey-1") && validCampaign("survey-1-reminder") && !validCampaign("Survey 1") && !validCampaign("x"));
check("survey URL must be https", validSurveyUrl("https://tally.so/r/abc") && !validSurveyUrl("http://tally.so/r/abc") && !validSurveyUrl("javascript:alert(1)") && !validSurveyUrl("https://u:p@x.com"));
check("ref is added as a query parameter", withRef("https://tally.so/r/abc?x=1", "r1") === "https://tally.so/r/abc?x=1&ref=r1");
check("CSV cells neutralise formulas", csvCell("=HYPERLINK(\"x\")") === `"'=HYPERLINK(""x"")"` && csvCell("+1") === `"'+1"` && csvCell("-1") === `"'-1"` && csvCell("@a") === `"'@a"`);
check("CSV cells quote plain values", csvCell("Ada, Obi") === `"Ada, Obi"` && csvCell(null) === `""`);

// Legal drafts (ENG-25). Placeholders are allowed for now (founder decision, 10 Nov), but
// listed on every run so nobody forgets them.
for (const doc of ["privacy-notice", "terms"] as const) {
  const md = readLegal(doc);
  check(`${doc}: drafting banner removed`, !md.includes("Draft written by AI"));
  check(`${doc}: notes for counsel removed`, !/^>\s*\*?Note:/m.test(md));
  check(`${doc}: renders to blocks with a heading`, parseBlocks(md).some((b) => b.t === "h"));
  const ph = placeholdersIn(md);
  console.log(`INFO ${doc}: ${ph.length} placeholder(s) still to fill: ${ph.join(" ")}`);
}
check("Markdown links: same-site, https and mailto only; no //host (SEC-14)",
  safeHref("/privacy") === "/privacy" && safeHref("https://ico.org.uk") === "https://ico.org.uk" && safeHref("mailto:a@b.co") === "mailto:a@b.co"
  && safeHref("//evil.example") === "#" && safeHref("/\\evil.example") === "#" && safeHref("javascript:alert(1)") === "#" && safeHref("http://x.co") === "#");
check("stripInternal keeps text after a note", stripInternal("> banner\n\n# T\n\nA\n\n> *Note: x*\n> more\n\nB").includes("B") && !stripInternal("> banner\n# T\n> *Note: x*\nB").includes("Note"));
check("privacy draft names privacy-v2", readFileSync("docs/product/beta/legal/privacy-notice.md", "utf8").includes("privacy-v2"));

let failed = 0;
for (const [name, pass] of cases) {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
