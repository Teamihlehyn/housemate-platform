# Designer work pack: Peabudy beta

> Status: **draft, pending founder approval** (9 Nov 2026). Index: [`README.md`](README.md).
>
> **Name:** the product is now **Peabudy** (founder, 9 Nov 2026; domain `peabudy.com`). Copy in this pack is renamed. Login and activity emails come from `Peabudy <hello@peabudy.com>` (founder.md F-02). The name is subject to the trade mark check in founder.md F-17, so keep the name in one place (wordmark, a copy constant) and don't bake it into illustrations or the mascot's identity until F-17 is back.
>
> **Rebrand and mascot work (started 9 Nov):** the interactive mascot-led landing page and conversational onboarding are **not on the 11 Nov critical path** (README "Who is doing what now"). For 11 Nov, the must-haves are the rename (ENG-28) and the FT copy rows below. The new landing can ship once it passes the honesty rules here; onboarding changes need a PM review first, because onboarding answers drive matching (`lib/matching.ts`) and must still collect every field matching needs.
>
> **Visual source:** [`../../design/design-system.md`](../../design/design-system.md). Use its tokens and components where they help, but **no ticket here depends on adopting it**. Every ticket can ship with today's classes (`btn-*`, `card`, `chip`, `input`, `field-error`).
>
> **Constraints (from `CLAUDE.md` §9):** UK English, sentence case, plain words, no exclamation marks. Every colour signal also has text. Touch targets are 44 px or larger. Check every screen at 375 px.
>
> **Fixed honesty phrases** stay word-for-word wherever they still apply ("Checks completed — not a guarantee of safety"). In beta, phrases that describe simulated things ("Demo verified", "Sample availability", "Demo application accepted; no home is reserved") **must not appear**, because nothing in beta is simulated. The engineer wires the copy in ENG-03.
>
> **Assumes D1:** real people only, London and Lagos, early access from 11 Nov.

| ID | Title | Size | Sprint | Engineer ticket |
|---|---|---|---|---|
| DES-01 | Beta copy audit (every string, current → proposed) | M | FT rows by 10 Nov; rest S1–S2 | ENG-03 |
| DES-02 | List of completed checks replaces the credibility score | S | FT | ENG-04 |
| DES-03 | First-conversation safety card | S | FT (text) / S1 (visual) | ENG-03 |
| DES-04 | Empty and waiting states | S | FT (pending) / S1 | ENG-02, 13, 20 |
| DES-05 | Email templates copy | M | S1 | ENG-12 |
| DES-06 | Analytics consent banner | XS | S2 | ENG-14 |
| DES-07 | Tally waitlist and survey content | S | FT (waitlist) / S1 (survey) | founder F-06 |
| DES-08 | Beta landing and announcement copy | S | FT | ENG-03 |
| DES-09 | Sign-in: 18+, re-consent and beta wording | XS | S1 | ENG-05, 06 |
| DES-10 | Feedback dialog and prompt copy (T1–T5) | S | S1 | ENG-15 |
| DES-11 | Back office layout | M | S1 | ENG-07, 11, 13, 16, 21–24 |
| DES-12 | Type and contrast: ₦/Yoruba glyphs, placeholder and faint text | S | S1 | ENG-26, 27 |

**Total ≈ 9 designer-days. FT ≈ 2½ days.**

---

## DES-01: Beta copy audit

**Problem.** Many strings say "Demo", "simulated", "Seeded" or "pilot", show made-up quotes, or describe features that don't exist. In beta every one of these is false.

**Rules for proposed text:**
- Say what's real.
- Never imply anyone is safe.
- Never say "verified" without saying who checked what.

Rows marked **FT** must ship by 10 Nov. "Beta" means the change applies only when `APP_ENV=beta`; "All" means every mode.

| # | FT | Where (file:line) | Current | Proposed (beta unless "All") |
|---|---|---|---|---|
| 1 | FT | `lib/env.ts:37–39` `BANNER` | "Early access — identity is verified by our team; property listings and viewings are guided examples." | "Early access: real people, with identity checked by our team on a video call. Checks aren't a guarantee of safety." |
| 2 | FT | `lib/constants.ts:19,37` city labels | "London pilot" / "Lagos pilot" | "London" / "Lagos" (All) |
| 3 | FT | `app/page.tsx:198` hero pill | "London & Lagos pilots" | "Early access in London and Lagos" |
| 4 | FT | `app/page.tsx:74` match card mock chip | "Demo 80" | "ID checked" |
| 5 | FT | `app/page.tsx:218` floating chip | label "Verified", value "Demo 80/100" | label "Checked", value "ID + email" |
| 6 | FT | `app/page.tsx:272–286` credibility card | "Demo credibility · 80/100 · Demo verified", plus a points table; body "A transparent score with the full evidence breakdown." | A checklist mock: "✓ Email confirmed · ✓ Identity checked by the Peabudy team". Heading "Trust, shown honestly". Body: "We show which checks someone has completed, never a score. Checks completed — not a guarantee of safety." |
| 7 | FT | `app/page.tsx:159` stage 04 | "Shortlist & view — Add sample homes, vote, and book a viewing." | "Find the place — Look for a home together however suits you. Peabudy doesn't list homes yet." |
| 8 | FT | `app/page.tsx:160` stage 05 | "Move in — Complete a demo handoff and confirm your move-in." | Hidden in beta (4 stages) |
| 9 | FT | `app/page.tsx:164` trust card | "Grounded in research — Built on housing research across the UK and Nigeria…" | "Built with early members — We're testing this with people in London and Lagos and changing it based on what they tell us." |
| 10 | FT | `app/page.tsx:165` | "…The credibility score shows which checks are complete…" | "Evidence, never guarantees — We show which checks someone has completed. It's never a promise that they're safe." |
| 11 | FT | `app/page.tsx:167` | "No real money — No payments, deposits or binding agreements. The rental handoff is a demo — no home is reserved." | "No money through Peabudy — We never take payments or deposits, and your agreement isn't a tenancy. Never pay anyone before you've seen a home in person and checked who the landlord is." |
| 12 | FT | `app/page.tsx:170–174, 368–383` scenarios | Three made-up quotes. "Room host, Lekki" describes room authority review and an address that unlocks at viewing, **neither of which exists** | **Remove the section in beta.** In research, remove the room-host scenario (All) |
| 13 | FT | `app/page.tsx:332` | "Seeded neighbourhoods across both pilots" | "Opening first in these areas" (list the launch areas, D12) |
| 14 | FT | `app/safety/page.tsx:5` | "Evidence, not guarantees — The credibility score reflects…" | "Evidence, not guarantees — We show which checks someone has completed. It's never a promise that they're safe." |
| 15 | FT | `app/safety/page.tsx:6` | "Simulated checks are labelled — Every verification badge reads "Demo verified"…" | "How we check identity — Before anyone can see other members or be seen, someone from our team checks their photo ID on a short video call. We record only that the check passed and when. We don't keep a copy of your ID." |
| 16 | FT | `app/safety/page.tsx:10, 30–33` | "No real money … rental handoff is a demo" · "Prototype support is simulated and is not an emergency service…" · intro "…in this prototype." | As #11 · "We read every report, usually within 24 hours. We're not an emergency service: if you're in danger, call 999 in the UK or 112 in Nigeria." *(The founder confirms the numbers, F-04)* · "…in early access." Add a "Meeting safely" card using the DES-03 text |
| 17 | FT | `app/terms/page.tsx:11–13, 15, 19` | Beta: "…property listings and viewings are guided examples." · "An accepted application is a demo…" · "…data in the test environment may be reset." | Replaced wholesale by [`legal/terms.md`](legal/terms.md) in beta (ENG-25) |
| 18 | FT | `app/(app)/discover/page.tsx:72, 119` | Subtitle "…The number is match strength, not a percentage." Chip "Demo {score}/100" (the code passes the **credibility** score here, `lib/matching.ts:271,289`) | Subtitle "Ranked by shared dates, areas and living habits." Chip: "ID checked" (beta) or none. **Remove the number in all modes** (agreed with the designer's audit) |
| 19 | FT | `app/(app)/discover/page.tsx:83–88` pending | "…once our team verifies your identity. We'll email you to arrange a short check." | See DES-04 "Verification pending" |
| 20 | FT | `app/(app)/onboarding/page.tsx:387–390` (shown in beta too) | "Publishing runs a simulated core identity check (demo) and gives you a baseline demo credibility of 60…" | "When you publish, we'll ask you to book a 10-minute video call to check your photo ID. Nobody can see your profile until that's done." |
| 21 | FT | `app/(app)/onboarding/page.tsx:370–371, 382` | "Profile submitted — Our team will verify your identity with a short check… you can look around in the meantime." Button "Look around" | "Profile saved — Next: a 10-minute video call with our team to check your photo ID. We'll email you within a day to book it. Until then you won't see other members and they won't see you." Button "Go to my profile" |
| 22 | FT | `app/(app)/members/[id]/page.tsx:72, 107` and `profile/page.tsx:75` | "Demo {score}/100", "Demo credibility: {score}/100" | See DES-02 |
| 23 | FT | `app/api/v1/reports/route.ts` receipt | "Case X is open. Support in this prototype is simulated and is not an emergency service." | "Case X is open. We'll review it, usually within 24 hours. If you're in danger, call 999 (UK) or 112 (Nigeria)." |
| 24 | FT | `components/ResearchTools.tsx` dialog | "Sent with the page you're on ({page}) and your anonymous tester ID {id}." · "Thank you!" | Signed in: "Sent with the page you're on. Because you're signed in, it's linked to your account so we can reply." Signed out: "Sent with the page you're on. We don't know who you are unless you tell us." · "Thank you" (All) |
| 25 | FT | `app/api/v1/introductions/route.ts:115` | "Your identity verification is still pending. We'll email you to arrange it." | "Your ID check isn't done yet. We'll email you to book a short video call." |
| 26 | | `app/api/v1/feedback/route.ts:24` | "Thanks — that's plenty for now!" | "Thanks, that's plenty for now. Try again in a minute." (All) |
| 27 | FT | `app/(app)/settings/page.tsx:50` | "Download everything we hold about you as a JSON file." | Until ENG-17: "Download your profile, search and checks as a file. For anything else, email [CONTACT EMAIL]." After ENG-17: "Download your profile, searches, introductions, messages, agreements and settings as a file." |
| 28 | FT | `app/(app)/settings/page.tsx:29, 59` | "…your data is removed under our retention policy…" | "Your profile is hidden straight away. We delete your data within 30 days, unless we must keep something for safety or legal reasons. See the privacy notice." *(Period from the legal draft; F-04 confirms)* |
| 29 | | `lib/constants.ts:54` journey help | "You already live somewhere and have one room to fill." | Add: "Peabudy doesn't list rooms yet. Describe the room in your bio." |
| 30 | | `app/(app)/household/page.tsx` agreement header (~212) | — | Add: "A record of what you both agreed, not a tenancy or legal contract." (All) |
| 31 | | `staff/verifications/[userId]/route.ts` reject notification | "…Please reply to our email to sort it out." | "We couldn't complete your ID check. We'll email you about next steps." |
| 32 | | `app/layout.tsx:28–29` metadata | "…London & Lagos." | Keep. Check that the OG image text has no "demo" wording |

**Allow-list for ENG-03's grep:** "demo" may appear only in the link "Try a demo with sample people" (ENG-19, D6).

**Acceptance criteria:**
- Given a beta build, ENG-03's banned-word grep passes.
- Given the PM reviews the table in the PR, every row is marked done or deferred, with a reason.

**Size** M.

## DES-02: List of completed checks replaces the credibility score

**Problem.** A 0–100 score built from two or three checks can't be justified, and today it's labelled "Demo".

**Spec (beta):**
- **Compact** (Discover card, profile header): one chip, "ID checked". If identity isn't verified, show nothing, because unverified people aren't visible in beta (ENG-02). Use a check icon plus the text, never colour alone.
- **Full** (member profile, own profile), a card titled "What's been checked":
  - "✓ Email confirmed"
  - "✓ Identity checked by the Peabudy team · November 2026"
  - "— Phone: not checked" *(the staff approval currently also marks the phone as verified, `staff/verifications/[userId]/route.ts`. Only show "Phone confirmed on the ID call" if the SOP F-08 actually confirms it; otherwise hide the phone row. Decision recorded in F-08)*
  - The fixed line below: "Checks completed — not a guarantee of safety."
  - A link: "How we check identity" → `/safety`.
- Reference/additional rows: not shown (no flow exists).

**Acceptance criteria:**
- Given any beta screen, no "/100" and no number next to a check.
- Given the full card at 375 px, every row is readable at 200% zoom, and the icons have text equivalents.

**Size** S.

## DES-03: First-conversation safety card

**Placement:** the top of every conversation in beta, dismissible per conversation. Not shown again after it's dismissed. In S1, a "Safety tips" link in the thread menu brings it back.

**Text (FT, final unless the security reviewer changes it):**

> **Before you meet or pay anything**
> - Have a video call first, then meet somewhere public. Tell a friend where you'll be.
> - Never pay a deposit, holding fee or rent until you've seen the home in person and checked who the landlord or agent is.
> - Peabudy will never ask you for money or for your bank details.
> - Keep chatting here until you trust them. You don't have to share your address or number.
> - If something feels wrong, you can block or report them from their profile. Blocking is instant, and they're not told.

**Acceptance criteria:** the dismiss button is 44 px or larger; the card is announced as a region named "Safety tips"; it doesn't cover the composer at 375 px.

**Size** S.

## DES-04: Empty and waiting states

| State | Trigger (API) | Heading | Body | Action |
|---|---|---|---|---|
| **Verification pending** (FT) | `gate = "identity_pending"` (ENG-02) | "Your ID check is next" | "Before you can see other members, someone from our team checks your photo ID on a 10-minute video call. We'll email you within a day to book it. Nobody can see your profile until then." | "Check my profile" (secondary). Optional "Try a demo with sample people" (D6) |
| **Verification couldn't be completed** | identity `failed` | "We couldn't complete your ID check" | "This can happen if the call didn't connect or the ID wasn't clear. We'll email you about next steps." | "Contact us" (mailto [CONTACT EMAIL]) |
| **City not open** (S1) | `NEXT_PUBLIC_BETA_CITIES` excludes the city (ENG-13) | "We're not open in {city} yet" | "We're starting in London and Lagos. Join the waitlist and we'll tell you when we open near you." | "Join the waitlist" (Tally) |
| **Area not open yet** (S1) | `gate = "area_not_open"` | "{Area} isn't open yet" | "We open each area once enough people are searching there, so you'll have people to talk to. We'll email you when {area} opens. You can also add a nearby area that's already open." | "Add another area" → `/profile#areas` |
| **No matches** (S1, ENG-20) | `candidates = []` with `narrowFilters` | "No one fits all your must-haves yet" | One line for the top filter: **dates** "Nobody's move-in window overlaps yours yet." **budget** "Nobody's budget overlaps yours yet." **areas** "Nobody's looking in your areas yet." **habits** "Your dealbreakers rule out everyone so far." **stay** "Nobody wants a similar length of stay yet." **gender** "Your housemate preference rules out everyone so far." (shown only to the viewer, about their own setting) | "Widen my dates" / "Widen my budget" / "Add an area" / "Review my dealbreakers" / "Review my preference" → the relevant Profile section. Plus: "New people join every week. We'll email you when someone fits." (only once ENG-12 ships) |

**Size** S.

## DES-05: Email templates copy

**Shared:**
- From name "Peabudy".
- Plain HTML matching `loginEmailHtml` in `lib/email.ts` (brand colours).
- One button that links to the page, never a sign-in link.
- Footer, activity emails: "You're getting this because you have a Peabudy account. Turn off activity emails: {unsubscribe link}."
- Footer, safety emails: "This is an account email, so it can't be turned off."
- **Never** include message or intro text, report text, other people's contact details, or the reason for a suspension.

| Event | Subject | Body | Button |
|---|---|---|---|
| Login code (existing; review only) | "Your Peabudy sign-in code: {code}" | Keep. Add "Peabudy will never ask you for this code." | — |
| `identity_verified` | "You're in: your ID check is done" | "Thanks for doing the call. Other checked members in your area can now see you, and you can see them." (If the area isn't open: "We'll email you as soon as {area} opens.") | "See who fits" |
| `identity_rejected` | "We couldn't complete your ID check" | "We weren't able to finish your ID check. Reply to this email and we'll sort out next steps." | — |
| `introduction_received` | "{First name} introduced themselves on Peabudy" | "{First name} thinks your plans fit. Read their introduction and decide whether to reply. It expires in 7 days." | "Read the introduction" |
| `introduction_accepted` | "{First name} accepted your introduction" | "You can now chat. Take your time, and keep chatting on Peabudy until you trust them." | "Open the chat" |
| `message_received` | "New message from {first name}" | "You have a new message on Peabudy." | "Read it" |
| `area_opened` | "{Area} is open on Peabudy" | "Enough people are now searching in {area}. Take a look at who fits your plans." | "See who fits" |
| `report_closed` | "We've reviewed your report" | "We've reviewed case {caseId}. Thank you for reporting it. We don't share what action we take, to protect everyone's privacy." | — |

**Size** M.

## DES-06: Analytics consent banner

- **Placement:** the bottom of the screen, above the bottom nav (`bottom-20 md:bottom-6`). Doesn't block the page.
- **Text:** "Can we record how you use the site? We use Microsoft Clarity to see where people get stuck. We hide what you type, your messages and your email." Buttons: "Allow" and "No thanks", with equal visual weight. Link: "Privacy notice".
- **Settings:** a row "Usage recordings: On / Off".

**Size** XS.

## DES-07: Tally waitlist and survey content

**Waitlist (FT, live 11 Nov), about 1 minute:**

1. Short statement: "Peabudy is in early access in London and Lagos. We open area by area, so everyone who joins has people to talk to. We'll use your answers to decide where to open next and to email you when we do. [Privacy notice link]"
2. City (London · Lagos · Somewhere else → "Which city?")
3. Areas (multi-select, conditional on city: the 6 areas in `lib/constants.ts`, plus "Somewhere else" with a text box)
4. When do you need to move? (This month · 1–3 months · 3–6 months · Not sure)
5. Budget in your city's usual period:
   - London: "per month" bands: under £700 · £700–999 · £1,000–1,299 · £1,300+
   - Lagos: "per year" bands: under ₦1m · ₦1m–2m · ₦2m–4m · ₦4m+
   - *Bands are an Assumption; the PM confirms them with the founder.*
6. Which describes you? (Student or recent graduate · Moving for work · I have a room to fill · Looking with a friend · Other)
7. Email (required) with consent text: "Email me when Peabudy opens in my area. I can unsubscribe at any time."
8. How did you hear about us? (hidden field `source` plus an optional free-text field)

**Survey (S1):** the 12 questions in [`../beta-launch-plan.md`](../beta-launch-plan.md) §7.2, with the following:
- Hidden fields: `ref`, `city`, `stage`, `source` (ENG-15).
- Q1 must have a "Which city?" variant.
- Q4 uses the city's own currency wording.
- Q12 collects an email only if the person ticks "yes".

**Size** S.

## DES-08: Beta landing and announcement copy

- **Landing** = DES-01 rows 1–13, plus a short "How early access works" strip under the hero:
  1. "Sign up and tell us your plans"
  2. "A 10-minute ID check on video"
  3. "We open your area when enough people are searching"
  4. "Introduce yourself and chat"
- **Announcement (11 Nov, links to the Tally waitlist):**
  > "Finding someone to live with shouldn't mean guessing. Peabudy matches you on move-in dates, budget, areas and living habits, then helps you agree rent, bills and notice in writing before anyone moves in. We're opening early access in London and Lagos, area by area, and every member has their ID checked by our team on a video call. Checks aren't a guarantee of safety, so meet safely. Join the waitlist: {link}?source={channel}"
- Provide 3 lengths: a 280-character version, a WhatsApp message, and a LinkedIn post.
- Don't claim "verified people" without "by our team", and don't claim "safe".

**Size** S.

## DES-09: Sign-in: 18+, re-consent and beta wording

- **Second required checkbox** under the privacy consent: "I'm 18 or over". Error: "Confirm you're 18 or over to continue."
- **Re-consent** (ENG-06): when the API returns `CONSENT_REQUIRED` for an existing user, show "We've updated our privacy notice. Please read it and tick the box to continue." above the checkbox.
- **Deletion-pending** error: "Your account is being deleted. If you want to keep it, email [CONTACT EMAIL]."
- **Beta helper line:** "We'll email you a 6-digit code. It expires in 10 minutes. Check your spam folder if it hasn't arrived after a minute."

**Size** XS.

## DES-10: Feedback dialog and prompt copy (T1–T5)

| Prompt | Copy | Response type |
|---|---|---|
| T1 (after publish) | "How easy was setting up your profile?" | 1–7 scale, plus "What slowed you down?" (optional) |
| T2 (0 matches, second visit) | "What were you hoping to find?" | Free text |
| T3 / T4 (survey card) | "Two minutes to help shape Peabudy: tell us how finding people here is going." | "Take the survey" / "Not now" |
| T5 (pause or delete) | "What's the main reason?" | Found someone here · Found someone elsewhere · Not enough people · Didn't feel safe · Plans changed · Other |

**Size** S.

## DES-11: Back office layout

**Users:** the founder and up to 2 staff, on desktop first. Must be usable at 375 px for urgent moderation.

**Tabs:** Overview · Verification · Reports · Users · Areas · Feedback · Audit. Tabs are hidden according to the role matrix in ENG-24.

| Tab | Layout | Key states and copy |
|---|---|---|
| **Overview** | Two columns, London and Lagos (one column stacked on mobile). Cards for each ENG-16 metric, plus a date-range picker and "Download CSV" | Empty: "No data for this range." Every number has a label and the definition on hover or tap |
| **Verification** | Queue table, oldest first. Columns: name · city · areas · move-in window · journey · waiting (h) · contacted. Row actions: "Mark contacted", "Approve", "Reject" (with a reason picker). Overdue counts per city at the top | Over 24 h: amber with the text "Over 24 h". Over 72 h: red with "Over 72 h". Approve confirmation: "Approve only after you've seen their photo ID on a live video call and confirmed they're 18+." |
| **Reports** | Filter by status (Open · Investigating · Actioned · Dismissed) and category. List shows case ID, category, age and SLA badge. The detail pane has the description, reporter and target links, prior reports against the target, an action log timeline, a status change with a resolution code and a note (500 characters), and "Suspend target" | Safety-critical over 4 h: red with "Over 4 h". The note field is labelled "Staff note (never shown to members)" |
| **Users** | Search box (email, exact match only, or name or ID), results list, then detail: status, checks, counts, recent activity, "Show contact details" (audited), "Suspend" / "Restore" | Suspend dialog: reason picker, then "Suspending signs them out and hides them straight away. Their chats and household close. They're not told why." Restore: "Restoring lets them sign in again. Nothing is reopened." |
| **Areas** | A table per city: area · published · verified · pending · move-in months (small counts) · status · Open/Close (admin only) | Open confirmation: "Opening {area} lets checked members there see each other. We'll email them." |
| **Feedback** | The existing list, plus filters (page, rating, signed in or not) | — |
| **Audit** | Filter bar (event type, actor, subject, dates, outcome), a 50-row table, "Load more" | Payloads shown as key/value pairs |

**Accessibility:** tables have header cells; status uses text plus colour; every destructive action needs a confirmation dialog (`role="dialog" aria-modal`).

**Size** M.

## DES-12: Type and contrast: ₦/Yoruba glyphs, placeholder and faint text

**Findings (designer, `docs/design/design-system.md` §5–6):**
- Schibsted Grotesk and Hanken Grotesk have no `₦` or `Ṣ`, and `app/layout.tsx` loads only the `latin` subset.
- `placeholder:text-stone-400` on white is about 2.52:1, and the landing page's `text-ink/40` on cream is about 2.74:1. Both fail AA.

**Decision needed (founder; designer recommends):**
- Adopt **Plus Jakarta Sans + Inter** with the `latin`, `latin-ext` and `vietnamese` subsets (ENG-26).
- Set placeholder and secondary text to `ink-500` or an equivalent of 4.5:1 or better (ENG-27).
- Lagos opens on 11 Nov, so ₦ prices render in a fallback font until ENG-26 ships in S1. That's acceptable for FT because the glyph still displays, just in a different typeface.

**Size** S.
