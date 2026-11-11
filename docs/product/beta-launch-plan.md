# Housemate public beta: launch plan

| | |
|---|---|
| Status | **Draft for founder decision.** Nothing here is approved scope until the founder approves it. **Update, 9 Nov 2026:** founder decision D1 (real people only, London and Lagos, launch 11 Nov) supersedes §3.1–3.2 and §10. The executable plan and work packs are in [`beta/`](beta/README.md). |
| Author | product-manager agent |
| Date | 9 Nov 2026 |
| Decision this serves | Should we open Housemate to real people through a public announcement? If so, in what shape, when, and what must be true first? |
| Outcome it serves | Real people sign up, find real people to live with, and talk to them. Their behaviour and feedback then decide the next set of work. |

Claim labels used throughout: **Fact** (with a source), **Assumption**, **Hypothesis** (with a test and what would disprove it), **Recommendation**.

---

## 0. Executive summary

1. **Research mode as it stands can't support the announcement.** *Fact:* production runs `APP_ENV=research` (`lib/env.ts`, `scripts/switch-to-research.sh`, live banner checked on 9 Nov 2026). Each account gets a private world of auto-replying sample housemates, and `sandboxWorldId` keeps every tester walled off from every other (`lib/matching.ts`). Real users therefore never meet each other, which is the one thing the founder wants this launch to test.
2. **The dormant `beta` mode is the right base, but it's not ready for strangers.** It already does real email codes, no personas or sample worlds, and identity checks by staff before anyone can be discovered or send an introduction. Six gaps would hurt real users or mislead them:
   - **No notifications outside the app.** People won't know someone introduced themselves, so reply rates will collapse.
   - **"Demo" trust copy still shows in beta.** The safety page, score chips and report receipts still say "Demo" or "simulated".
   - **Sample homes and demo viewings are reachable alongside real people.** That's a safety risk: two real strangers could arrange to meet at a home that doesn't exist.
   - **Moderation is weak.** No way to suspend an account and no way to resolve a report.
   - **Clarity loads without the consent signal** that Microsoft has required for UK/EEA visits since 31 Oct 2025.
   - **The legal and email gates are still open.** No verified sending domain, and the privacy notice is a draft template.
3. **Recommended shape:** a **gated, single-city beta for real people only** (no sample people mixed in). Sign-up is open, but discovery unlocks in **area cohorts** once there's enough local density. Cohorts are released through the identity check that already exists, and that check doubles as a short discovery interview. A **Tally waitlist** opens first and picks the city and areas from real demand. The scope is the core loop only: register, get verified, discover, introduce, chat, and optionally agree a household plan. Homes, viewings, the application and move-in are switched off in beta.
4. **Feedback:** keep the **built-in feedback form** for quick in-context feedback (we own the data and it's tied to the account). Use **Tally (free plan)** for the waitlist and for one structured survey, opened from triggered prompts and an email on day 7. Microsoft Clarity stays, but only with consent.
5. **Timeline:** close the research round and make decisions this week. Build and get legal sign-off from 16 to 27 Nov. Run a closed friends-and-family beta on 30 Nov. Soft-launch to the waitlist on **Mon 7 Dec 2026**. Make the public announcement **Mon 11 Jan 2027** (recommended, to avoid the holiday lull; the alternative is 7 Dec). Decision readout **Mon 8 Feb 2027**. All of this depends on legal advice coming back in time.

---

## 1. Problem

**Problem.** People who need to share a home have to judge whether a stranger is a good person to live with, and whether their plans actually fit (dates, budget, area, habits, money). They do this through listings sites and group chats that are built around rooms, not people. *Hypothesis H0:* Housemate's edge is helping them find the right person safely and confidently. Disproved if, once real people can see each other, they don't introduce themselves, don't reply, or say that matches were no more useful than what they already use.

**Who has it (assumed segments, carried over from the research kit):** students and graduates moving into a flatshare, young professionals relocating, and people with a room to fill. All in London or Lagos.

**How we know.** *Fact:* no customer research results exist in the repo. The November 2026 research round's findings are unknown to me; I asked for them under Open decisions. *Fact:* the research kit (`~/Downloads/Housemate — User Testing Kit.md`) contains hypotheses and a method but no results. Its QA findings from 1 Nov are about the product, not about customers.

**What changes if we solve the launch question.** We find out, from real behaviour, whether two real people who match will actually introduce themselves and talk. A prototype with bots can't tell us that, and it's the riskiest assumption in the business.

**Riskiest assumptions for this launch, in order:**

| # | Assumption | Why it's risky | Cheapest test |
|---|---|---|---|
| A1 | **Liquidity:** enough real people in one city and window pass all of match-v1's hard constraints with each other | match-v1 has 7+ hard two-way constraints (`CLAUDE.md` §8). A small pool could give most people zero matches | Offline compatibility analysis on research-round inputs (§3.4), plus the waitlist density gate |
| A2 | **Initiation:** matched real people send an introduction, and the other person replies | No out-of-app notifications exist, and strangers are hesitant | The beta itself: intro and accept rates |
| A3 | **Trust friction:** a manual identity check is acceptable and doesn't cause drop-off | It adds a step before any value | Drop-off between publish and verified; survey Q8 |
| A4 | **Ops capacity:** the founder can verify people and moderate reports at the pace sign-ups arrive | One person, no tooling for suspension | Cap cohort sizes; measure time to verify |

---

## 2. Live-site review (first-time visitor view, 9 Nov 2026)

**Method and limits.** I fetched `/`, `/signin`, `/privacy`, `/terms` and `/safety` from https://gethousemate.vercel.app and read the signed-in pages' source code. **I did not run a persona on production.** Doing so creates accounts in the live research database (`CLAUDE.md` rules 11 and §11), and my tools can't drive a signed-in browser session. A full click-through on staging in beta mode is a must-have QA task (§5, O3).

### 2.1 Ready, or close to ready, for a public announcement

- **It's honest.** The banner "Prototype: all people, checks and homes are samples." appears at the top and bottom. The "Checks completed — not a guarantee of safety" wording, the "Sample housemate · replies automatically" labels and "No real money" are all live. *Fact:* landing and sign-in pages.
- **The proposition is clear:** match on move-in dates, areas and habits, then agree the money stuff in writing. Match reasons are concrete.
- **Sign-in works without email in research mode**, using an on-screen code with consent marked "Required" (live `/signin`). The 1 Nov blocker (`EMAIL_SEND_FAILED`) was worked around this way, not fixed. See §5.
- **There are public Privacy, Terms and Safety pages,** plus a Feedback button and link-preview images.
- **Beta mode's core gates already exist in code:** identity goes to `manual_review` on publish (`app/api/v1/me/search/publish/route.ts`), only verified people are discoverable (`lib/matching.ts`), and intros need both people verified (`app/api/v1/introductions/route.ts`).

### 2.2 What would confuse or mislead real users after switching to beta

| # | Where | Issue | Evidence | Severity |
|---|---|---|---|---|
| R1 | `/safety` | The page isn't environment-aware. It says every badge reads "Demo verified" and that "Prototype support is simulated". Both would be false and confusing in beta | *Fact:* `app/safety/page.tsx` has no `IS_BETA` branch | High |
| R2 | Discover, user profile, own profile, onboarding | The score is labelled "Demo {n}/100" and "Demo credibility" in every mode. In beta it would mix one real check (email via one-time code) with a staff check, under a "Demo" label. A 0–100 number built from 2–3 inputs is also an unjustified score | *Fact:* `discover/page.tsx:119`, `users/[id]/page.tsx:72,107`, `profile/page.tsx:75`, `onboarding/page.tsx:376,388` | High |
| R3 | Report receipt | "Support in this prototype is simulated and is not an emergency service." In beta, a human must actually handle reports | *Fact:* `app/api/v1/reports/route.ts` | High |
| R4 | Household: shortlist, viewing, application, move-in | These steps run on sample homes and demo applications. With two real strangers, "book a viewing" of a sample home could lead to a real meeting at a place that doesn't exist | *Fact:* `household/page.tsx` "Sample availability" and "demo application"; `Property.sourceType` includes `sample_partner_feed` | **Safety-critical** |
| R5 | Landing | It shows a "Demo 80/100" score, "Seeded neighbourhoods across both pilots" and three made-up testimonial quotes (labelled illustrative). It also claims to be "Built on housing research across the UK and Nigeria", which is unsubstantiated in the repo. In beta the scenarios say "checks are still simulated", which would no longer be accurate | *Fact:* `app/page.tsx:74,164,218,272–275,332,373` | Medium |
| R6 | Discover empty state | With few real users, "There aren't compatible users in your city yet." will be the most common screen. There's no reason given, no expectation of when that changes, and no next step | *Fact:* `discover/page.tsx:92–99` | High (liquidity) |
| R7 | "Identity verification pending" | It says "We'll email you to arrange a short check", but nothing sends that email. Staff would have to do it by hand | *Fact:* `discover/page.tsx:82–88`; no such email in `lib/email.ts` | High |
| R8 | Notifications | In-app only. A real person who receives an intro won't find out unless they come back | *Fact:* `CLAUDE.md` §13 | High (reply rate) |
| R9 | Journeys | "I have a room to offer" is a label only. No room details, and no check that the person has the right to let the room | *Fact:* `CLAUDE.md` §13 | Medium (expectation gap) |
| R10 | Areas | Only 6 areas per city. Anyone outside them can't express where they want to live | *Fact:* `lib/constants.ts` | Medium (demand capture) |
| R11 | Privacy notice | It names no legal entity and gives no contact email ("use the Feedback button"). It cites "NDPR" rather than the Nigeria Data Protection Act 2023, gives no retention periods, and carries its own warning that it must be finalised with qualified advice | *Fact:* `app/privacy/page.tsx`; handover report §6 | Gate |
| R12 | Clarity | It loads without calling `consentv2`. Microsoft has enforced consent signals for UK/EEA/CH visits since 31 Oct 2025, and UK cookie rules (PECR) require consent for non-essential cookies anyway | *Fact:* no `consentv2` in the repo (grep, 9 Nov 2026); Microsoft Learn, Clarity Consent API v2 | Gate |
| R13 | Data export | Settings promises an export of everything we hold, but the export leaves out messages, intros, households, reports and feedback | *Fact:* handover report §6 | Medium (rights request) |
| R14 | Moderation | Nothing in the code sets `accountStatus = "suspended"`, and reports can't be triaged or resolved | *Fact:* grep shows `suspended` is only checked in `lib/guard.ts`; handover §5 | **Safety-critical** |

---

## 3. Launch shape

### 3.1 Options

| | A. Open beta, both cities | **B. Gated single-city beta, real people only (recommended)** | C. Hybrid: real people plus labelled sample housemates in one pool |
|---|---|---|---|
| What it is | Switch production to `beta` and announce widely | Production goes to `beta`. One city, open sign-up, discovery released in area cohorts once density is reached. A Tally waitlist comes first | Real users also see auto-replying sample people so nobody's feed is empty |
| Liquidity | Worst: demand split across 2 cities and 12 areas | Best achievable: concentrated in one city, a few areas and one move-in window | Looks great, but it's fake liquidity |
| Learning | Noisy: most people find zero matches and we learn little | Clean: real-to-real behaviour | Contaminated: we can't tell real engagement from bot engagement. It defeats "find other users" |
| Trust and honesty | OK | OK | **Poor.** Sample people next to real strangers breaks the honesty principle and invites confusion (or worse, someone "meeting" a bot). Needs new code |
| Ops load | Highest, unpredictable | Controlled by cohort size | Medium |
| Effort | Lowest | Low to medium (mostly the must-haves in §5) | High (matching and sandbox changes) |

**Recommendation: B.** Opportunity cost: we give up the second city's learning for about 8 weeks. We give up a reach-everyone announcement in exchange for a population that's dense enough to match. Option C is rejected because it can't answer the question the founder is asking.

*Optional add-on to B (founder decision D6):* keep the research-mode demo running at a **separate address** (e.g. `demo.<new domain>`, a Vercel deployment with `APP_ENV=research` on the `research` database). Link it as "Try a demo while you wait". This needs no code mixing, and people outside the launch city or waiting for verification still have something to do. The cost is configuration only (XS–S), but two banners and two URLs must stay unmistakable.

### 3.2 City

**Recommendation: one city, chosen from waitlist evidence by Mon 23 Nov 2026.** The decision rule:

1. Pick the city with the most waitlist sign-ups that fall in at most 3 of its areas and have a move-in month between Jan and Mar 2027.
2. If the cities are within 20% of each other, pick the one where the founder can personally recruit and run verification calls faster. That's where distribution is proven, for example where most research-round testers came from (*unknown to me*).
3. The second city is a "continue" decision at the readout (§8), not a launch decision.

*Assumption:* the founder's distribution differs between cities, and that matters more than market size for a cold start (the "atomic network" idea in Andrew Chen's *The Cold Start Problem*: a small, dense network first).

### 3.3 Waitlist vs open sign-up

**Recommendation: gated open sign-up**, which needs **no new code**:

- Anyone can sign up and publish. In beta, publishing already puts them in `manual_review` and keeps them out of discovery (Fact, publish route).
- **The identity check is the release valve.** Staff approve people in **area cohorts**. Approvals for an area open only once the pool has at least **15 published profiles in the launch city with overlapping move-in months** (an *Assumption*; tune it with the §3.4 analysis). Everyone in a cohort becomes visible on the same day, so the first visit to Discover isn't empty.
- **Before beta is live**, a Tally waitlist form (from 16 Nov) collects city, area(s), move-in month, segment and an email address. It starts building density and decides the city. The form needs its own short privacy statement (founder, legal).
- **Expectation-setting copy** (designer, §5 P3) tells people where they are in the queue in plain words: "We open each area once enough people are searching there, so you'll have someone to talk to. We'll email you."

### 3.4 Cold start and liquidity handling

| Lever | What | Owner | When |
|---|---|---|---|
| L1 Estimate match probability before launch | Run match-v1's two-way hard constraints on **real research-round testers' own search inputs** (`isDemoBot=false`, ignoring `sandboxWorldId`). Output the **proportion of same-city pairs that match**, *p*, and the top exclusion reasons. Run it read-only, report aggregates only, and copy no personal data into the repo or docs. The pool needed for a person to have at least 1 match with 70% probability is N where 1 − (1 − p)^(N−1) ≥ 0.7. For example, p = 5% gives N ≈ 25 and p = 2% gives N ≈ 60 | engineer (query), PM (interpretation) | Week of 9 Nov |
| L2 Concentrate | One city, ≤ 3 areas, a Jan–Mar 2027 move-in window, recruiting in channels where those people gather | founder | Weeks 1–4 |
| L3 Density-gated release | Cohort approvals as described in §3.3 | founder (ops) | From soft launch |
| L4 Explain empty results | The empty state shows which constraint excluded most people (the engine already collects `reasonsWhyNarrow`), offers a one-tap "widen areas, budget or dates" and promises an email when new matches appear | designer + engineer | Must-have |
| L5 Tell people when something happens | Email on: verified and discoverable, intro received, intro accepted, first unread message (throttled), new matches available | engineer | Must-have |
| L6 Don't relax match-v1 yet | Relaxing a hard constraint (e.g. move-in overlap tolerance) is a product decision. It's only worth making if L1 or beta data shows that constraint drives most exclusions. *Hypothesis H-L:* a ±14-day move-in tolerance would raise the share of people with at least 1 match without lowering intro acceptance. Test it only on data, after launch | PM, then engineer | Post-launch |
| L7 Supply seeding (no fakes) | The founder personally invites people with a room to fill, and people looking with a friend, into the launch areas. Every one of them is real and goes through the same check | founder | Weeks 1–4 |

### 3.5 Scope of the beta (what's in, what's off)

| In | Off in beta (deliberately not doing) |
|---|---|
| Email-code sign-in, consent, 18+ statement | Personas and sample worlds (already off in beta) |
| Onboarding (6 steps) and publish | **Shortlist, homes, viewings, demo application, move-in** (hidden behind `IS_BETA`) |
| Identity check (staff, live, out-of-band) | Numeric credibility score (replaced by a plain list of checks) |
| Discover, match reasons, Discuss topics | Second city (unless a founder decision overrides) |
| Introduction, chat, block, report | Groups of 3+, Journey C, room listings, payments, mobile app |
| Household **agreement only** (rent and bills split, notice, stay, notes), labelled "a record of what you both agreed, not a tenancy" | Any change to match-v1 rules before launch |
| Feedback form, survey, data export and deletion | |

*Why keep the agreement:* it's the second differentiating hypothesis ("a written agreement is valued", research kit) and it has no safety risk on its own. *Why cut homes:* R4.

---

## 4. Tally vs built-in feedback vs alternatives

| | **Built-in form** (`components/ResearchTools.tsx`, `/api/v1/feedback`, `TesterFeedback`) | **Tally** (free) | Google Forms | Typeform | Maze |
|---|---|---|---|---|---|
| Best for | Quick feedback in the moment, on the page | Structured surveys, waitlist, screener, logic | Fallback survey | Polished surveys | Task-based usability tests |
| Context capture | Page, rating, tester ID, `source`. In beta it can be tied to the account | Hidden fields via URL params, free on all plans (*Fact:* tally.so/help/hidden-fields, fetched 9 Nov 2026) | URL pre-fill | Hidden fields | Task analytics |
| Logic and branching | None | Conditional logic is free | Basic sections | Yes | Yes |
| Analytics | None. Viewed in `/staff`, SQL possible | Submissions table. Drop-off analytics and partial submissions need Pro | Basic charts and Sheets | Yes | Strong |
| Integrations | Our own database | Google Sheets, Notion and webhooks on Free | Sheets | Yes | — |
| Cost | £0 | Free: unlimited submissions (fair use). **Pro $24/month** removes branding and adds partial submissions (*Fact:* tally.so/pricing, fetched 9 Nov 2026. The research kit quoted $29, so the price has changed or differs by billing) | £0 | Free tier limited (research kit says 10 responses a month; **not re-verified**) | Paid for live-site testing (research kit; not re-verified) |
| Data location and GDPR | Our Neon database (region not checked here) and our controls | Tally BV, Ghent, Belgium. "Made and hosted in the EU", stored on "servers within the European Union". Uses Cloudflare Turnstile (US) for bot checks (*Fact:* tally.so/privacy, v1.0 dated 9 Sep 2024, fetched 9 Nov 2026). Its GDPR help page says a DPA is available. **I couldn't confirm that the free plan includes a signed DPA**, so the founder should get it | Google (US processing) | US vendor | — |
| Weakness | Very short; can't run a survey | A separate tool and login; people leave the app | Looks plain; weaker logic | Cost | Cost, overkill |

**Current wiring (Fact):** `NEXT_PUBLIC_FEEDBACK_URL` makes the Feedback pill open the external form *instead of* the built-in dialog. It's either one or the other, not both.

**Recommendation:**
- **Keep the built-in form as the Feedback pill.** Leave `NEXT_PUBLIC_FEEDBACK_URL` unset in beta. Reasons: it's contextual, we own the data, in beta it ties to the account (needed when feedback is really a safety issue), and there's no third-party processor.
- **Use Tally Free for (a) the pre-launch waitlist and (b) one structured beta survey.** Open the survey from triggered prompts and the day-7 email through a **new, separate survey link** (engineer: `NEXT_PUBLIC_SURVEY_URL`, passing hidden fields `ref`, `city`, `stage`, `source`). `ref` must be a **pseudonymous reference**, never an email or the raw user ID. Sync responses to a private Google Sheet or Notion, never to the repo.
- **Don't buy Pro** until survey drop-off becomes a question worth paying for. Revisit at the readout.
- **Clarity stays, but only with consent** (R12). If a consent banner can't ship in time, turn Clarity off in beta. We'd lose session recordings and gain compliance; database funnels cover the core metrics.

---

## 5. Must-have work before announcing

Sizing: XS < ½ day · S ½–1 day · M 2–3 days · L 4–5 days. Owner: E = engineer, D = designer, F = founder, SR = security reviewer, PM = product-manager. "Must" items are prerequisites for soft launch unless they're marked "by announcement".

### 5.1 Product (PM and designer)

| ID | Item | Size | Owner | Acceptance criteria |
|---|---|---|---|---|
| P1 | Beta copy and labels audit across landing, safety, terms, privacy, discover, user, profile, onboarding, report receipt, pending state and notifications. Remove "Demo", "simulated", "Seeded", the illustrative testimonials and the unsupported "Grounded in research" claim from beta. One `BANNER` text | M | D (copy), PM (review), E (wiring) | No user-visible string in `beta` says demo, sample, seeded or simulated, except where something really is simulated. The checklist is signed off by PM |
| P2 | Replace the 0–100 score in beta with a **list of checks**: "Email confirmed" and "Identity checked by the Housemate team, {month year}". Keep "Checks completed — not a guarantee of safety" | S | D, E | No numeric score in beta. The list matches the `VerificationCheck` rows on the server |
| P3 | Pending and waiting states: queue explanation, expected timeline, what happens next, link to the demo (if D6) | S | D, E | Matches §3.3 copy. No promise of a date we can't keep |
| P4 | Empty discover state with a reason and a "widen" action (L4) | S | D, E | Shows the top exclusion reason in plain words and a one-tap path to edit search |
| P5 | First-conversation safety card (§6) | S | D, E | Shown once per conversation to both people. Can be dismissed. Text sits alongside any icon |
| P6 | Survey and prompt spec (§7), plus building the Tally waitlist and survey | S | PM (spec), F (build in Tally) | Tested on phone and laptop. Hidden fields arrive |
| P7 | Verification call script (5 min of identity check plus 10 min of optional discovery questions) | S | PM | Separates the identity part (required) from the interview part (optional, consented) |

### 5.2 Engineering

| ID | Item | Size | Owner | Acceptance criteria |
|---|---|---|---|---|
| E1 | Hide shortlist, homes, viewings, application and move-in when `IS_BETA`, both in the UI and **on the server** (routes return 404) | S | E | No route under `properties`, `shortlist`, `viewings` or `handoffs` is usable in beta. The household page shows the agreement only |
| E2 | Transactional email through Resend: verified and discoverable; intro received; intro accepted; first unread message (at most 1 email per conversation per 6 h); new matches (at most weekly). Bodies contain no message text and no private data, plus a link to the app and a notification setting to opt out | M | E | Sent after the transaction commits. A failure never breaks the action. Each send is audited without its content |
| E3 | Moderation: report status (`open → actioned / closed`) with staff notes; **suspend and restore** an account (revokes sessions and hides from discovery; `requireUser` already blocks suspended users); all audited | M | E, SR | A staff user can suspend from a report in 2 clicks. The suspended user disappears from discovery and intros immediately |
| E4 | 18+ statement at sign-up or onboarding, stored with a timestamp. Staff check confirms it | XS | E | Can't publish without it |
| E5 | Cookie consent for Clarity plus a `consentv2` call; Clarity doesn't load until accepted | S | E, D | No Clarity request before consent (checked in the network tab) |
| E6 | Security hardening (handover §8): login codes from `crypto.randomInt`; IP rate limits on `request-code`, `verify-code` and `feedback`; block sign-in for `deletion_pending`; security headers. Hashing codes and session tokens is **recommended**, at SR's call | M | E, SR | SR sign-off |
| E7 | Metrics instrumentation (§8.1): log a `discover.viewed` audit event with `match_count` (no IDs of the people shown); a weekly funnel SQL saved for staff; survey link with hidden fields; trigger prompts (§7.1) | M | E | The funnel query reproduces every number in §8.2 from the database |
| E8 | Beta environment readiness: confirm the Neon `beta` branch state (D5); apply migrations; `ADMIN_EMAILS`; staff sign-in via emailed code works; full e2e pass of the beta flow on staging | S | E, F | A beta-mode run on staging from sign-up to verified to intro to chat to agreement, with two real inboxes (Gmail and Outlook) |
| E9 | Data export completeness (messages, intros, households, reports, feedback), **or** change the copy to match what's exported. A deletion request SOP that sets a manual purge deadline | S | E, F | What the export says matches what it does |

Engineering total is roughly 12–16 days of effort. **Cut line if time is short:** E1, E2 (the first three emails only), E3 (suspend only), E4, E5, E8 are non-negotiable. E6 needs security reviewer sign-off on whatever ships. E7 can go down to the funnel SQL only. E9 can be met with the copy-change option.

### 5.3 Legal and trust (founder owns; legal advice needed)

| ID | Item | Size | Owner |
|---|---|---|---|
| G1 | **Buy a domain**. A `vercel.app` address can't be verified with Resend. Verify it in Resend (SPF/DKIM) and set `EMAIL_FROM` | XS (plus DNS wait) | F |
| G2 | Privacy notice: named controller, contact address (a role mailbox on the new domain), lawful bases, processors (Vercel, Neon, Resend, Microsoft Clarity, Tally), international transfers, retention periods, the right to complain to the ICO and NDPC, **Nigeria Data Protection Act 2023** wording. Remove the "starting template" warning only after advice | M, plus advice | F, with legal |
| G3 | Terms for beta: acceptable use, no tenancy or agency role, suspension, no warranty, governing law | S, plus advice | F, with legal |
| G4 | Legal check that Housemate isn't acting as a letting agent in England (letting agents have redress scheme and fee obligations), with or without the "room to offer" journey. Also the equivalent position in Lagos. *I haven't verified the specific rules; this is for counsel* | advice | F |
| G5 | Gender preference: confirm the shared-accommodation basis under the UK Equality Act and the Nigerian position, because real people will now use it | advice | F |
| G6 | Data protection impact assessment, at least lightweight (strangers, location by area, gender data, verification calls) | S | F, PM, SR |
| G7 | Tally DPA signed (or confirmation that it's included) | XS | F |

### 5.4 Ops (founder)

| ID | Item | Size | Owner |
|---|---|---|---|
| O1 | Verification SOP: a live video call; the person shows photo ID **on camera only** (nothing captured or stored, consistent with `CLAUDE.md` rule 8); confirm the name matches, they're 18+ and they're in the launch city; record pass or fail only. Fail and appeal paths. Capacity: about 15 minutes per person, so **cohorts of no more than 25 a week** unless more verifiers are added (*Assumption*) | S | F, PM |
| O2 | Moderation runbook: categories mapped to actions; response targets (safety-critical first response within 4 h from 08:00 to 22:00 UK/WAT, others within 24 h); evidence handling; when to suspend; police and emergency signposting; how to log decisions | S | F, PM, SR |
| O3 | QA rehearsal on staging in beta mode with 3–5 friendly people, including a mock report and a mock suspension | S | F, E |
| O4 | Recruitment plan and channels for the launch city (§9) | S | F |
| O5 | A weekly metrics and feedback review slot (§7.3) | XS | F, PM |

---

## 6. Safety and moderation for real strangers meeting

**Principles.** *Fact:* identity verified ≠ safe, and a match ≠ compatible. Every surface says so. Safety must not depend on hidden buttons. The server enforces it.

| Risk | Control in beta | Exists? |
|---|---|---|
| Impersonation, fake profiles | Staff live identity check before anyone is discoverable or can introduce; 18+ confirmed | Gate exists; SOP is new (O1) |
| Unwanted contact, harassment | Intro limits (10 a day, 20 pending, 30-day cooldown), immediate silent two-way block, report, **suspend** (new) | Partly (E3) |
| Rent, deposit and "holding fee" scams, money requests | The existing money-wording caution in chat; a safety card ("Never pay a deposit or holding fee before you've seen the home in person and checked who the landlord is. Housemate never asks you for money."); a report category for money requests | Caution exists; card is new (P5) |
| Romance or relationship-seeking misuse | Terms (G3) and a report category | Check that the categories cover it |
| Meeting offline | Card: video call first; meet in a public place; tell a friend where you'll be; you can leave at any time; don't share your exact address until you trust them. Homes and viewings are off in beta (E1), so Housemate never sets up an in-person meeting | New |
| Stalking or location exposure | Areas only; postcode never shown; no maps (*Fact:* `CLAUDE.md` rule 6) | Exists |
| Staff reading private chats | Not possible today (*Fact:* safety page). For harassment reports, the reporter pastes the relevant text into the report (up to 1,000 characters) or emails a screenshot to the support mailbox. Consent-based conversation sharing is post-beta | Policy |
| Emergencies | "Housemate is not an emergency service. If you're in danger call 999 (UK) or 112 (Nigeria)." *These numbers should be confirmed by the founder or legal before publishing* | New copy |
| Report retaliation and gaming | Reports never change scores (Fact); the target isn't told who reported | Exists |

**Pause triggers (§8.3):** any credible report of physical harm, sexual harassment or money lost via a Housemate contact pauses new cohorts until it's reviewed. The security reviewer is told.

**Handoff to the security reviewer:** E1, E3, E6, the R4 safety risk, the verification SOP's data handling, and the Clarity consent implementation.

---

## 7. The feedback loop

### 7.1 In-app prompts and triggers

All prompts can be dismissed, are shown at most once each, and use the built-in form unless they say "survey". *Spec for engineer and designer, part of E7.*

| # | Trigger | Prompt | Tool | Decision it informs |
|---|---|---|---|---|
| T1 | Profile published | "How easy was setting up your profile?" (1–7) plus optional "What slowed you down?" | Built-in | Onboarding friction |
| T2 | Discover shows 0 matches (second visit) | "What were you hoping to find?" | Built-in | Liquidity vs constraint design |
| T3 | 48 h after the first intro is sent, or 24 h after an intro is accepted | A card: "Two minutes: tell us how meeting people here went" | **Survey** | Core value |
| T4 | Day 7 after being verified (everyone, including people who never sent an intro) | Email plus in-app card for the survey | **Survey** | Why activation succeeds or fails |
| T5 | Pause search or delete account | "What's the main reason?" (single choice plus optional text) | Built-in | Churn reasons |
| T6 | Always | The Feedback pill | Built-in | Bugs and usability |

### 7.2 Draft survey (Tally, about 4 minutes, 12 questions)

Hidden fields: `ref` (pseudonymous), `city`, `stage` (furthest funnel step from the database), `source`.

| # | Question | Type | Decision it informs |
|---|---|---|---|
| 1 | Which describes you best? Student or recent graduate · Moving for work · I have a room to fill · Looking with a friend for a place · Other | Single choice | Which segment to build for first; Journey A/B/C priority |
| 2 | When do you need to move? This month · 1–3 months · 3–6 months · Not sure | Single choice | Window targeting; urgency vs liquidity |
| 3 | Where else are you looking for housemates right now? (SpareRoom, Facebook or WhatsApp groups, friends, agents, other) | Multi-select plus other | Positioning against alternatives; acquisition channels |
| 4 | How relevant were the people Housemate showed you? (1–5; "I didn't see anyone" option) | Scale | Is match-v1 producing useful matches? |
| 5 | What made someone feel right or wrong for you? | Short text | Missing compatibility signals (working hours, shared space, etc.) |
| 6 | Was there anyone you wanted to see but didn't, or a filter that felt too strict? (Dates · Budget · Areas · Habits · Gender preference · Other) | Multi-select | Which hard constraint to relax or soften (L6) |
| 7 | How comfortable did you feel contacting, or being contacted by, someone here compared with where else you look? (1–5) | Scale | How much to invest in trust |
| 8 | The identity check was… Worth it · Fine · Too much effort · I didn't do it (why?) | Single choice plus logic | Verification strategy (manual vs vendor vs optional) |
| 9 | Did you agree, or try to agree, a household plan (rent, bills, notice)? Yes, useful · Yes, not useful · No, not needed · No, didn't get that far | Single choice | Is the agreement a differentiator? |
| 10 | Rank what would help you most next: rooms listed by people with a room · searching as a group of 3+ · joining an existing household · email/WhatsApp alerts · more lifestyle questions (e.g. working hours) · finding and viewing homes together | Ranking | Next roadmap slice |
| 11 | How would you feel if you could no longer use Housemate? Very disappointed · Somewhat · Not disappointed | Single choice | Early pull signal. With N < 50, treat it as colour, not a target |
| 12 | Can we contact you for a 20-minute call? (yes, then your email) | Opt-in | Interview recruitment |

### 7.3 Triage into the roadmap

- **Same day:** anything that mentions safety, harassment, money requests or a data issue goes from feedback, survey or report into the moderation runbook (O2), and from there to the security reviewer if needed.
- **Weekly (Mon), 60 minutes, founder and PM:**
  1. Funnel numbers (§8.2) against targets.
  2. Tag every new feedback and survey text: `bug` · `usability` · `liquidity` · `matching-quality` · `trust/safety` · `feature-request` · `positioning`.
  3. Count **distinct people** per tag. A pattern is at least 3 different people, or at least 20% of respondents; anything less is a lead (rule from the research kit).
  4. Map patterns onto the opportunity tree under the outcome "matched real people start a meaningful conversation". Pick at most one assumption test or fix per week.
  5. Bugs go straight to the engineer backlog by severity.
- **Outputs:** a one-page weekly note (`docs/product/beta-weekly/YYYY-MM-DD.md`, aggregates only, no personal data or quotes that could identify someone). The readout (§8.3) feeds the next PRD.

---

## 8. Success metrics and kill or continue criteria

### 8.1 Instrumentation

*Fact:* there's no product analytics. Every metric below is computed from database tables (`User`, `Profile`, `VerificationCheck`, `Introduction`, `Message`, `Household`, `HouseholdPlan`, `TesterFeedback`, `Report`, `Block`) plus the new `discover.viewed` event (E7). Clarity is for qualitative work only.

### 8.2 Funnel targets (proposed, launch city, measured over cohorts)

**No baseline exists.** These are proposed targets for the founder to confirm. They're set so that missing them clearly means something, not as forecasts.

| Stage | Definition | Target |
|---|---|---|
| Sign-ups | Accounts created in the launch city in 4 weeks after soft launch | ≥ 150 |
| Activation | Published / signed up | ≥ 60% |
| Verified | Identity verified within 5 days / published | ≥ 70% |
| **Liquidity** | Verified people with ≥ 1 match on first discover view after cohort release | **≥ 60%** |
| Intro sent | Verified with ≥ 1 match who send ≥ 1 intro within 7 days | ≥ 40% |
| **Mutual interest** | Intros accepted within 7 days / intros sent | **≥ 35%** |
| **Meaningful conversation** | Accepted intros where both sides send ≥ 3 messages | **≥ 50%**, and ≥ 15 conversations in total |
| Household plan proposed | Plans proposed / meaningful conversations | Watch only, no target |
| Feedback | Survey completes / verified users | ≥ 30% |
| Feedback | People using the in-app form at least once / active users | ≥ 15% |

**Guardrails:** safety reports per 100 verified users (watch the level and category); **0** unresolved safety-critical reports older than 24 h; blocks per accepted intro; email code delivery (codes sent → verified) ≥ 90%; median time from publish to verified ≤ 72 h; deletion requests handled within the promised window.

### 8.3 Readout criteria (Mon 8 Feb 2027, about 4 weeks after the public announcement)

| Result | Criteria (all from §8.2) | Action |
|---|---|---|
| **Continue and expand** | Liquidity ≥ 60%, mutual interest ≥ 35%, ≥ 15 meaningful conversations, and the survey shows people value it | Open the next areas or the second city; write the next PRD from the top-ranked survey items |
| **Iterate on liquidity** | Sign-ups ≥ target but liquidity < 40% | Stop paid or broad promotion. Narrow the areas, test the L6 constraint change, recruit supply into the dense areas |
| **Iterate on initiation** | Liquidity OK but intros or acceptance below half of target | Test intro prompts, notification timing, profile depth (interviews first) |
| **Rethink** | < 75 sign-ups after the announcement, **or** < 5 meaningful conversations, **or** most people rate matches ≤ 2 out of 5 | Return to discovery: positioning and segment problem, not a build problem |
| **Pause immediately** (any time) | A credible serious safety incident, a data breach, or a scam that worked through a Housemate contact | Stop new cohorts; incident review with the security reviewer; tell the founder the same day |

---

## 9. Announcement plan

- **Message:** "Find people whose plans fit yours, then agree the money stuff in writing before anyone moves in. Free early access in {city}, opening {areas} first. Every user's identity is checked by our team. Checks aren't a guarantee of safety, so meet safely."
- **Sequence:**
  1. Tally waitlist (from 16 Nov): personal network, research-round testers who opted in, 2–3 community groups in the target areas.
  2. Friends-and-family beta (30 Nov).
  3. Soft launch to the waitlist (7 Dec).
  4. Public announcement (11 Jan 2027, recommended): founder's social posts, university and graduate-scheme groups, relocation communities, the WhatsApp and Facebook groups where flatshares are already discussed. *Follow each group's rules; no spam.*
- **Tracking:** every link carries `?source=<channel>`, which the app already stores and tags.
- **Link previews** already exist; check them with the new domain.
- **Incentive (optional, F decides):** a prize draw for survey completers. Terms are needed if it's run.
- **Not doing:** paid ads, press, or a launch in the second city.

---

## 10. Timeline (from Mon 9 Nov 2026)

| Dates | Milestone | Owner(s) |
|---|---|---|
| **Mon 9 – Fri 13 Nov** | Founder decisions D1–D8. Share the research-round findings. Buy the domain (G1). Engage legal advice (G2–G5). Run the L1 liquidity analysis. PM finalises the PRD-level acceptance criteria for E1–E9 | F, PM, E |
| **Mon 16 Nov** | Tally waitlist live with its privacy statement | F |
| **16 – 27 Nov** | Build E1–E9 and P1–P5. Design copy. Security review of E1, E3, E5, E6. Draft privacy notice and terms to counsel. SOPs O1 and O2 written | E, D, SR, F, PM |
| **Mon 23 Nov** | **City and areas chosen** from waitlist data (§3.2) | F, PM |
| **Fri 27 Nov** | Staging in beta mode: full e2e pass, QA at 375 px, SR sign-off. **Go / no-go for the friends-and-family beta** | E, SR, PM |
| **Mon 30 Nov – Fri 4 Dec** | Closed friends-and-family beta (10–15 real people in the launch city) running in production beta mode. Rehearse the verification SOP and a mock moderation case. Fix what it finds | F, E |
| **Fri 4 Dec** | Legal sign-off received (G2, G3) **or the soft launch slips**. Production switched to beta (the founder runs the deploy; `CLAUDE.md` §10) | F |
| **Mon 7 Dec** | **Soft launch:** invite the waitlist; first area cohort released once the density threshold is met | F |
| **Mon 14 & 21 Dec** | Weekly reviews; cohort 2 if capacity allows | F, PM |
| **21 Dec – 3 Jan** | Holiday lull: hold new cohorts, keep moderation cover, fix bugs | F, E |
| **Mon 11 Jan 2027** | **Public announcement** (recommended date) | F |
| **Mon 18 Jan, 25 Jan, 1 Feb** | Weekly reviews | F, PM |
| **Mon 8 Feb 2027** | **Readout:** continue, iterate, rethink or pause (§8.3); next PRD | PM, F |

*Alternative (D3):* announce publicly on 7 Dec straight after the friends-and-family beta. That's faster, but it lands in the December lull, with less time to fix what friends and family find, and with legal sign-off on the critical path. *Assumption:* engagement drops over the holidays; I haven't verified seasonal flatshare demand.

---

## 11. Open decisions for the founder (each with my recommendation)

| # | Decision | Recommendation |
|---|---|---|
| D1 | Launch shape: A, B or C (§3.1) | **B**, a gated single-city beta with real people only |
| D2 | City: data-led by 23 Nov, or decided now? | Data-led from the waitlist, with your distribution as the tie-breaker |
| D3 | Public announcement on 11 Jan 2027 or 7 Dec 2026? | **11 Jan 2027**, with soft launch to the waitlist on 7 Dec |
| D4 | Identity check: keep it mandatory before discovery (current beta), or make it optional with "Identity not checked" shown? | **Mandatory** for this beta. It's the safety floor and doubles as interviews. Revisit at the readout based on survey Q8 and the publish→verified drop-off. Making it optional is a safety decision that needs security reviewer input |
| D5 | The Neon `beta` branch may hold real people from the 6 Oct – 1 Nov pilot (*unknown*). Notify them, migrate them, or delete them? | Find out first. If real people are there, email them about the relaunch under the new privacy notice. Delete if they don't respond within 30 days, subject to legal advice |
| D6 | Keep a separate research-mode demo at a demo subdomain? | **Yes**, if it's on a clearly separate address with its own banner. It's cheap and gives waiting or out-of-area people something to try |
| D7 | Keep the household agreement in beta? | **Yes**, the agreement only; homes and viewings are off |
| D8 | Clarity in beta: consent banner, or off? | Consent banner (E5). If it can't ship by 4 Dec, **turn it off** |
| D9 | Can you staff verification and moderation (about 6 h a week at 25 verifications plus report cover)? Who covers when you can't? | Name a second trusted verifier or moderator before soft launch, or cap cohorts lower |
| D10 | Incentive for the survey (prize draw)? | Optional. Only with simple published terms |
| — | **Please share:** the research-round findings (Nov 2026), whether Resend currently works, and where research testers were recruited (city split) | These change D2, the copy and the targets |

---

## 12. Handoffs

- **Designer:** §2.2 (R1–R7), §3.3, §3.5, §5.1 P1–P5, §6 safety card, §7.1 prompts. Constraints: UK English, honesty labels, 375 px, 44 px targets, no numeric score in beta.
- **Engineer (once approved):** §5.2 E1–E9 with their acceptance criteria, §7.1 triggers, §8.1–8.2 funnel definitions, and the L1 analysis (read-only, aggregates only).
- **Security reviewer:** §6, E1, E3, E5, E6, the O1 data handling, D4 and D5.

## Sources (fetched 9 Nov 2026)

- Live site: https://gethousemate.vercel.app/ and `/signin`
- Tally pricing: https://tally.so/pricing
- Tally hidden fields: https://tally.so/help/hidden-fields
- Tally privacy notice (v1.0, 9 Sep 2024): https://tally.so/privacy
- Tally GDPR help: https://tally.so/help/gdpr (via search result; the page content wasn't read in full)
- Microsoft Clarity Consent API v2 (enforcement from 31 Oct 2025 for EEA/UK/CH): https://learn.microsoft.com/en-ca/clarity/clarity-consent-api-v2
- Repo files cited inline; `~/Downloads/Housemate — User Testing Kit.md`; `~/Downloads/Housemate_Handover_Report.md` (8 Nov 2026)
