# Peabudy beta: work pack index

| | |
|---|---|
| Status | **Draft for execution. Not yet approved scope.** Written 9 Nov 2026 by product-manager; updated 9 Nov 21:30 for the domain and the rename |
| Name | **Peabudy** (renamed from Housemate by the founder, 9 Nov 2026). Brand text in these packs says Peabudy. Code identifiers keep their names: the repo, the `housemate-platform` Vercel project, `housemate_db`, `hm_session`, test email patterns. The name is subject to the check in F-17 / D13 |
| Domain | **`peabudy.com`, bought on Vercel on 9 Nov (F-01 done).** Sender: `Peabudy <hello@peabudy.com>` (F-02). Site: `https://peabudy.com` once the founder points it at the project (F-02 part F) |
| Parent plan | [`../beta-launch-plan.md`](../beta-launch-plan.md). §3.1–3.2 and §10 there are superseded by founder decision D1 below |
| Files | [`engineer.md`](engineer.md) (ENG-01…28, about 38 days) · [`designer.md`](designer.md) (DES-01…12, about 9 days) · [`security.md`](security.md) (SEC-01…12) · [`founder.md`](founder.md) (F-01…F-17) · [`legal/`](legal/) ([privacy notice](legal/privacy-notice.md), [terms](legal/terms.md), [DPIA](legal/dpia.md): AI drafts with placeholders, not legal advice) |
| Founder decisions folded in (9 Nov) | **D1:** real people only, London + Lagos, 11 Nov. **Email:** buy a sending domain; `vercel.app` can't be verified with Resend (F-01 done: `peabudy.com`; F-02). **Name:** Peabudy. **Legal:** Claude drafts the notice, terms and DPIA (`legal/`), with an AI-draft banner and placeholders; counsel reviews them. **Back office MVP:** ENG-07, 11, 13, 16, 21–24 · DES-11 · SEC-12 |
| Visual source | [`../../design/design-system.md`](../../design/design-system.md) (being written in parallel), plus the designer's Peabudy rebrand (in progress). No fast-track ticket depends on adopting either |

---

## Who is doing what now (Mon 9 Nov, 21:30)

| Who | Working on now | Must land before the go/no-go (Tue 10 Nov 18:00) | Deliberately **not** on the 11 Nov path |
|---|---|---|---|
| **Founder** | F-02 parts A–E tonight (Resend, DNS, env vars), then F-17 (name check, handles) | F-02 verified and part H passed · F-03 · F-04 placeholders by 12:00 · F-06 waitlist · F-08/F-09 rehearsals · D11 and D13 in writing | F-05 booking (by Wed), F-07, F-15 |
| **Designer** | Rebranding the UI to Peabudy; an interactive, mascot-led landing page and conversational onboarding (inspired by a conversational onboarding video); a mobile pass | The name styling and wordmark ENG-28 needs (tonight if possible) · DES-01 FT rows · DES-02 · DES-03 · DES-04 pending state · DES-07 waitlist · DES-08 announcement, all in Peabudy's name | **The mascot landing and the conversational onboarding.** The landing can ship after 11 Nov once it passes the honesty rules. Onboarding needs a PM review first (guardrails below) |
| **Engineer** | Repo clean-up; starting ENG-02, ENG-01, ENG-06, ENG-08 (the right order: ENG-02 closes the worst gap) | Those four, plus **ENG-28 (FT part)**, ENG-03 FT, ENG-04, ENG-07 FT, ENG-09, ENG-10 FT, ENG-25 interim | **Repo clean-up beyond what the FT tickets need.** It must not delay them; do the rest from Thu 12 Nov |
| **Security reviewer** | A full pre-launch loophole review | **SEC-11 fast-track sign-off by about 17:00 Tue**, with any blocker raised to PM and founder as soon as it's found, not at the end | High and Medium findings from the full review go into S1/S2 by severity (security.md) |
| **PM** | This update; F-08/F-09 rehearsals with the founder; reviewing the onboarding concept | Go/no-go pack for 18:00 | — |

**Guardrails for the mascot-led onboarding** (PM requirements for the designer; the full review follows when there's a concept):
1. It still collects every field matching needs (journey, city and areas, budget, move-in window, stay length, the six dealbreakers, gender and housemate preference) with the same meanings, or the engineer must change `lib/matching.ts` too. Any change to a question's options is a matching change, so bring it to PM.
2. The mascot never promises an outcome: no "I found your perfect match", "compatible", "safe" or percentage language. Gender and housemate preference stay private and are explained as private.
3. Every step works without the animation: reduced-motion respected, screen-reader labels, 44 px targets, 375 px first, and typing answers is never the only way to answer.
4. Consent, the privacy link and (later) the 18+ declaration stay explicit and separate. A chatty tone mustn't turn them into a pre-ticked or buried step.

## Timeline check after buying the domain (9 Nov, 21:30)

**Is the 10 Nov 16:00 email gate still realistic? The DNS part is. Inbox placement is uncertain. The bigger risk is now engineering capacity.**

| Step | Earliest realistic | Needed by | Verdict |
|---|---|---|---|
| F-02 A–E: Resend domain, records, keys, env | Tonight, about 45 min | Tonight | Realistic |
| Resend shows `peabudy.com` Verified | Tonight to 07:00 Tue. Resend says Auto Configure usually takes minutes, manual up to a few hours | **12:00 Tue (tripwire)** | Realistic |
| ENG-28 FT: the code email says Peabudy | Tue morning (S, but needs the name styling) | Before the rehearsal | Tight |
| ENG-08 + staging set up as beta | Tue around 13:00 | 14:00 Tue | Tight: the engineer is also doing ENG-02/01/06 and repo clean-up |
| F-11 / ENG-10 rehearsal with Gmail, Outlook, Yahoo | 14:00–16:00 Tue | **16:00 Tue** | At risk if anything above slips |
| Codes land in inboxes from a day-old domain | — | 16:00 Tue | **Uncertain.** *Assumption:* authenticated, low-volume, user-requested codes usually reach a Gmail inbox; Outlook and Yahoo may file a new domain's mail as junk. Warm-up takes weeks, so it can't be finished by 11 Nov |

**What changes:**
1. **Keep the 16:00 gate, with clearer pass rules** (founder.md F-02 part H): verified; SPF, DKIM and DMARC pass at all three providers; Gmail in the inbox; Outlook or Yahoo in junk is acceptable only with the "check junk" mitigation; any non-delivery or Gmail spam fails.
2. **Add a 12:00 Tue tripwire.** If Resend isn't verified, or ENG-02 and ENG-28 (FT) aren't on staging by 12:00, call Option C then, not at 18:00. The announcement still goes out on 11 Nov (pointing to the waitlist), and cohort 1 opens on Mon 16 Nov.
3. **Repo clean-up and the mascot work come off the critical path** (above).
4. **My honest read:** the email gate itself is achievable. The whole fast-track is now about 7 engineer-days (ENG-28 added) in about 1.5 calendar days with one engineer, while a rebrand is under way. The chance of Option B on 11 Nov is lower than it was this morning. Option C costs five days and buys the full rebrand, a warmer domain and counsel's first look at the name. I'm keeping B as the plan, with the go/no-go; if the 12:00 tripwire trips, take C without further debate.

---

## Read this first: what 11 November can and can't be

**Founder decision D1 (9 Nov 2026):** real people only, **London and Lagos**, launch on **Wed 11 Nov 2026**.

**Plainly: an open public sign-up, where anyone can register, browse and message real strangers, is not safe or honest to ship on 11 Nov.** The `CLAUDE.md` non-negotiables are:

- honest labels
- identity granted only by staff
- no fake verification in beta

Beta mode already meets the last two (*Fact:* `publish/route.ts` sets identity to `manual_review` and only `staff/verifications/[userId]` grants it). Honest labels can be met by 11 Nov **only if** the fast-track copy fixes ship (ENG-03, ENG-04).

These gaps can't be closed by 11 Nov:

| Can't be done by 11 Nov | Why | Risk if we open anyway | Safest stopgap |
|---|---|---|---|
| **Legal sign-off** on the privacy notice and terms (UK GDPR / DPA 2018 / PECR; Nigeria Data Protection Act 2023) | Needs counsel; it takes days to weeks. **Drafts are ready** in `legal/` (AI-written, placeholders, not legal advice) | Processing real people's data under unreviewed text. The current live notice also makes inaccurate statements: it says feedback is "anonymous, not your name" when signed-in feedback stores `userId`, and it names no controller or contact | The founder fills the placeholders (F-04). The engineer publishes the drafts as the **interim notice** (ENG-25). The founder accepts the risk in writing (D11). Invite-led cohort only. Counsel reviews by 4 Dec |
| **Transactional email** (ENG-12, 4 days) | Too big for 2 days | People won't know they've had an intro, so replies stall | The founder tells each cohort member personally (email or WhatsApp) when they're verified, and asks them to check the app daily. Cohort size is capped |
| **Domain + Resend verification** (*can* be done by 11 Nov; the domain is bought) | `vercel.app` can't carry the SPF/DKIM records Resend needs. Resend's test sender only reaches the account owner. On-screen codes would let anyone sign in as any address. **`peabudy.com` was bought on Vercel on 9 Nov (F-01 done)**; verification usually takes minutes to hours | **Hard blocker.** Beta login is email-only (`DEMO_MODE` is forced off in beta, `lib/env.ts`). If codes don't arrive, nobody can sign in. A day-old domain's deliverability is unproven | **F-02 tonight:** add `peabudy.com` in Resend, records on Vercel DNS (Auto Configure, or SPF/DKIM/MX plus DMARC), set `RESEND_API_KEY` and `EMAIL_FROM` (`Peabudy <hello@peabudy.com>`). Optionally serve the site from `peabudy.com`. If the 10 Nov rehearsal fails F-02 part H's pass rules, fall back to Option C |
| **Moderation UI** (suspend/restore, report resolution; ENG-11) | 2.5 days | Can't act quickly on abuse | A SQL suspension runbook (ENG-11 stopgap). The founder is on call. Cohort only |
| **Area-by-area opening** (ENG-13) | 4 days | 12 areas across 2 cities spreads liquidity thin | Staff approve verifications in **area cohorts** by hand (zero code). Invitations go only to people in 2–3 areas per city |
| **Clarity consent** (ENG-14) | Needs a banner | Breaks PECR and Microsoft's consent requirement (enforced for UK/EEA since 31 Oct 2025) | **Clarity off in beta** (leave `NEXT_PUBLIC_CLARITY_ID` unset in the switch script) |
| **IP rate limits and headers** (ENG-18) | 2 days | Abuse of the auth endpoints | Invite-led traffic. Per-email limits already exist (`request-code`: 5 an hour) |
| **Survey prompts** (ENG-15) | 2 days | Fewer survey responses | The founder emails the Tally survey link on day 7 |
| **Data export parity** (ENG-17) | 1 day | The "everything we hold" claim is untrue | Change the copy (DES-01 #27) and fulfil wider requests by hand |

### Options for 11 Nov

| | A. Open public beta, both cities, 11 Nov | **B. Public announcement + waitlist on 11 Nov; invite-only early access opens the same day (recommended)** | C. Waitlist only on 11 Nov; product opens 30 Nov |
|---|---|---|---|
| What the public gets on 11 Nov | Sign up and use the product | The announcement links to the **Tally waitlist** (both cities). A founder-invited **first cohort of up to 20 per city** gets the app link | The waitlist only |
| Who can use the product | Anyone | Invited people. Anyone else who finds the URL can sign up, but stays **pending and sees nobody** (ENG-02) until staff verify them | Nobody until 30 Nov |
| Meets the non-negotiables? | Only with the fast-track copy fixes | Yes, with the fast-track tickets | Yes |
| Safety and legal posture | **Not acceptable.** Unreviewed notice, no moderation UI, verification queue unbounded | Accepted by the founder, explicitly: small known cohort, live ID checks, interim accurate notice, founder on call | Best |
| Learning | Noisy (liquidity spread thin) | Real-to-real behaviour from day 1, in controlled areas | Two weeks of waitlist demand data only |
| Dependency | Everything | **Fast-track scope below, plus Resend working by 10 Nov 16:00 UK** | Full scope |

**Recommendation: B, with an explicit go/no-go at 18:00 UK on Tue 10 Nov.** If any fast-track exit criterion fails, run **C** for 11 Nov (the announcement still goes out, pointing to the waitlist) and open the product to cohort 1 on **Mon 16 Nov**.

**Full-scope date for comparison:** everything in §5 of the parent plan, adjusted for two cities:

- go/no-go **Fri 27 Nov**
- area-by-area opening from the waitlist starts **Mon 30 Nov**
- **open sign-up in both cities: Mon 7 Dec 2026**

The fast-track is roughly **5.75 engineer-days of work in about 1.5 calendar days**. That's feasible only with parallel work streams and the founder accepting a narrower QA pass (the 10 Nov rehearsal). That's the main schedule risk, and it's why Option C is the named fallback.

---

## Both cities: what changes from the single-city plan

| Topic | Change |
|---|---|
| Liquidity | Each city opens on its own schedule, **2–3 launch areas per city** at first. Opening is by verification cohorts until ENG-13 ships, then by the `AreaOpening` switch in the ops console. The density threshold is set per city and area: at least 10 published profiles with overlapping move-in months before an area opens (*Assumption*, to tune with the L1 analysis in the parent plan) |
| Money | *Fact:* matching compares **monthly-equivalent** budgets (`lib/matching.ts` `rentMinMonthly`), so London's GBP monthly and Lagos's NGN annual figures already compare correctly. Waitlist and survey questions ask each city in its own period (DES-07). Metrics report budgets in each city's own currency and period; currencies are never combined |
| Metrics | Every funnel number is **split by city** (ENG-16). Targets are per city (below). The readout decides continue or iterate **for each city separately** |
| Verification and moderation load | *Fact (time zones):* London is UTC+0 until late March and Lagos is UTC+1 (WAT) all year, so they're one hour apart in Nov–Mar. One cover window, 08:00–22:00 UK (09:00–23:00 Lagos), works for both. Load: cohort 1 is up to 40 people at about 15 minutes each, roughly 10 hours in week 1. **D9 (a second verifier) is urgent** |
| Legal scope | UK: UK GDPR, DPA 2018, PECR (cookies), and whether the ICO data protection fee applies. Nigeria: **NDPA 2023** and any NDPC registration or implementation requirements. Cross-border transfers (Neon and Vercel hosting regions vs Nigerian residents' data). The gender preference under the Equality Act 2010 and Nigerian law. Letting-agent status in both. *All for counsel; I haven't verified the specific thresholds* |

### Proposed targets (no baseline exists; the founder confirms them)

| Metric | Cohort 1 (11 Nov – 4 Dec), per city | Full scope (4 weeks after 7 Dec), per city |
|---|---|---|
| Verified members | ≥ 15 | ≥ 50 |
| Liquidity (verified with ≥ 1 match) | ≥ 50% | ≥ 60% |
| Intro accepted / intros sent | ≥ 35% | ≥ 35% |
| Meaningful conversations (both sides ≥ 3 messages) | ≥ 5 | ≥ 15 |
| Survey completes / verified | ≥ 40% (founder-invited) | ≥ 30% |
| Unresolved safety-critical reports older than 24 h | 0 | 0 |

---

## Fast-track scope (ships by 11 Nov, Option B)

| Ticket | What | Size | Owner |
|---|---|---|---|
| ENG-01 | Hide homes, viewings, application and move-in in beta (UI + server 404) | S | E |
| ENG-02 | **Beta: unverified viewers see nobody, and unverified targets are invisible** (new finding: today a pending account can call `/recommendations` and `/users/[id]` and see real verified people) | S | E |
| ENG-03 (FT part) | Beta copy wiring for DES-01's "FT" rows, plus a static safety note in every conversation | S of M | E + D |
| ENG-04 | Replace the 0–100 score with a list of completed checks in beta | S | E + D |
| ENG-06 | Auth fixes: `crypto.randomInt` codes, block sign-in for `deletion_pending`, re-consent when the privacy version changes | S | E |
| ENG-07 | Staff verification queue shows areas, move-in window and journey | XS | E |
| ENG-08 | `scripts/switch-to-beta.sh` and the env checklist (the founder runs it) | S | E → F |
| ENG-09 | Read-only checks of the beta database and staff sign-in | XS | E + F |
| ENG-10 (FT part) | Staging rehearsal with real inboxes | S | E + F |
| ENG-25 (FT part) | Publish the interim privacy notice and terms (`legal/` drafts, placeholders filled) in beta, plus the `privacy-v2` re-consent | S | E (after F-04) |
| ENG-28 (FT part) | **Peabudy rename** of the code email, sign-in, metadata/link previews, banner and legal pages (code identifiers unchanged) | S | E + D (name styling) |
| SEC-11 | Fast-track security review (10 Nov) | — | SR |
| DES-01 (FT rows), DES-02, DES-03 (text), DES-04 (pending state), DES-07 (waitlist), DES-08 (announcement) | Copy and content, in Peabudy's name | — | D |
| founder.md F-01 (done) … F-09, F-17 | Domain (bought), Resend, interim notice, Tally, runbooks, name check | — | F |

The 18+ declaration (ENG-05) moves to Sprint 1. Its stopgap is that the verification call confirms the person is 18+ from their photo ID, and staff approval already sets `adultEligible` (*Fact:* `staff/verifications/[userId]/route.ts`).

---

## Sprints to the 27 Nov go/no-go

| Sprint | Dates | Engineer | Designer | Security | Founder |
|---|---|---|---|---|---|
| **0 — fast-track** | Mon 9 – Tue 10 Nov | ENG-01, 02, 03 (FT), 04, 06, 07 (FT), 08, 09, 10 (FT), 25 (interim), 28 (FT) | Name styling for ENG-28; DES-01 (FT rows), 02, 03, 04 (pending state), 07 (waitlist), 08. Rebrand, mascot landing and mobile pass in progress, off the critical path | SEC-11 (gate), SEC-02; full loophole review under way | F-01 ✓, F-02…F-04, F-06, F-08, F-09, F-11, F-12, F-16 (D11, D13), F-17 |
| Launch | Wed 11 Nov | Switch support and smoke test | — | Watch | F-13 switch, F-14 announcement and cohort 1 invites, verification calls |
| **1** | Thu 12 – Fri 20 Nov | Back office first: ENG-24, 11, 21, 07 (SLA), 22, 16. Then ENG-12, 05, 10 (e2e_beta), 26, 27, 28 (rest); the rest of the repo clean-up | Mascot landing (after the honesty check); onboarding concept to PM review; DES-11, 05, 04 (rest), 09, 10, 12, 01 (rest), 07 (survey) | SEC-01, 03, 04, 05, 06, 07, 12 | Cohort 1 ops, F-05 counsel, F-07 registrations, F-10 purge SOP, F-15 second verifier |
| **2** | Mon 23 – Fri 27 Nov | ENG-13, 14, 15, 17, 18, 20, 23, 03 (rest), 19 (optional) | DES-06, 08 (open sign-up copy) | SEC-08, 09, 10, 12 (close), and the full go/no-go | Counsel's mark-up, runbooks v2 |
| | | **Capacity warning:** S1 + S2 hold about 30 engineer-days in 12 working days. That needs parallel streams or a second engineer; otherwise apply the cut line | | | |
| Go/no-go | **Fri 27 Nov** | All exit criteria in security.md met | | | Decides 30 Nov area opening and 7 Dec open sign-up |

---

## Dependency graph

```
F-01 domain (peabudy.com, done 9 Nov) ─► F-02 Resend DNS verified ─► ENG-08 switch script env ─► ENG-10 rehearsal ─► GO (10 Nov 18:00) ─► 11 Nov launch
designer name styling ─► ENG-28 rename (code email says Peabudy) ─► ENG-10 rehearsal
F-17 name knock-out search ─► D13 (announce as Peabudy, or cohort only) ─► GO
                                   └────► ENG-12 transactional email ─► ENG-13 area-opened emails
ENG-01 hide homes ─┐
ENG-02 verified-only browsing ─┼─► SEC-11 fast-track review ─► GO
ENG-03/04 copy + checks list ◄── DES-01/02/03/04
ENG-06 auth fixes ─┘
legal/ drafts ─► F-04 founder fills placeholders ─► ENG-25 interim notice + ENG-06 privacy-v2 re-consent ─► GO
F-05 counsel ─► final text ─► ENG-25 (S2, privacy-v3 if material) ─► 7 Dec
ENG-07 queue shows areas ─► manual area cohorts (stopgap) ─► ENG-13 AreaOpening (replaces stopgap)
DES-11 ─► ENG-24 back office shell + role matrix ─► ENG-11 suspend · ENG-21 reports · ENG-22 users · ENG-23 audit · ENG-16 metrics ─► SEC-12 ─► 27 Nov GO
DES-12 ─► ENG-26 fonts (₦, Ṣ) · ENG-27 contrast
ENG-16 metrics ◄── ENG-13 (area dimension), ENG-02 (gate field)
ENG-15 survey link ◄── F-06 Tally survey built (DES-07)
ENG-14 consent banner ◄── DES-06 ─► Clarity back on (founder sets env)
F-05 legal advice ─► final notice + terms (ENG-25 S2) ─► 7 Dec open sign-up
```

## Critical path

**Fast-track:**
- The main chain: ~~F-01 buy the domain~~ (done 9 Nov: `peabudy.com`) → **F-02 Resend verified tonight, with `RESEND_API_KEY` and `EMAIL_FROM` set** (12:00 Tue tripwire) → ENG-28 FT + ENG-08 env → **ENG-10 rehearsal meeting F-02 part H's pass rules by 16:00 UK on 10 Nov** → SEC-11 sign-off → go at 18:00.
- In parallel on the critical path:
  - ENG-02 and ENG-01. Without them, B isn't safe.
  - F-04 (placeholders filled by 12:00 on 10 Nov) → ENG-25 interim notice.
  - F-17 knock-out search (by 12:00) → D13.

**Full scope:**
- F-05 counsel → final notice and terms by 4 Dec.
- In parallel:
  - the back office, ENG-24 → ENG-11/21 (needed for a real moderation response at volume)
  - ENG-12 email → ENG-13 area opening
- Then the 27 Nov go/no-go → 7 Dec.

## Cut line

- **Fast-track, never cut:** ENG-01, ENG-02, ENG-03 (FT rows), ENG-04, ENG-06, ENG-08, ENG-09, ENG-10 rehearsal, ENG-25 (interim), ENG-28 (FT: at least the code email), SEC-11, F-02…F-04, D11 written, D13 decided.
- **Fast-track, cut first:** repo clean-up, the mascot landing and onboarding, the full (non-FT) security review findings below High.
  - If any of these misses 10 Nov 18:00, go with Option C.
- **Full scope, never cut (needed for 7 Dec):** ENG-24 + ENG-21 (back office shell and report queue), ENG-11, ENG-12 (the identity, intro and message events only), ENG-13 (or keep the manual cohort stopgap, but that caps growth at the founder's verification capacity), ENG-14 (or keep Clarity off), legal sign-off.
- **Cuttable for 7 Dec:**
  - ENG-12's area-opened and weekly-matches emails
  - ENG-15 prompts (keep the emailed survey)
  - ENG-16 UI (keep the endpoint)
  - ENG-17 (keep the copy-change option)
  - ENG-18 hashing (if SR agrees)
  - ENG-19
  - ENG-20 widen actions (keep the existing "Adjust my search" link)

## Dropped after checking the code (already exists, or not needed)

| Plan item | Why dropped | Evidence |
|---|---|---|
| Turn off personas and sample worlds in beta | Already off | `lib/env.ts`: `DEMO_MODE` is forced false in beta and `SANDBOX_ON_SIGNUP = IS_RESEARCH`; `auth/demo-persona` returns 404 when `!DEMO_MODE` |
| Require both people verified before an intro | Already enforced | `introductions/route.ts:113–118` |
| Add a report status column | Already in the schema | `Report.status` (open/triaged/resolved). ENG-11 only adds resolution fields |
| Build a "leave household" action | Already exists | `households/[id]` action `leave` |
| Money-request caution in chat | Already exists | `conversations/[id]/messages/route.ts:82` |
| In-app notifications for intro, accept, message and check result | Already exist | `notify(...)` calls; ENG-12 builds email on top of them |
| Discover empty state naming the narrowest filters | Partly exists | `discover/page.tsx:100–104`, so ENG-20 is smaller |
| Seed guard for the beta database | Already exists | The seed refuses `APP_ENV=beta` without `FORCE_SEED` (`CLAUDE.md` §4) |

## Changes from the parent plan

1. **D1:** both cities, 11 Nov, Option B fast-track (was single city, 7 Dec soft launch, 11 Jan announcement).
2. **New must-have, ENG-02:** in beta, unverified accounts can currently see verified real people. This wasn't in the plan.
3. **New must-have in ENG-06:** `verify-code` only checks *whether* consent exists, not which version (`if (!prior?.privacyConsentAt)`). A new notice wouldn't trigger re-consent.
4. **New copy defects:**
   - Discover's subtitle says the chip is "match strength" while the chip shows credibility.
   - The landing "Room host" scenario describes features that don't exist: room authority review, and an address that unlocks at viewing.
   - The feedback dialog and privacy notice claim feedback is anonymous, but signed-in feedback stores `userId`.
5. **Clarity is off in beta** until ENG-14 ships (was: consent banner before launch).
6. The 18+ declaration moves to Sprint 1; the staff check covers it in the meantime.
7. **Email domain:** a bought domain is required. This is now founder tickets F-01/F-02 and sits on the critical path.
8. **Legal:** AI drafts of the privacy notice, terms and DPIA are in `legal/`. ENG-25 publishes the interim version; counsel reviews by 4 Dec.
9. **Back office MVP** added: ENG-21 (report queue with open, investigating, actioned and dismissed, plus an action log), ENG-22 (user search and detail), ENG-23 (audit viewer), ENG-24 (shell, role matrix, staff reads audited), plus SLA in ENG-07, DES-11 and SEC-12. Already existing: the identity queue with approve/reject, the feedback list, the reports list (read-only) and the latest-100 audit list.
10. **Design findings** added:
    - ₦ and Ṣ are missing from the current fonts, and only the latin subset is loaded (ENG-26, DES-12).
    - Placeholder and faint landing text fail contrast (ENG-27).
    - The Discover score chip should go. The designer read the chip as the 0–60 match score; the code shows it's the credibility score (`lib/matching.ts:271,289`). It's mislabelled either way, so remove it (ENG-04, DES-01 #18).
11. **Rename and domain (9 Nov, evening):** the product is now **Peabudy**, on `peabudy.com` (F-01 done). New: ENG-28 (user-facing rename), F-17 (name check and handles), D13 and D14. F-02 is now a click-by-click checklist. The 16:00 email gate stays, with clearer pass rules and a 12:00 tripwire.

## Open decisions (D2 moot; D3 onward still open, my recommendation in brackets; D13 and D14 added 9 Nov evening)

- **D3** Timing of the open-sign-up announcement: [7 Dec open sign-up; 11 Nov is the waitlist announcement and invite-only cohort]
- **D4** Identity check: [mandatory]
- **D5** Real people from the 6 Oct pilot in the beta database: [find out in ENG-09; email them before relaunch]
- **D6** Separate demo deployment: [yes, Sprint 2, optional]
- **D7** Keep the household agreement: [yes, the agreement only]
- **D8** Clarity: [off until consent ships]
- **D9** Second verifier and moderator: [needed this week, given two cities]
- **D10** Survey incentive: [optional]
- **New, D11:** Accept Option B's residual risk in writing (interim notice, SQL-only moderation, cohort only)? [Yes, or choose C]
- **New, D12:** Launch areas per city, 2–3 each: [London: two or three adjacent areas from the waitlist; Lagos: Yaba plus one or two neighbours. Decide from waitlist data by 13 Nov]
- **New, D13 (by Tue 10 Nov 18:00):** Announce publicly as Peabudy on 11 Nov, given the one-letter closeness to "Peabody", a large London housing association? [Run F-17's knock-out search first. If there's no conflicting live mark in classes 36 or 45, announce as Peabudy and get counsel's view within two weeks. If there is one, run the invite-only cohort without a public announcement until counsel advises]
- **New, D14 (by Fri 13 Nov):** When does the mascot-led landing and conversational onboarding ship? [Landing: after 11 Nov, once it passes the honesty rules. Onboarding: after a PM review against the guardrails above, and an A/B or before/after comparison of onboarding completion, so we learn whether it helps rather than assume it does]
