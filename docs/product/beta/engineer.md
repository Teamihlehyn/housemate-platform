# Engineer work pack: Peabudy beta

> Status: **draft, pending founder approval** (9 Nov 2026). Index and order: [`README.md`](README.md). Product rules: `CLAUDE.md` (authoritative).
> **Name:** the product is now **Peabudy** (founder, 9 Nov 2026; domain `peabudy.com`). Brand text in this pack says Peabudy; code identifiers (`housemate-platform`, `housemate_db`, `hm_session` and so on) stay as they are. See ENG-28.
> Working assumptions until the founder decides: **D1 = both cities, real people only, 11 Nov fast-track (founder decision)**. D3–D12 use the recommendations in README.md, and every ticket that depends on one names it.
> Every ticket must meet `CLAUDE.md` §10's definition of done. Every state change writes `writeAudit` (plus `writeOutbox` where listed) **in the same transaction**. Audit payloads are allow-listed: never message bodies, emails, phone numbers, report text or tokens.

**Sizes:** XS ≈ ¼ day · S ≈ ¾ day · M ≈ 1½–2 days · L ≈ 4 days. **Sprint:** FT = by 10 Nov 18:00 UK · S1 = 12–20 Nov · S2 = 23–27 Nov.

**Mode checks:** server code uses `IS_BETA` from `lib/env.ts`; client code uses `process.env.NEXT_PUBLIC_APP_ENV === "beta"`. Unless a ticket says otherwise, behaviour in `development` / `staging` / `research` must stay **unchanged**, so both existing e2e suites must keep passing.

## Summary

| ID | Title | Size | Sprint | Depends on | Assumes |
|---|---|---|---|---|---|
| ENG-01 | Beta: switch off homes, viewings, application, move-in (UI + server 404) | S | FT | — | D7 |
| ENG-02 | Beta: verified-only browsing (viewer and target) | S | FT | — | D4 |
| ENG-03 | Beta copy wiring + in-conversation safety note | M (FT part S) | FT/S2 | DES-01, DES-03 | D1 |
| ENG-04 | Beta: list of completed checks replaces the 0–100 score | S | FT | DES-02 | — |
| ENG-05 | 18+ declaration at sign-in | S | S1 | DES-09 | — |
| ENG-06 | Auth fixes: secure codes, deletion-pending sign-in, re-consent on new privacy version | S | FT | ENG-25 (version bump) | — |
| ENG-07 | Verification queue: areas, move-in window, age, SLA | S (FT part XS) | FT/S1 | ENG-24 | D9 |
| ENG-08 | `scripts/switch-to-beta.sh` + production env checklist | S | FT | F-01–F-03 | D8 |
| ENG-09 | Beta database and staff sign-in checks (read-only) | XS | FT | F-02 | D5 |
| ENG-10 | Staging rehearsal with real inboxes + `tests/e2e_beta.py` | M (FT part S) | FT/S1 | ENG-01/02/04/06/08 | — |
| ENG-11 | Suspend / restore an account with a reason (back office) | M | S1 (SQL stopgap FT) | ENG-24 | — |
| ENG-12 | Transactional email via Resend + preferences + unsubscribe | L | S1 | F-02, DES-05 | — |
| ENG-13 | Area-by-area opening per city + configurable launch cities | L | S1–S2 | ENG-24 | D1, D12 |
| ENG-14 | Clarity consent banner + `consentv2` | S | S2 | DES-06 | D8 |
| ENG-15 | Tally survey link with hidden fields + triggered prompts | M | S1 | F-06, DES-10 | D10 |
| ENG-16 | Funnel metrics per city + `discover.viewed` event | M | S1 | ENG-24 | — |
| ENG-17 | Data export parity | S | S2 | — | — |
| ENG-18 | Security hardening (IP rate limits, headers/CSP, token hashing) | M | S2 | SEC-01, SEC-08 | — |
| ENG-19 | Optional: separate research-mode demo deployment | XS | S2 | F-01 | D6 |
| ENG-20 | Discover empty state with "widen search" actions | S | S1 | DES-04 | — |
| ENG-21 | Report queue: statuses, resolution and action log (back office) | M | S1 | ENG-24 | — |
| ENG-22 | Back office: user search and user detail | M | S1 | ENG-24 | — |
| ENG-23 | Back office: audit trail viewer (filters, paging) | M | S2 | ENG-24 | — |
| ENG-24 | Back office shell: tabs, role matrix, staff reads audited | M | S1 | DES-11 | — |
| ENG-25 | Put the final privacy notice and terms into `app/privacy` and `app/terms` (beta) | S | FT (interim) / S2 (final) | F-04, legal drafts | D11 |
| ENG-26 | Fonts: ₦ and Yoruba glyph coverage (Plus Jakarta Sans + Inter, latin-ext + vietnamese subsets) | S | S1 | DES-12 | — |
| ENG-27 | Contrast fixes: placeholder text and faint landing text | XS | S1 | DES-12 | — |
| ENG-28 | Peabudy rename: user-facing brand strings only (code identifiers unchanged) | S | FT (email, sign-in, metadata, legal pages) / S1 (rest) | Designer's rebrand (name, wordmark) | — |

**Total ≈ 38 engineer-days. FT ≈ 7 days** (ENG-28's FT part added 9 Nov). **Repo clean-up is not in the FT total:** it must not delay ENG-02, 01, 06 or 08. S1 + S2 have 12 working days for about 29½ days of work, so this needs parallel work streams or a second engineer. If neither exists, cut using the cut line in README.md.

**Dropped after checking the code:** turning off personas and sample worlds (already off in beta, `lib/env.ts`); the intro verification gate (exists, `introductions/route.ts:113`); a report status column (exists, `Report.status`); a leave-household action (exists); the money-request caution (exists).

---

## ENG-01: Beta: switch off homes, viewings, application and move-in

- **Problem.** These steps run on sample homes and demo applications (`household/page.tsx` "Sample availability", "demo application"). With two real strangers, "book a viewing" of a sample home could lead to a real meeting about a home that doesn't exist. That's a safety risk and it breaks the honesty rule.
- **User story.** As a beta member in a household, I see only the written agreement, so I'm never led to a viewing or application that isn't real.
- **In scope:**
  - In beta, the server returns `404 NOT_FOUND` ("This isn't available in early access.") for every method on:
    - `app/api/v1/properties/route.ts`
    - `app/api/v1/households/[id]/shortlist/route.ts`
    - `app/api/v1/shortlist/[id]/vote/route.ts`
    - `app/api/v1/households/[id]/viewings/route.ts`
    - `app/api/v1/viewings/[id]/route.ts`
    - `app/api/v1/households/[id]/handoffs/route.ts`
    - `app/api/v1/handoffs/[id]/route.ts`
    - `app/api/v1/households/[id]/move-in/route.ts`
  - The household page shows only the Overview / agreement tab in beta.
  - Landing STAGES 04–05 are hidden in beta (copy in DES-01).
  - In beta, a household that has agreed the latest plan shows a final state, "Agreement in place", instead of progressing to `viewing` (UI only; `derivedStage` logic is unchanged).
- **Out of scope:** deleting the code or data; changing research mode; "leave household" (it stays).
- **Acceptance criteria:**
  - Given `APP_ENV=beta` and a signed-in household member, when they `POST /api/v1/households/{id}/viewings`, then the response is 404 `NOT_FOUND` and no row is written.
  - Given `APP_ENV=beta`, when any route listed above is called by any user, then it returns 404, and the existing auth order is preserved (an unauthenticated call still returns 401 first).
  - Given `APP_ENV=beta`, when a member opens `/household`, then only the agreement and the leave action are visible. No "Shortlist", "Viewings", "Application" or "Move-in" tab or text appears, at 375 px or on desktop.
  - Given `APP_ENV=research`, when `tests/e2e_research.py` runs, then all 34 checks pass (no regression).
- **Files:** the routes listed above; `app/(app)/household/page.tsx` (tabs at lines 109–158); `app/page.tsx` (STAGES, lines 155–161). Suggest a helper in `lib/env.ts`, e.g. `export const HOMES_ENABLED = !IS_BETA;`.
- **Data / migration:** none.
- **Audit/outbox:** none (no state change).
- **Tests:** `tests/e2e_beta.py` (ENG-10): "homes routes 404 in beta" for each route; "household page shows agreement only" (API: `households/current` still works).
- **Size** S · **Depends on** — · **Assumes** D7 (keep the agreement).

## ENG-02: Beta: verified-only browsing

- **Problem (new finding).**
  - *Fact:* `GET /api/v1/recommendations` doesn't check whether the **viewer** is identity-verified. In beta, the pool only filters **candidates** by verification (`lib/matching.ts:147–150`).
  - *Fact:* `GET /api/v1/users/[id]` checks neither the viewer nor the target for verification (`users/[id]/route.ts:27–35`).
  - So anyone who signs up with an email address and publishes a profile can browse real, verified people's bios, areas, budgets and dates without an ID check. They can also view published-but-unverified people by ID.
- **User story.** As a verified member, I'm only visible to other people whose identity the team has checked.
- **In scope (beta only):**
  - `recommendations`: if the viewer's identity check isn't `verified`, return 200 with `{ candidates: [], exclusions: { narrowFilters: [], excludedCount: 0 }, gate: "identity_pending" }`. Don't run matching.
  - `users/[id]`: return generic 404 ("This profile is no longer available.") if the viewer **or** the target isn't identity-verified.
  - Discover renders the pending state from `gate` (copy in DES-04) and no longer depends on a second `/me` call.
- **Out of scope:** research/dev behaviour; staff views (ENG-22 has its own route).
- **Acceptance criteria:**
  - Given beta and a published viewer whose identity is `manual_review`, when they call `GET /recommendations`, then `candidates` is empty and `gate` is `"identity_pending"`.
  - Given beta and an unverified viewer, when they call `GET /users/{verifiedId}`, then the response is 404 with the same body as for a missing user.
  - Given beta and a verified viewer, when they call `GET /users/{unverifiedPublishedId}`, then the response is 404.
  - Given beta, two verified, compatible members, when either calls `GET /recommendations`, then the other appears (no regression).
  - Given research mode, all `e2e_research.py` checks pass.
- **Files:** `app/api/v1/recommendations/route.ts`, `app/api/v1/users/[id]/route.ts`, `app/(app)/discover/page.tsx` (lines 39–55, 82–90). Move `identityVerified()` from `introductions/route.ts` into `lib/` (e.g. `lib/verification.ts`) and reuse it in all three routes.
- **Data / migration:** none.
- **Audit/outbox:** none.
- **Tests:** e2e_beta: "pending viewer sees no candidates", "pending viewer gets 404 on a verified profile", "verified viewer can't see an unverified profile", "two verified members see each other".
- **Size** S · **Assumes** D4 (identity check stays mandatory).

## ENG-03: Beta copy wiring + in-conversation safety note

- **Problem.** Many strings are wrong or misleading in beta ("Demo", "simulated", "Seeded", made-up testimonials, "match strength" describing the credibility chip). The full list with replacement text is DES-01.
- **User story.** As a real person, nothing on the site tells me something is checked, real or simulated when it isn't.
- **In scope:**
  - **FT:** implement every DES-01 row marked **FT**.
  - **FT:** a static, dismissible safety note at the top of every conversation thread in beta (text in DES-03; dismissal stored per conversation in `localStorage`).
  - **S2:** all remaining DES-01 rows.
  - Where text differs by mode, branch on `IS_BETA` (server components) or `NEXT_PUBLIC_APP_ENV` (client).
  - Don't change research copy unless DES-01 says "all modes".
- **Out of scope:** visual redesign (`docs/design/`); legal text (ENG-25).
- **Acceptance criteria:**
  - Given beta, when the built HTML of `/`, `/safety`, `/terms`, `/signin` and the signed-in pages is grepped for `Demo`, `demo`, `sample`, `Sample`, `simulated`, `Seeded`, `prototype` and `Prototype`, then there are no matches except the allow-list in DES-01 (e.g. "not a demo").
  - Given beta, when a member opens any conversation, then the safety note shows, has a working dismiss button with a 44 px or larger target, and stays dismissed for that conversation after a reload.
  - Given research mode, all `e2e_research.py` checks pass, and the research banner and labels are unchanged.
- **Files:**
  - `app/page.tsx`, `app/safety/page.tsx`, `app/terms/page.tsx`, `app/signin/page.tsx`
  - `app/(app)/discover/page.tsx`, `app/(app)/members/[id]/page.tsx`, `app/(app)/profile/page.tsx`, `app/(app)/onboarding/page.tsx`, `app/(app)/settings/page.tsx`, `app/(app)/messages/[id]/page.tsx`
  - `components/ResearchTools.tsx`
  - `app/api/v1/reports/route.ts` (receipt text)
  - `app/api/v1/feedback/route.ts` (429 text)
  - `lib/env.ts` (`BANNER`)
  - `lib/constants.ts` (city labels "London pilot" / "Lagos pilot")
- **Data / migration:** none.
- **Audit/outbox:** none.
- **Tests:** add a `tests/copy_beta.sh` (or an e2e_beta step) that fetches the public pages from a local beta server and greps for the banned words. Manual check at 375 px.
- **Size** M (FT part S) · **Depends on** DES-01, DES-03.

## ENG-04: Beta: list of completed checks replaces the 0–100 score

- **Problem.** A 0–100 score built from two or three inputs can't be justified, and today it's labelled "Demo" everywhere: `discover/page.tsx:119`, `members/[id]/page.tsx:72,107`, `profile/page.tsx:75`, `onboarding/page.tsx:376`.
- **User story.** As a member, I see plainly which checks someone has completed, and that this isn't a guarantee of safety.
- **In scope (beta):**
  - Replace the score chip and the breakdown card with the checks list from DES-02, built from `credibility.components` (`category`, `status`). Show only `verified` checks as done.
  - Identity shows "Identity checked by the Peabudy team · {Month YYYY}", using `VerificationCheck.checkedAt`. Expose `checkedAt` (month precision only) in the credibility DTO.
  - Keep the "Checks completed — not a guarantee of safety." line.
  - Don't render a number anywhere in beta.
- **Out of scope:** changing `lib/credibility.ts` scoring or snapshots (they keep running server-side); research-mode display.
- **Acceptance criteria:**
  - Given beta and a verified member, when another verified member views their card or profile, then they see "Email confirmed" and "Identity checked by the Peabudy team · November 2026" and no digits followed by "/100".
  - Given beta, when `GET /users/{id}` is called, then the response contains each check's month (`"2026-11"`) and not its full timestamp.
  - Given research mode, the score display is unchanged.
- **Files:** the four pages above; `app/api/v1/users/[id]/route.ts`; `app/api/v1/me/route.ts` (check that it returns `credibility`); `lib/credibility.ts` (DTO only).
- **Tests:** e2e_beta: "public profile has no numeric score field shown" (assert the DTO month format); manual check of the UI at 375 px.
- **Size** S · **Depends on** DES-02.

## ENG-05: 18+ declaration at sign-in

- **Problem.** Nothing asks people to confirm they're 18 or over before they create an account. The staff check sets `adultEligible`, but only after the person has signed up.
- **User story.** As Peabudy, we only create accounts for people who say they're 18+, and the live check confirms it.
- **In scope:**
  - A second required checkbox on `/signin` in beta and research ("I'm 18 or over"; DES-09).
  - `verify-code` requires `confirm_adult: true` for **new** accounts, and for existing accounts without `adultDeclaredAt`. Check it **before** the code is consumed, using the same pattern as consent (`verify-code/route.ts:39–46`).
  - Store `User.adultDeclaredAt`.
  - Return 422 `VALIDATION` with `field_errors.confirm_adult = "Confirm you're 18 or over to continue."` if it's missing.
- **Out of scope:** date of birth collection; ID age checks (the staff call does this).
- **Acceptance criteria:**
  - Given beta and a valid code, when `verify-code` is called without `confirm_adult`, then the response is 422 and the code is **not** consumed (a second call with `confirm_adult: true` succeeds with the same code).
  - Given a new account created with `confirm_adult: true`, then `adultDeclaredAt` is set and the audit row `auth.adult_declared` exists.
  - Given research mode, the persona route also requires the declaration (update `e2e_research.py` to send it).
- **Files:** `app/signin/page.tsx`, `app/api/v1/auth/verify-code/route.ts`, `app/api/v1/auth/demo-persona/route.ts`, `prisma/schema.prisma`, `tests/e2e_research.py`, `tests/e2e_gender.py` (send the new field).
- **Data / migration:** `npm run db:migrate:dev -- --name adult_declaration`, adding `User.adultDeclaredAt DateTime?` (additive, null by default).
- **Audit:** `auth.adult_declared` (actor = user, `resourceType` user), in the same transaction as the update.
- **Tests:** e2e_beta "18+ required, code survives", "declared timestamp set". Update both existing e2e suites.
- **Size** S · **Stopgap until shipped:** the verification SOP checks age from the photo ID (founder.md F-08).

## ENG-06: Auth fixes: secure codes, deletion-pending sign-in, re-consent on a new privacy version

- **Problem (Facts):**
  - `request-code/route.ts:28` uses `Math.random()` for login codes.
  - `verify-code` lets a `deletion_pending` account sign straight back in. The account then works normally, because `requireUser` only blocks `suspended` and `getCurrentUser` only blocks `deleted`.
  - `verify-code` only asks for consent when `privacyConsentAt` is null. It never compares `privacyConsentVersion` with `PRIVACY_VERSION`, so the new notice (ENG-25) wouldn't trigger re-consent.
- **User story.** As a member, my sign-in code can't be guessed, a deletion I asked for isn't quietly undone, and I'm asked to agree when the privacy notice changes.
- **In scope:**
  1. Generate codes with `crypto.randomInt(100000, 1000000)`.
  2. In `verify-code`, after the code check and before creating a session: if `accountStatus === "deletion_pending"`, return 403 `FORBIDDEN` with "Your account is being deleted. If you want to keep it, email [CONTACT EMAIL]." The contact address comes from `NEXT_PUBLIC_CONTACT_EMAIL` (new env var, set in ENG-08). Don't consume the code.
  3. Consent: require `accept_privacy` when `privacyConsentVersion !== PRIVACY_VERSION`, with the same 422 `CONSENT_REQUIRED` and the code preserved. The sign-in page shows "We've updated our privacy notice" when the API returns this for an existing user (DES-09).
  4. Bump `PRIVACY_VERSION` to `"privacy-v2"` in `lib/constants.ts` in the same release as ENG-25 (interim text).
- **Out of scope:** hashing codes or session tokens (ENG-18).
- **Acceptance criteria:**
  - Given a user with `privacyConsentVersion = "privacy-v1"` and `PRIVACY_VERSION = "privacy-v2"`, when they verify a correct code without `accept_privacy`, then the response is 422 `CONSENT_REQUIRED` and the code still works on retry with `accept_privacy: true`. After that, `privacyConsentVersion = "privacy-v2"`.
  - Given a `deletion_pending` user, when they verify a correct code, then the response is 403, no `Session` row is created, and audit `auth.session_denied` is written with `reasonCode = "deletion_pending"`.
  - Given 1,000 generated codes in a unit test, all are 6-digit strings between 100000 and 999999.
- **Files:** `app/api/v1/auth/request-code/route.ts`, `app/api/v1/auth/verify-code/route.ts`, `lib/constants.ts`, `app/signin/page.tsx`.
- **Audit:** `auth.session_denied` (outcome `denied`); `auth.consent_recorded` (`safeAfter: { version }`).
- **Tests:** new `tests/auth.unit.ts` (code format; consent-needed logic as a pure function `needsConsent(user, version)`); e2e_beta "re-consent on version bump", "deletion-pending can't sign in". Add the new unit file to `npm run test:unit`.
- **Size** S.

## ENG-07: Verification queue: areas, move-in window, age and SLA

- **Problem.** The queue shows name, email, phone and city only (`staff/verifications/route.ts`; `staff/page.tsx:52–75`). Staff can't release people in area cohorts or see who's been waiting too long.
- **User story.** As a verifier, I can see each person's areas, move-in window and how long they've waited, so I verify in area cohorts and within our target time.
- **In scope:**
  - **FT:** add `areas` (labels), `moveWindow` (`earliestDate`–`latestDate`), `journey` and `waitingHours` to each case. Sort oldest first. Add filters by city and area (client-side is fine).
  - **S1:** SLA flags. Target: **first contact within 24 h, decision within 72 h** of publish (*Assumption*, confirm with F-08).
    - Show "Waiting 30 h" in amber after 24 h and red after 72 h, with text and not colour alone.
    - Show a count of cases over 72 h per city at the top.
    - Add a "Contacted" marker (`VerificationCheck.contactedAt`) that staff set after first contact.
- **Out of scope:** booking calendar; automatic reminders.
- **Acceptance criteria:**
  - Given 3 pending cases published 2 h, 30 h and 80 h ago, when the queue loads, then they're listed oldest first, show "Waiting 80 h" (red, labelled "Over 72 h") and "Waiting 30 h" (amber, "Over 24 h"), and the per-city overdue count is 1.
  - Given a verifier marks a case as contacted, then `contactedAt` is set and audit `verification.contacted` is written with `actorType` staff.
  - Given a member (non-staff), when they call `GET /staff/verifications`, then the response is 403 `FORBIDDEN`.
- **Files:** `app/api/v1/staff/verifications/route.ts`, `app/api/v1/staff/verifications/[userId]/route.ts` (new `action: "contacted"`), `app/(app)/staff/page.tsx` (moves into the ENG-24 shell).
- **Data / migration (S1):** `VerificationCheck.contactedAt DateTime?` (additive).
- **Audit:** `verification.contacted`.
- **Tests:** e2e_beta "queue sorted oldest first, includes areas", "member forbidden".
- **Size** S (FT part XS) · **Assumes** D9.

## ENG-08: `scripts/switch-to-beta.sh` + production env checklist

- **Problem.** There's no tested way to switch production to beta. `scripts/switch-to-research.sh` only goes the other way. *Fact (`CLAUDE.md` §2.12, §12):* the sandbox blocks agents from `git push origin main` and production `vercel env` changes, so the **founder runs it**.
- **In scope:** a script modelled on `switch-to-research.sh`:
  - **Inputs** from the environment, never echoed: `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAILS`, `NEXT_PUBLIC_CONTACT_EMAIL`, optional `NEXT_PUBLIC_SURVEY_URL`, `EMAIL_LINK_SECRET` (needed once ENG-12 ships).
  - **Guards:** refuse placeholders (`yourdomain`, `example`, an empty value, `onboarding@resend.dev`). Refuse an `EMAIL_FROM` whose domain isn't `verified` in Resend (`GET https://api.resend.com/domains` with the key; parse `status`). Refuse if `git status` isn't clean.
  - **Sets in production:**
    - `APP_ENV=beta`, `NEXT_PUBLIC_APP_ENV=beta`, `DEMO_MODE=false`
    - `DATABASE_URL="$(neon connection-string beta --pooled)"`, `DIRECT_URL="$(neon connection-string beta)"`
    - `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAILS`, `NEXT_PUBLIC_CONTACT_EMAIL`
    - `NEXT_PUBLIC_SITE_URL=https://peabudy.com` (domain bought 9 Nov, F-01). Take it from an optional `SITE_URL` input that defaults to `https://peabudy.com`. Before changing anything, check that the URL answers over HTTPS; if it doesn't (the founder skipped F-02 part F), exit non-zero and say "Point peabudy.com at the project, or run with SITE_URL=https://gethousemate.vercel.app".
    - Also change `scripts/switch-to-research.sh` (it currently hard-codes `NEXT_PUBLIC_SITE_URL https://gethousemate.vercel.app`, line 42) to `https://peabudy.com`, so a rollback doesn't put the old URL back into link previews.
  - **Removes in production:** `NEXT_PUBLIC_CLARITY_ID` (assumes D8 until ENG-14) and `NEXT_PUBLIC_FEEDBACK_URL` (the built-in feedback form stays).
  - **Deploy:** forces a rebuild (empty commit if there's no new code), then `git push origin main`, which **the founder runs**.
  - **After the deploy:** prints a smoke-test list (below).
  - **Rollback:** `bash scripts/switch-to-research.sh` restores research mode. Document this at the top of the script.
- **Smoke test (printed by the script; the founder ticks each one):**
  1. The banner shows the beta text (DES-01 #1).
  2. `/signin` has no persona panel and no on-screen code.
  3. A code arrives in a Gmail inbox, not spam, from `Peabudy <hello@peabudy.com>`, and the subject and body say "Peabudy" (ENG-28).
  4. A staff (`ADMIN_EMAILS`) sign-in works and `/staff` loads.
  5. `POST /api/v1/auth/demo-persona` returns 404.
  6. `/household` has no homes tabs.
- **Acceptance criteria:**
  - Given `EMAIL_FROM` on an unverified domain, when the script runs, then it exits non-zero before changing any variable.
  - Given valid inputs, when the script runs (the founder runs it), then `vercel env ls production` shows the variables above, and the deployment's banner reads the beta text.
  - The script never prints a secret value. Check by reviewing it with `bash -x` using dummy values.
- **Files:** new `scripts/switch-to-beta.sh`; `.env.example` (add the new variable names with no values); `CLAUDE.md` §3/§10 (one line pointing to the script; the engineer owns that edit).
- **Size** S · **Depends on** F-01–F-03 · **Assumes** D8 (Clarity off).

## ENG-09: Beta database and staff sign-in checks (read-only)

- **Problem.** *Unknown:* whether the Neon `beta` branch holds real people from the 6 Oct–1 Nov pilot, whether its migrations are current, and whether staff can sign in. Staff always get emailed codes (`request-code/route.ts:37`).
- **In scope:** run read-only queries against `beta` and report **counts only** (no rows, emails or names) in the ticket:
  - `count(*)` of `User` by `role` and `accountStatus`
  - users created before 9 Nov
  - `VerificationCheck` by status
  - Then `npx prisma migrate status` against the beta `DIRECT_URL`
  - Then a staff sign-in on staging-as-beta (ENG-10) with an `ADMIN_EMAILS` address.
  - Find and record the **Neon project region** and the **Vercel function region**, which the DPIA needs.
- **Out of scope:** deleting or contacting anyone (founder decision D5).
- **Acceptance criteria:**
  - Given the checks, the ticket records: migration status ("up to date" or the pending list), member counts, any pre-existing real accounts (count), and the regions.
  - Given pending migrations, they're applied by the next production build (`npm run build` runs `prisma migrate deploy`). Don't apply them by hand.
- **Size** XS · **Assumes** D5.

## ENG-10: Staging rehearsal with real inboxes + `tests/e2e_beta.py`

- **Problem.** Beta mode hasn't run end to end since 1 Nov, when the QA found `EMAIL_SEND_FAILED` for every address. There's also no automated beta suite.
- **In scope:**
  - **FT rehearsal:**
    - A staging deployment with `APP_ENV=beta` and `NEXT_PUBLIC_APP_ENV=beta`, pointed at a **new Neon branch `beta-rehearsal`** created from `beta`. Never rehearse on the production beta branch.
    - The Preview variables go on the `staging` branch. Use the Vercel dashboard (the CLI is flaky for branch-scoped Preview vars, `CLAUDE.md` §10).
    - Run with three real inboxes: Gmail, Outlook and Yahoo. Ideally one is used from Nigeria, to check delivery there.
    - Path: sign-up → onboarding → publish → pending (sees nobody) → staff approval → two members see each other → intro → accept → chat → agreement → report → block → delete account.
    - Record the results in a checklist (no personal data).
  - **S1 suite:** `tests/e2e_beta.py BASE_URL DATABASE_URL`, run **locally only**. It reads the latest `AuthCode` for test addresses directly from the local database, because beta never shows codes.
    - Local beta needs an email sink. Add `EMAIL_SINK=log`, honoured **only** when `process.env.VERCEL` is unset **and** `NODE_ENV !== "production"`. Get SEC-01 to review this guard.
    - Cover every check named in ENG-01, 02, 04, 05, 06, 07, 11, 13, 16, 21, 22.
- **Acceptance criteria:**
  - Given the rehearsal, codes arrive in **all three** inboxes within 2 minutes and not in spam, **by 10 Nov 16:00 UK**. This is the critical-path gate.
  - Given the rehearsal, every step of the path succeeds, and the household page shows no homes tabs.
  - Given `EMAIL_SINK=log` with `VERCEL=1` set, when a code is requested, then the sink is **not** used.
  - Given a local beta server, `python3 tests/e2e_beta.py http://localhost:3000 "postgresql://$USER@localhost:5432/housemate_db"` passes.
- **Files:** `lib/email.ts` (sink guard), new `tests/e2e_beta.py`, `CLAUDE.md` §3 (add the command).
- **Size** M (FT part S) · **Depends on** ENG-01, 02, 04, 06, 08, F-02.

## ENG-11: Suspend / restore an account with a reason

- **Problem.** *Fact:* nothing sets `accountStatus = "suspended"`. `requireUser` blocks suspended users (`lib/guard.ts:17`) and matching excludes non-active users (`lib/matching.ts:142`), but staff have no way to act.
- **User story.** As a moderator, I can suspend someone in two clicks with a recorded reason, and their access and visibility stop immediately.
- **In scope:**
  - `POST /api/v1/staff/users/[userId]/status` with `{ action: "suspend" | "restore", reason_code, report_id?, expected_version? }`.
  - Roles: `requireStaff("moderator")` (admin passes).
  - `reason_code` must be one of: `harassment`, `scam_or_money_request`, `impersonation`, `threat`, `underage`, `spam`, `other`.
  - **Suspend**, in one transaction:
    - `accountStatus = "suspended"`
    - delete all `Session` rows
    - `search.status = "paused"`
    - pending intros to or from them become `expired`
    - open conversations become `closed`
    - proposed or active households become `closed`, with `reasonCode` `member_unavailable`
    - notify the other members: "This household was closed because the other member's account is no longer active." No reason is shared.
  - **Restore:** `accountStatus = "active"`. Nothing is reopened, and the member must republish.
  - Staff can't suspend themselves or another admin.
  - UI: buttons on the user detail page (ENG-22) and on a report (ENG-21), with a reason picker.
  - **FT stopgap (runbook only, no code):**
    1. `UPDATE "User" SET "accountStatus"='suspended' WHERE id='<id>';`
    2. `DELETE FROM "Session" WHERE "userId"='<id>';`
    3. Insert a manual audit row.
    - Run with `psql "$(neon connection-string beta)"`. Write the exact SQL into founder.md F-09.
- **Out of scope:** appeals UI; timed suspensions; telling the suspended user anything except the existing `SUSPENDED` 403 ("This account is suspended."). Copy: DES-11.
- **Acceptance criteria:**
  - Given a moderator and an active member with a pending intro, an open conversation and an active household, when the moderator suspends with `reason_code = "harassment"`, then:
    - the member's next request returns 403 `SUSPENDED`
    - they disappear from every other member's recommendations
    - the intro is `expired`, the conversation `closed` and the household `closed`
    - the other household member gets the in-app notification
    - one audit row `staff.account_suspended` has `actorType = "staff"`, `subjectId` = member and `reasonCode = "harassment"`
  - Given a verifier (not a moderator), when they call the route, then 403 `FORBIDDEN`.
  - Given an admin target, when a moderator tries to suspend, then 403 `FORBIDDEN`.
  - Given a stale `expected_version` (`User` has no version, so use `updatedAt` as the concurrency token), then 409 `VERSION_CONFLICT`.
- **Files:** new `app/api/v1/staff/users/[userId]/status/route.ts`; `lib/moderation.ts` (`suspendUser(tx, …)`); back office UI (ENG-24).
- **Audit/outbox:** `staff.account_suspended` / `staff.account_restored`; outbox `account_suspended` `{ userId }`.
- **Tests:** e2e_beta "suspend cascades", "verifier forbidden", "suspended user 403". Unit: `lib/moderation` cascade order (a pure planner function).
- **Size** M · **Depends on** ENG-24.

## ENG-12: Transactional email via Resend + preferences + unsubscribe

- **Problem.** Notifications are in-app only (`CLAUDE.md` §13). Real people won't know about an intro or a reply, so reply rates will collapse.
- **User story.** As a member, I get an email when something needs me, and I can turn activity emails off.
- **In scope:**
  - **Events and triggers**, all using the existing `notify()` call sites:

    | Event | Trigger |
    |---|---|
    | `identity_verified` | `staff/verifications/[userId]` approve |
    | `identity_rejected` | same route, reject |
    | `introduction_received` | `introductions/route.ts` |
    | `introduction_accepted` | `introductions/[id]` |
    | `message_received` | Throttled: at most 1 email per conversation per recipient per 6 h, and only if the message is unread 10 minutes later. **S1 simplification:** send at most 1 email per conversation per 6 h without the unread check |
    | `area_opened` | ENG-13 |
    | `report_closed` | ENG-21 |

  - **Sending:**
    - `lib/notifyEmail.ts` exports `sendEventEmail(userId, event, ctx)`, called **after** the transaction commits.
    - Use Next 16 `after()` from `next/server` if it's supported. **Check `node_modules/next/dist/docs/` first.** Otherwise await it with a 3 s timeout.
    - A failure never fails the user's action.
    - **Never include message text, report text, contact details, or any sign-in token or "magic link".** Emails link to the relevant page; the user signs in normally.
  - **Preferences and unsubscribe:**
    - `User.emailPrefs` (JSON string, default `{"activity":true}`). Login codes and account-safety emails (identity result, suspension) always send.
    - A toggle in Settings.
    - Every activity email carries `List-Unsubscribe: <https://…/api/v1/email/unsubscribe?t=TOKEN>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
    - The token is an HMAC-SHA256 over `userId|category` using `EMAIL_LINK_SECRET`, with no expiry and nothing else in it.
    - `GET` shows a confirmation page with a button; `POST` performs the change. That way link scanners can't unsubscribe people.
  - Templates: DES-05.
- **Out of scope:** SMS or WhatsApp; digests; the outbox dispatcher; weekly "new matches" (cut).
- **Acceptance criteria:**
  - Given beta and A sends B an intro, when the request completes, then B gets one email with subject "{A's first name} introduced themselves on Peabudy". The body has no intro text, and audit `email.sent` has `safeAfter: { event: "introduction_received" }` and no address.
  - Given Resend returns 500, when A sends an intro, then A's request still returns 200, and audit `email.failed` is written (outcome `failed`).
  - Given B receives 5 messages in one conversation within 1 h, then B gets at most 1 `message_received` email.
  - Given B posts the unsubscribe form, then `emailPrefs.activity = false`, later activity emails aren't sent, and the identity-result email still is.
  - Given a token for another user or with a changed category, when it's posted, then the response is 404 and nothing changes.
  - Given research mode, no activity emails are sent (sample worlds).
- **Files:** `lib/notifyEmail.ts` (new), `lib/email.ts` (shared `sendEmail`), the call-site routes above, `app/api/v1/email/unsubscribe/route.ts` (new; page under `app/email/unsubscribe/`), `app/(app)/settings/page.tsx`, `app/api/v1/me/route.ts` (PATCH `emailPrefs`).
- **Data / migration:** `User.emailPrefs String @default("{\"activity\":true}")`, plus `EmailSend` (`id`, `userId`, `event`, `conversationId?`, `sentAt`) for throttling. Both additive.
- **Audit:** `email.sent`, `email.failed`, `email.unsubscribed`. Payload: event name only.
- **Tests:** unit for the token sign/verify and the throttle decision; e2e_beta using `EMAIL_SINK=log`, asserting a `EmailSend` row per event and the throttle.
- **Size** L · **Depends on** F-02 (verified domain), DES-05.

## ENG-13: Area-by-area opening per city + configurable launch cities

- **Problem.** Two cities and 12 areas spread early users thin. Opening areas by holding back verification calls slows verification, which is also our interview channel. The city list is hard-coded (`lib/constants.ts`).
- **User story.** As the founder, I open an area when it has enough people, without a deploy. As a member, I'm told plainly when my area isn't open yet.
- **In scope:**
  - **Configurable cities:** `NEXT_PUBLIC_BETA_CITIES` (comma list of `CityId`, default `london,lagos`) limits onboarding's city options in beta. `PATCH /me/search` rejects other cities with 422 `VALIDATION` "We're not open in that city yet."
  - **`AreaOpening` model**, toggled in the back office by admin: `POST /api/v1/staff/areas` with `{ city_id, area_id, action: "open" | "close" }`. Audited.
  - **Matching in beta** (`lib/matching.ts`):
    - common areas = viewer areas ∩ candidate areas ∩ **open areas**
    - if that's empty, exclude the candidate with `reasonsWhyNarrow` `area_not_open`
    - if the viewer has no open area, return `gate: "area_not_open"`
    - area score points count open common areas only, so sorting stays deterministic
  - **Enforced again** at introduction time (`CLAUDE.md` rule 7), with a generic 404.
  - **Back office:**
    - table per city: area · published · verified · pending · move-in months histogram (counts per YYYY-MM) · status · Open/Close button
    - the density threshold is shown as a guide only, not enforced: "≥ 10 published with overlapping months" (*Assumption*)
  - **On open:** an `area_opened` email (ENG-12) to verified members whose search includes that area.
  - Non-beta modes: every area counts as open, with no database lookup.
- **Out of scope:** new areas or postcodes; automatic opening.
- **Acceptance criteria:**
  - Given beta, Hackney closed and Camden open, viewer V (Hackney + Camden) and candidate C (Hackney only), when V loads recommendations, then C is excluded and `narrowFilters` includes `area_not_open`.
  - Given the same, when V sends an intro to C, then 404 `NOT_FOUND`.
  - Given candidate D (Camden), then D appears, and the reasons mention Camden only.
  - Given viewer W with only closed areas, then `gate = "area_not_open"` and Discover shows the DES-04 "area not open yet" state.
  - Given an admin opens Hackney, then audit `launch.area_opened` (`safeAfter: { cityId, areaId }`) and outbox `area_opened` are written, and C appears to V on the next load.
  - Given a moderator or verifier, when they call `POST /staff/areas`, then 403.
  - Given `NEXT_PUBLIC_BETA_CITIES=lagos`, when onboarding loads in beta, then only Lagos is offered, and `PATCH /me/search { cityId: "london" }` returns 422.
  - Given NGN annual budgets, then the overlap uses monthly equivalents (no regression; `rentMinMonthly`).
- **Files:** `prisma/schema.prisma`; new `lib/launch.ts` (`openAreas(cityId)`, `openCommonAreas(...)`, pure and unit-tested); `lib/matching.ts`; `app/api/v1/introductions/route.ts`; `app/api/v1/me/search/route.ts`; `app/(app)/onboarding/page.tsx`; new `app/api/v1/staff/areas/route.ts`; back office UI.
- **Data / migration:** `AreaOpening { id, cityId, areaId, openedAt, openedById, closedAt? }` with `@@unique([cityId, areaId])`. Additive.
- **Tests:** `tests/launch.unit.ts` (intersection, the empty case, sort stability); e2e_beta "area gate both ways", "admin-only open".
- **Size** L · **Assumes** D1 (both cities), D12 (launch areas). **Stopgap until shipped:** verification in area cohorts (README).

## ENG-14: Clarity consent banner + `consentv2`

- **Problem.** Clarity loads unconditionally when `NEXT_PUBLIC_CLARITY_ID` is set (`app/layout.tsx:59–63`), and nothing in the code calls `consentv2`.
  - Microsoft has enforced consent signals for EEA/UK/CH visits since 31 Oct 2025 ([Clarity Consent API v2](https://learn.microsoft.com/en-ca/clarity/clarity-consent-api-v2), fetched 9 Nov 2026).
  - PECR requires consent for non-essential cookies.
- **In scope:**
  - A banner (DES-06) with equal-weight "Allow" and "No thanks" buttons, shown when `NEXT_PUBLIC_CLARITY_ID` is set and no choice is stored.
  - The choice is stored in `localStorage` (`hm_analytics_consent`).
  - The Clarity script loads **only after** "Allow", followed by `clarity('consentv2', { ad_Storage: "denied", analytics_Storage: "granted" })`.
  - Settings lets people change the choice. Withdrawing calls `consentv2` with analytics denied and stops loading Clarity.
  - The existing `ResearchTools` stub that queues `set` calls stays, but must not inject the script.
- **Acceptance criteria:**
  - Given a first visit with the ID set, when the page loads, then no request to `clarity.ms` is made until "Allow" is clicked. Check this in the browser network panel.
  - Given "No thanks", then no `clarity.ms` request is made on any page, including after a reload.
  - Given the banner, then both buttons are 44 px or larger, reachable by keyboard, and the banner has `role="region"` with a label.
- **Files:** `app/layout.tsx`, new `components/ConsentBanner.tsx`, `components/ResearchTools.tsx`, `app/(app)/settings/page.tsx`.
- **Size** S · **Assumes** D8. Clarity stays off in beta until this ships.

## ENG-15: Tally survey link with hidden fields + triggered prompts

- **Problem.** `NEXT_PUBLIC_FEEDBACK_URL` *replaces* the built-in feedback form (`ResearchTools.tsx:59–69`). We want both: the built-in form for the Feedback pill, and a separate survey.
- **In scope:**
  - `NEXT_PUBLIC_SURVEY_URL`.
  - `GET /me` returns `survey` with:
    - `ref`: the first 12 hex characters of HMAC-SHA256(`userId`, `EMAIL_LINK_SECRET`). **Never the email or the raw user ID.**
    - `city`
    - `stage`, computed server-side as one of `signed_up`, `published`, `verified`, `matched`, `intro_sent`, `intro_accepted`, `conversation`, `agreement`
  - The client builds `SURVEY_URL?ref=&city=&stage=&source=`.
  - **Prompts:** dismissible cards, each shown at most once, with copy in DES-10:

    | Prompt | When | Where it goes |
    |---|---|---|
    | T1 | after publish | built-in micro-question with `page=/onboarding#t1` |
    | T2 | 0 matches on the second Discover visit | built-in |
    | T3 | 48 h after the first intro sent, or 24 h after the first acceptance | survey |
    | T4 | 7 days after verification | survey card, plus an email via ENG-12 if it has shipped |
    | T5 | pausing a search or deleting the account | built-in single choice |

  - Track which prompts have been shown in `localStorage`, plus the server-side `User.promptsShown` JSON so it works across devices.
  - Leave `NEXT_PUBLIC_FEEDBACK_URL` unset, so the pill keeps the built-in form.
- **Acceptance criteria:**
  - Given a verified member 7 days after approval, when they open Discover, then the T4 card links to the survey URL with `ref` (12 hex characters), `city`, `stage` and `source`, and no email or cuid appears in the URL.
  - Given T4 was dismissed, it never shows again for that member, on any device.
  - Given `NEXT_PUBLIC_SURVEY_URL` is unset, no survey prompts render.
- **Files:** `components/ResearchTools.tsx` (or new `components/Prompts.tsx`), `app/api/v1/me/route.ts`, the pages that host prompts, `prisma/schema.prisma`.
- **Data / migration:** `User.promptsShown String @default("[]")`.
- **Audit:** `prompt.shown` and `prompt.dismissed` (`safeAfter: { prompt: "T4" }`). These are needed for the response-rate metric.
- **Tests:** unit for `stage` computation and `ref` stability; e2e_beta "survey ref is pseudonymous".
- **Size** M · **Depends on** F-06, DES-10 · **Assumes** D10.

## ENG-16: Funnel metrics per city + `discover.viewed` event

- **Problem.** There's no product analytics. The current staff counts are research-only (`staff/research/route.ts`).
- **In scope:**
  - **`discover.viewed` audit event** in `GET /recommendations`: `safeAfter: { cityId, matchCount, excludedCount, narrowFilters, gate }`. No candidate IDs.
  - **`GET /api/v1/staff/metrics?city=london|lagos|all&from=YYYY-MM-DD&to=YYYY-MM-DD`** (`requireStaff()`). It excludes staff, `isDemoBot` users and `sandboxWorldId` users, and returns per city:

    | Metric | Definition |
    |---|---|
    | `signed_up` | `User` created in the window (city = search city; null city counts as "unknown") |
    | `published` | `Profile.publishedAt` in the window |
    | `verified` | identity `VerificationCheck` `verified` |
    | `median_hours_publish_to_verified` | — |
    | `liquidity` | verified users whose first `discover.viewed` after verification had `matchCount ≥ 1`, divided by verified users with any `discover.viewed` |
    | `intro_sent_users` | — |
    | `intros_sent` | — |
    | `intro_accept_rate` | accepted within 7 days of `createdAt` / sent |
    | `meaningful_conversations` | conversations where both participants have ≥ 3 `Message` rows |
    | `households_proposed` | — |
    | `agreements_accepted` | — |
    | `reports` by category | — |
    | `blocks` | — |
    | `open_safety_reports_over_24h` | — |
    | `feedback_count` | — |
    | `prompt_shown` / `prompt_dismissed` | by prompt (ENG-15) |

    Add an `area` breakdown once ENG-13 ships.
  - **Back office "Overview" tab** (ENG-24): cards per city, plus a CSV download of the same numbers. Counts only, no personal data.
- **Out of scope:** charts; cohorts by signup week (later); a third-party analytics product.
- **Acceptance criteria:**
  - Given a seeded fixture (2 London and 2 Lagos verified members, 1 London intro accepted with 3 messages each), when `GET /staff/metrics?city=all` is called, then London shows `intro_accept_rate = 1.0` and `meaningful_conversations = 1`, and Lagos shows 0, with no PII fields.
  - Given a member (non-staff), then 403.
  - Given a `discover.viewed` row, then it has no other user's ID anywhere in `safeAfter`.
- **Files:** `app/api/v1/recommendations/route.ts`, new `app/api/v1/staff/metrics/route.ts`, new `lib/metrics.ts` (SQL via `prisma.$queryRaw`, parameterised), back office UI.
- **Tests:** e2e_beta fixture check; unit test of the date-window helper.
- **Size** M.

## ENG-17: Data export parity

- **Problem.** Settings says "Download everything we hold about you" (`settings/page.tsx:50`), but `/me/export` returns only the account, profile, search, checks and score (`me/export/route.ts`).
- **In scope:** add the following to the export:
  - introductions sent and received (text, state, dates)
  - conversations and messages (the user's own messages, plus other participants' messages in conversations the user is part of; *legal to confirm*, see the DPIA)
  - households, plan versions and acceptances
  - blocks the user made
  - reports the user filed (not reports about them)
  - feedback the user sent (`TesterFeedback.userId`)
  - notifications
  - email preferences
  - consent records (`privacyConsentVersion`, `adultDeclaredAt`)
  
  Also update the Settings copy (DES-01 #27) to say exactly what's included.
- **Acceptance criteria:**
  - Given a member with one intro, one conversation (4 messages), one household plan, one block and one filed report, when they export, then each of these appears. No other user's email, phone or verification data appears, and audit `privacy.exported` is written.
  - Given a member who was reported, the report about them **isn't** in their export (*pending legal*, see the DPIA).
- **Files:** `app/api/v1/me/export/route.ts`, `app/(app)/settings/page.tsx`.
- **Audit:** `privacy.exported` (none today).
- **Size** S.

## ENG-18: Security hardening (IP rate limits, headers/CSP, token hashing)

- **Problem (Facts):**
  - Rate limits are per email or tester only; nothing is limited by IP on `request-code`, `verify-code` or `feedback`.
  - `next.config.ts` sets no security headers.
  - `AuthCode.code` and `Session.token` are stored in plain text (`schema.prisma:51,61`).
  - Chat renders server-escaped HTML with `dangerouslySetInnerHTML` (`messages/[id]/page.tsx:105`).
- **In scope:**
  1. IP-based limits, using a small DB table or a per-IP counter keyed on a hash of `x-forwarded-for`. Return 429 `RATE_LIMITED` with `Retry-After`:
     - `request-code`: 20 per IP per hour
     - `verify-code`: 30 per IP per hour
     - `feedback`: 30 per IP per hour
  2. Headers in `next.config.ts`: `Content-Security-Policy` (self, plus `clarity.ms` only when consented, plus Vercel needs), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `frame-ancestors 'none'`.
  3. Render chat as plain text (drop `dangerouslySetInnerHTML`, keep line breaks with CSS).
  4. If SEC-01 requires it: store SHA-256 hashes of codes and session tokens.
- **Acceptance criteria:**
  - Given 21 `request-code` calls from one IP within an hour (different emails), then the 21st returns 429 with `Retry-After`.
  - Given a message body `<img src=x onerror=alert(1)>`, when it's shown in chat, then it renders as literal text, and no `img` element is created.
  - Given the production build, `curl -I` shows the headers above.
- **Files:** `next.config.ts`, the auth and feedback routes, `app/(app)/messages/[id]/page.tsx`, `lib/session.ts` (if hashing), `prisma/schema.prisma` (rate-limit table; if hashing, a migration that invalidates existing sessions, so tell users first).
- **Size** M · **Depends on** SEC-01, SEC-08.

## ENG-19: Optional: separate research-mode demo deployment

- **In scope:** a second Vercel project (e.g. `peabudy-demo`) on the same repo with `APP_ENV=research` and the `research` database, served at a subdomain of the new domain (e.g. `demo.peabudy.com`). Add a "Try a demo with sample people" link on the beta landing and on the waiting states, opening in a new tab.
- **Acceptance criteria:**
  - Given the demo URL, its banner reads "Prototype: all people, checks and homes are samples."
  - Given the beta site, the demo link is labelled as a demo and opens a different hostname.
- **Size** XS (config, mainly the founder's Vercel setup) · **Assumes** D6.

## ENG-20: Discover empty state with "widen search" actions

- **Problem.** The empty state names the narrowest filters but offers only "Adjust my search" (`discover/page.tsx:92–105`).
- **In scope:**
  - Map `narrowFilters` (`areas`, `budget`, `dates`, `stay`, `habits`, `gender`, `area_not_open`) to plain-language reasons and one action each. The action deep-links to the right Profile section (`/profile#areas`, `#budget`, `#dates`, `#habits`).
  - Copy: DES-04.
  - Gender is never named as the reason to *other* people. It's only shown to the viewer about their own setting.
- **Acceptance criteria:**
  - Given a viewer excluded mostly by dates, then the empty state reads the DES-04 dates text and the button opens `/profile#dates`.
  - Given `area_not_open`, then the "area not open yet" state shows instead, with no widen action except "Add another area".
- **Size** S · **Depends on** DES-04.

## ENG-21: Report queue: statuses, resolution and action log

- **Problem.** Reports are listed read-only under "User research" (`staff/page.tsx:108–125`) with no status changes. `Report.status` exists with values `open|triaged|resolved` (`schema.prisma:450`), but no route changes it.
- **User story.** As a moderator, I work through reports by status, record what I did, and close the loop with the reporter, all audited.
- **In scope:**
  - **Statuses:** `open → investigating → actioned | dismissed`. Map existing values: `triaged` → `investigating`, `resolved` → `actioned`, via a data migration.
  - **Model `ReportAction`**: `id`, `reportId`, `staffId`, `action` (`status_change`, `note`, `suspended_target`, `contacted_reporter`), `fromStatus?`, `toStatus?`, `note` (≤ 500 characters, staff-only, never copied to audit), `createdAt`.
  - **Routes:**
    - `GET /api/v1/staff/reports?status=&category=&city=` (`requireStaff("moderator")`)
    - `GET /api/v1/staff/reports/[id]`, which includes the action log, the target's prior report count, and links to the user detail page
    - `POST /api/v1/staff/reports/[id]` with `{ action: "set_status", to, resolution_code?, note?, expected_status }`, where `resolution_code` is one of `no_action`, `warning_sent`, `suspended`, `duplicate`, `insufficient_info`
  - "Suspend target" from a report calls ENG-11's `suspendUser` with `report_id`.
  - When moving to `actioned` or `dismissed`, notify the reporter in-app (and by email via ENG-12): "We've reviewed case {caseId}. Thank you for reporting it." The outcome isn't disclosed.
  - **Queue order:** `threat` and `harassment` first, then oldest. Mark "Over 4 h" for safety-critical categories and "Over 24 h" for the rest.
  - Move the report list out of "User research" into the Reports tab (ENG-24).
- **Out of scope:** viewing chat content (staff can't read chats; reporters paste excerpts); appeals.
- **Acceptance criteria:**
  - Given an open `threat` report and an open `other` report, when the queue loads, then `threat` is listed first, and after 4 h it shows "Over 4 h" in text.
  - Given a moderator sets `investigating` and then `actioned` with `resolution_code = "warning_sent"` and a note, then there are two `ReportAction` rows and two audit rows `report.status_changed` (`safeAfter: { from, to, resolutionCode }`, **no note text**), and the reporter has one notification.
  - Given two moderators act at once with the same `expected_status`, then the second gets 409 `STATE_CONFLICT`.
  - Given a verifier, then 403.
- **Files:** `prisma/schema.prisma`; new `app/api/v1/staff/reports/route.ts` and `app/api/v1/staff/reports/[id]/route.ts`; `app/api/v1/staff/research/route.ts` (drop the reports from it); back office UI.
- **Data / migration:** `ReportAction` model; data migration of status values; optional `Report.resolutionCode`, `resolvedAt`, `resolvedById`. All additive.
- **Audit/outbox:** `report.status_changed`, `report.note_added` (no text); outbox `report_status_changed`.
- **Tests:** e2e_beta "report lifecycle", "concurrent change 409", "note not in audit".
- **Size** M · **Depends on** ENG-24.

## ENG-22: Back office: user search and user detail

- **Problem.** Staff can't find a member except through the verification queue.
- **In scope:**
  - **`GET /api/v1/staff/users?q=`** (`requireStaff()`). Exact email match, display-name prefix, or user ID. At most 20 results: `id`, `displayName`, city, `accountStatus`, role, identity status, `createdAt`. **Show the email only for an exact email match.** That way search can't be used to browse emails.
  - **`GET /api/v1/staff/users/[id]`** returns:
    - account status and role, consent version, `adultDeclaredAt`
    - city, areas, move-in window, publication status
    - checks (category, status, month)
    - counts: intros sent/received/accepted, conversations, reports filed, reports against (links to ENG-21), blocks made/received
    - the last 20 audit events where they're actor or subject (`eventType`, `action`, `occurredAt`)
    - **No message bodies, intro text, bio edits history or report text** (report text stays in the report view)
    - email and phone shown behind a "Show contact details" action
  - **Every detail view writes audit `staff.user_viewed`.** Revealing contact details writes `staff.contact_revealed`.
  - Actions on this page: suspend/restore (ENG-11), and open the verification case.
- **Acceptance criteria:**
  - Given `q` = a partial email, then no emails are returned. Given `q` = an exact email, then that one user is returned, with email.
  - Given a staff member opens a detail page, then exactly one `staff.user_viewed` audit row (actor = staff, subject = member) is written.
  - Given a member (non-staff), both routes return 403.
- **Files:** new `app/api/v1/staff/users/route.ts` and `[id]/route.ts`; back office UI.
- **Tests:** e2e_beta "search doesn't leak emails", "view is audited".
- **Size** M · **Depends on** ENG-24.

## ENG-23: Back office: audit trail viewer

- **Problem.** `GET /staff/audit` returns the latest 100 events with an `event_type` filter that the UI doesn't use (`staff/audit/route.ts`). There's no actor, subject or date filter and no paging.
- **In scope:**
  - Filters: `event_type`, `actor_id`, `subject_id`, `actor_type`, `from`/`to`, `outcome`. Cursor paging (`occurredAt`, `id`), 50 per page.
  - UI table with those filters, and links from actor and subject to the user detail page.
  - Keep the outbox health cards.
  - Payloads stay as stored (allow-listed). The viewer adds nothing.
  - Viewing the audit trail is itself audited (`staff.audit_viewed`, with the filter keys only).
- **Acceptance criteria:**
  - Given 120 events for subject S, when filtering by `subject_id = S`, then page 1 has 50 events, newest first, and the cursor returns the next 50 with no duplicates.
  - Given a member, then 403.
- **Files:** `app/api/v1/staff/audit/route.ts`; back office UI.
- **Size** M · **Depends on** ENG-24.

## ENG-24: Back office shell: tabs, role matrix, staff reads audited

- **What exists (Facts):** `/staff` (`app/(app)/staff/page.tsx`) is one client page with three sections: an identity verification queue (approve/reject, `staff/verifications*`), "User research" (feedback and reports, read-only, `staff/research`), and an audit explorer (`staff/audit`). Every route uses `requireStaff()`. The page shows "Staff access required." on 403. The nav link is desktop-only (`AppNav` `isStaff`).
- **Gaps:** no tabs or structure; no per-role separation (`requireStaff()` with no role argument everywhere); staff reads of personal data aren't audited; no mobile entry point.
- **In scope:**
  - **Tabs (layout DES-11):** Overview (ENG-16) · Verification (ENG-07) · Reports (ENG-21) · Users (ENG-22) · Areas (ENG-13) · Feedback (existing) · Audit (ENG-23).
  - **Role matrix, enforced on the server in each route:**

    | Capability | verifier | moderator | admin |
    |---|---|---|---|
    | Verification queue, approve/reject | ✓ | — | ✓ |
    | Reports, suspend/restore | — | ✓ | ✓ |
    | User search/detail | ✓ | ✓ | ✓ |
    | Metrics, feedback, audit | ✓ | ✓ | ✓ |
    | Open/close areas | — | — | ✓ |

    `requireStaff(role)` takes a single role today (`lib/guard.ts:23–29`). Extend it to accept a list.
  - **Every staff mutation** writes audit with `actorType: "staff"`. Every staff read of an individual's personal data writes `staff.*_viewed`.
  - **Server-side guard:** the `/staff` page itself calls a server check and returns `notFound()` for non-staff (`CLAUDE.md` rule 2: inaccessible = 404).
  - Show the Staff link in the mobile nav too, for staff only.
- **Acceptance criteria:**
  - Given a verifier, when they call `POST /staff/users/{id}/status`, then 403. Given a moderator, when they call `POST /staff/verifications/{id}`, then 403.
  - Given a member, when they open `/staff`, then they get a 404 page, not a "Staff access required" card.
  - Given any staff mutation in ENG-07/11/13/21, then an audit row with `actorType = "staff"` and the staff `actorId` exists. Check with an e2e assertion per route.
- **Files:** `app/(app)/staff/page.tsx` (split into `app/(app)/staff/*` components), `lib/guard.ts`, every `app/api/v1/staff/*` route, `components/AppNav.tsx`.
- **Size** M · **Depends on** DES-11.

## ENG-25: Final privacy notice and terms into `app/privacy` and `app/terms` (beta)

- **Problem.** The live notice is a template. It names no controller or contact, cites "NDPR" rather than the Nigeria Data Protection Act 2023, gives no retention periods, and says feedback is anonymous when signed-in feedback stores `userId` (`app/privacy/page.tsx`; `feedback/route.ts:28–35`).
- **In scope:**
  - **FT:** render [`legal/privacy-notice.md`](legal/privacy-notice.md) and [`legal/terms.md`](legal/terms.md) in beta mode, **with every `[PLACEHOLDER]` filled by the founder** (F-04), and with the AI-draft banner removed from the live page. The live page shows "Early-access version · last updated {date} · version privacy-v2".
  - Research mode keeps its current text.
  - The content can live in `lib/legal/*.ts` as structured sections.
  - **S2:** swap in the text after legal review, bump to `privacy-v3` if it changes materially, and re-consent via ENG-06.
- **Acceptance criteria:**
  - Given a beta build, when `/privacy` and `/terms` are fetched, then no `[` + capital-letter placeholder appears. Add a build-time test that fails the build if one does.
  - Given beta, `/privacy` names the controller, a contact email, every processor in the legal draft, retention periods, and both the ICO and the NDPC.
  - Given `PRIVACY_VERSION = "privacy-v2"` and an existing member, then they're asked to re-consent (ENG-06).
- **Files:** `app/privacy/page.tsx`, `app/terms/page.tsx`, new `lib/legal/`, `lib/constants.ts`, and a test script.
- **Size** S · **Depends on** F-04 (founder fills the placeholders) · **Assumes** D11 (the founder accepts publishing an unreviewed interim notice).

## ENG-26: Fonts: ₦ and Yoruba glyph coverage

- **Problem.**
  - *Fact:* `app/layout.tsx` loads Schibsted Grotesk and Hanken Grotesk with `subsets: ["latin"]` only.
  - *Designer finding* (`docs/design/design-system.md` §6; PM hasn't independently re-checked the glyph tables): neither font has a `₦` glyph or `Ṣ`, and Hanken has no tabular figures.
  - Lagos prices (`lib/money.ts` formats NGN with `Intl.NumberFormat("en-NG")`, which renders `₦`) and Yoruba names therefore fall back to a system font.
  - Lagos launches on 11 Nov. This is cosmetic, not a safety issue, so it's S1, not FT.
- **In scope:**
  - Load **Plus Jakarta Sans** (display) and **Inter** (body) from `next/font/google` with `subsets: ["latin", "latin-ext", "vietnamese"]`, keeping the `--font-display` and `--font-sans` variables so no class names change.
  - Add `tabular-nums` on money elements.
  - This is the only part of `docs/design/` adopted now.
  - *Fallback if the founder rejects the font change:* adding `latin-ext` + `vietnamese` to the current fonts **doesn't** fix ₦ or Ṣ, because those glyphs aren't in the fonts, so it isn't recommended.
- **Acceptance criteria:**
  - Given a Lagos member's budget `₦1,200,000/yr` and the display name "Ṣadé Ọlá", when they're rendered on Discover and the profile at 375 px, then DevTools → Rendered Fonts shows only the web fonts.
  - Given a list of rents, then the digits align (tabular).
  - Given Lighthouse, then CLS doesn't regress (`display: "swap"` kept).
- **Files:** `app/layout.tsx`, `tailwind.config.ts`, `app/globals.css`.
- **Size** S · **Depends on** DES-12.

## ENG-27: Contrast fixes: placeholder and faint landing text

- **Problem (designer finding, `docs/design/design-system.md` §5):**
  - `placeholder:text-stone-400` on white is about **2.52:1**.
  - The landing page's `text-ink/40` on cream is about **2.74:1**.
  - Both fail WCAG AA (4.5:1 for normal text).
- **In scope:**
  - Placeholder colour in the `.input` class (`app/globals.css`): at least 4.5:1 (the design system proposes `ink-500`, 5.63:1).
  - Meaningful `text-ink/40` and `text-ink/30` on the landing page (`app/page.tsx`, e.g. lines 113, 118, 130, 272, 332, 373, 415).
  - Purely decorative faint text must be `aria-hidden`.
- **Acceptance criteria:** Given axe or Lighthouse on `/`, `/signin` and `/onboarding`, then there are zero text colour-contrast failures.
- **Size** XS · **Depends on** DES-12.

## ENG-28: Peabudy rename (user-facing brand strings only)

- **Problem.** The product is now called **Peabudy** (founder, 9 Nov 2026), and `peabudy.com` is the sending domain. *Fact:* the login email still says "Housemate" in its subject, text and HTML header (`lib/email.ts`), and 15 files under `app/`, `lib/` and `components/` contain the string. A code email from `hello@peabudy.com` that says "Housemate" looks like phishing, and real people would be right to distrust it.
- **User story.** As a new member, every email, page and link preview I see names the same product, so I can trust the code I've been sent.
- **In scope (FT, before the ENG-10 rehearsal on 10 Nov):**
  - `lib/email.ts`: subject "Your Peabudy sign-in code: {code}", text and HTML header say Peabudy; add "Peabudy will never ask you for this code." (DES-05).
  - Sign-in page, `app/layout.tsx` metadata (title, description, Open Graph/Twitter), `app/opengraph-image.tsx` / `twitter-image.tsx` / `lib/ogImage.tsx`, the beta `BANNER` text, `/privacy`, `/terms`, `/safety`.
  - The interim legal text (ENG-25) is already renamed in `legal/`.
- **In scope (S1):** every other user-facing "Housemate" string, using the designer's rebrand as the source for wordmark, icon and colours.
- **Out of scope:** code identifiers, file and folder names, the repo name, the Vercel project name (`housemate-platform`), Neon branch and database names (`housemate_db`), cookie names (`hm_session`), test e-mail patterns, audit event names. Renaming them is churn with breakage risk and no user value. `CLAUDE.md` may note the new product name (engineer's call).
- **Acceptance criteria:**
  - Given beta on staging, when a code is requested, then the email's subject, body and From name all say "Peabudy" and none says "Housemate".
  - Given `/`, `/signin`, `/privacy`, `/terms` and `/safety`, then the visible text and `<title>` contain no "Housemate" (a case-sensitive check, so the noun "housemate" in copy such as "find a housemate" is still allowed).
  - Given a link to `https://peabudy.com` pasted into WhatsApp or iMessage, then the preview shows the Peabudy title and image (after F-02 part G).
  - Both existing e2e suites still pass (update any assertion on the old brand text).
- **Size** S · **Depends on** the designer confirming the name styling ("Peabudy", not "PeaBudy" or "peabudy"; *Assumption:* "Peabudy").

## Note: the Discover score chip (PM vs designer)

- **Designer finding:** Discover shows the 0–60 match score as "Demo X/100".
- **Code check:** `lib/matching.ts:271,289` sets `score: sb.score`, where `sb = await computeScore(prisma, c.userId)`. That's the **credibility** score, not the match score. Meanwhile, the page subtitle (`discover/page.tsx:72`) says "The number is match strength, not a percentage."
- **Either way, the chip is mislabelled,** and PM and designer agree: **remove the number from Discover.** ENG-04 does it in beta, and DES-01 #18 does it in all modes, including the misleading subtitle.
