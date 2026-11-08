# Housemate — CLAUDE.md

@AGENTS.md

> Read this before touching code. It is the authoritative project guide; where README.md,
> ENVIRONMENTS.md or DEPLOY.md disagree with it, this file wins (they predate Next 16 and
> research mode). This repo is **public** — never write secrets, connection strings, personal
> emails or tester data into it.

---

## 1. What Housemate is

Housemate helps people **find a compatible housemate and agree the money stuff before anyone
moves in**. It is built for London (GBP, monthly rent) and Lagos (NGN, annual rent).

The core journey, end to end:

1. **Onboard** — journey, city + areas, budget, move-in window, stay length, six living-habit
   dealbreakers, housemate gender preference, bio.
2. **Discover** — deterministic, explainable matches (dates, areas, budget, habits). No swiping,
   no "compatibility %".
3. **Introduce → chat** — a short intro; chat opens when accepted.
4. **Form a household** — two people agree a **written, versioned agreement**: rent split, bills
   split, notice period, stay length, notes. Every change is a new version both must accept.
5. **Find a home** — shortlist, both vote "interested", book a viewing, report the outcome.
6. **Application → move-in** — a demo rental handoff (both consent), then both confirm move-in.

Trust layer: a transparent **credibility score** (evidence breakdown, "not a guarantee of
safety"), block, report, privacy controls, an ops console, and an audit trail on every mutation.

**Current phase (Nov 2026): user-testing research round.** Production
(`gethousemate.vercel.app`) runs in `research` mode: every person, check and home is a sample,
and each tester gets a private world of sample housemates who reply automatically. A real-user
`beta` mode (manual identity checks, real email) exists in code and is dormant. The product
spec is `~/Downloads/Housemate_MVP_PRD.docx` (P0 = required; most P1/P2 are out of scope).

**The single most important principle: honesty.** Never let a simulated check, sample person or
sample home look real. Every environment shows one truthful banner; sample people are labelled.

---

## 2. Non-negotiable rules

1. **Authorize on the server, in every route.** `requireUser()` / `requireStaff()`; check
   membership/ownership before reading or writing. A hidden button is not authorization.
2. **Inaccessible = 404, not 403.** Don't reveal that a blocked user, another tester's world or
   a filtered-out match exists ("This member is not available.").
3. **Every state change writes its audit row (and outbox event) in the same transaction.**
   Use `writeAudit` / `writeOutbox` / `notify` from `lib/audit.ts` inside `prisma.$transaction`.
   Audit payloads are allow-listed: never message bodies, contacts, addresses, evidence or tokens.
4. **Money is integer minor units + ISO currency.** Never floats. Household contributions are
   **monthly-equivalent** minor units (Lagos budgets are annual — convert with
   `monthlyEquivalentMinor`). Show annual equivalents for NGN where useful.
5. **Move-in dates are `YYYY-MM-DD` strings**, compared as strings, using `lib/dates.ts`
   (`testToday()` respects `TEST_TODAY`). Timestamps are UTC `DateTime`.
6. **Private data never enters a public DTO.** `GET /users/[id]` is the public profile; gender,
   gender preference, email, phone, location detail and verification evidence stay out of it.
7. **Matching rules are two-way and deterministic.** Any new compatibility rule must exclude in
   both directions, be enforced again at introduction time, and leave the score/sort stable.
8. **Never fake verification outside demo modes.** In `beta`, identity is only ever granted by a
   staff approval after an out-of-band live check; no ID documents are stored, ever.
9. **Staff accounts never get on-screen login codes** (they unlock the ops console). The
   `request-code` route enforces this — keep it that way.
10. **Schema changes go through Prisma Migrate** (`npm run db:migrate:dev -- --name x`). Never
    `prisma db push` against Neon. Prefer additive migrations with safe defaults.
11. **Never `TRUNCATE` or bulk-delete the live `research` database.** Real testers use it. Clean
    up only data you created (recipe in §11).
12. **You can't deploy to production yourself.** The sandbox blocks `git push origin main` and
    production `vercel env` changes. Do the work, push `staging`, verify, then hand the user the
    exact command (§10).
13. **Copy is UK English, plain and specific.** Errors say what to do next.

---

## 3. Commands

| Task | Command |
|---|---|
| Install (also runs `prisma generate`) | `npm install` |
| First-time local DB | `createdb housemate_db && npm run setup` (migrate + seed) |
| Dev server (default `development` mode) | `npm run dev` → http://localhost:3000 |
| Dev server as production behaves | `APP_ENV=research NEXT_PUBLIC_APP_ENV=research npm run dev` |
| Type-check | `npm run typecheck` |
| Unit tests | `npm run test:unit` |
| E2E — research journeys (34 checks) | `python3 tests/e2e_research.py http://localhost:3000` |
| E2E — gender preference | `python3 tests/e2e_gender.py http://localhost:3000 "postgresql://$USER@localhost:5432/housemate_db"` |
| Production build (runs `prisma migrate deploy` first) | `npm run build` |
| New migration | `npm run db:migrate:dev -- --name short_snake_case` |
| Apply migrations | `npm run db:migrate` |
| Reset + reseed local DB | `npm run db:reset` |
| Switch production to research mode / add Clarity or Tally, then deploy | `bash scripts/switch-to-research.sh` (user runs it) |

`npm run lint` does not exist (Next 16 removed `next lint`). There is no ESLint config.

**Never run `npm run build` while `npm run dev` is running** — both write `.next/` and the dev
server breaks with `MODULE_NOT_FOUND`. Kill port 3000 first (`lsof -ti:3000 | xargs kill -9`).

---

## 4. Environments

Behaviour is driven by `APP_ENV` (server) and `NEXT_PUBLIC_APP_ENV` (browser; must match).
All flags live in `lib/env.ts` — import them, don't re-derive from `process.env`.

| `APP_ENV` | Where | Login codes | Personas | Sample worlds | Consent | Identity |
|---|---|---|---|---|---|---|
| `development` | local | on screen | yes | personas only | optional | auto (demo) |
| `staging` | Vercel preview | on screen | yes | personas only | optional | auto (demo) |
| `research` | **production now** + staging branch | on screen (not staff) | yes | **every account** | required | auto (demo) |
| `beta` | dormant | **real email** (Resend) | no | no | required | **manual staff review** |

Key flags: `IS_BETA`, `IS_RESEARCH`, `DEMO_MODE` (forced off in beta), `SANDBOX_ON_SIGNUP`,
`CONSENT_REQUIRED`, `BANNER` (the one banner text — `PROTOTYPE_BANNER` in constants is unused).

### Infrastructure

| Thing | Value |
|---|---|
| Production URL | https://gethousemate.vercel.app (alias of `housemate-platform.vercel.app`) |
| Staging URL | https://housemate-platform-git-staging-teamihlehyns-projects.vercel.app |
| GitHub | `Teamihlehyn/housemate-platform` (public). `main` → production, `staging` → staging preview, other branches/PRs → preview on the `dev` DB |
| Vercel project | `teamihlehyns-projects/housemate-platform`; deployment protection is **off** |
| Neon project | `muddy-unit-38565676`; branches `staging` (default, seeded), `dev` (seeded, auto-archives), `beta` (clean, real-user pilot), `research` (production: sample homes + testers) |
| Analytics | Microsoft Clarity project `z6wwsrrff8` (production only) |

Connection strings: `neon connection-string <branch>` (direct, for migrations) and
`neon connection-string <branch> --pooled` (runtime). Never paste them into files.

### Environment variables

| Var | Notes |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Pooled (runtime) / direct (migrations) Postgres |
| `APP_ENV`, `NEXT_PUBLIC_APP_ENV` | Mode, see table above. `NEXT_PUBLIC_*` is **baked in at build time** |
| `DEMO_MODE` | `"false"` turns on-screen codes off outside beta |
| `RESEND_API_KEY`, `EMAIL_FROM` | Real login email. `onboarding@resend.dev` only reaches the Resend account owner |
| `ADMIN_EMAILS` | Comma-separated; these accounts become `admin` on sign-in and always get emailed codes |
| `NEXT_PUBLIC_SITE_URL` | Absolute base for OG/link previews (falls back to `VERCEL_PROJECT_PRODUCTION_URL`) |
| `NEXT_PUBLIC_CLARITY_ID` | Loads Microsoft Clarity (validated alphanumeric) |
| `NEXT_PUBLIC_FEEDBACK_URL` | Tally form; Feedback button opens it with `page`, `tester`, `source` params. Unset → built-in form saved to the ops console |
| `TEST_TODAY` | Pins "today" (`YYYY-MM-DD`) for deterministic dates |
| `FORCE_SEED` | Seed refuses `APP_ENV=beta` unless `true` |

Changing a production env var does nothing until the next build.

---

## 5. Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript** (strict). See `AGENTS.md`:
  this is newer than most training data — check `node_modules/next/dist/docs/` before relying on
  an API you remember.
- **Prisma 6** + **PostgreSQL** (local Homebrew Postgres; Neon in the cloud).
  `package.json` `overrides` pins `deepmerge-ts ^8` (security fix under Prisma's CLI) — keep it
  until Prisma 7.
- **Tailwind CSS 3** with design tokens in `tailwind.config.ts` and component classes in
  `app/globals.css`. Fonts via `next/font/google`: Schibsted Grotesk (display), Hanken Grotesk (body).
- **Resend** (email over plain `fetch`, no SDK), **Microsoft Clarity** (script tag, not the npm package).
- Hosting: **Vercel** (git-integrated) + **Neon**. No other services, no background workers.

---

## 6. Repo map

```
app/
  page.tsx                 Landing (server component; reads lib/env directly)
  signin/                  Email code + "Try a demo persona" + consent
  privacy/ terms/ safety/  Public pages (env-aware copy)
  layout.tsx               Fonts, banner, metadata/OG, <ResearchTools/>, Clarity
  icon.svg apple-icon.tsx opengraph-image.tsx twitter-image.tsx
  (app)/                   Signed-in app; layout.tsx redirects to /signin if no session
    onboarding/ discover/ members/[id]/ messages/ messages/[id]/ household/
    profile/ settings/ notifications/ staff/
  api/v1/                  REST API (route handlers only)
components/                AppNav, ResearchTools (feedback + Clarity tags), ReportDialog,
                           GenderPreferenceFields
lib/
  api.ts        handler(), ok(), fail(), ApiError — response envelope + error translation
  guard.ts      requireUser, requireStaff, withIdempotency, adminEmails
  session.ts    hm_session cookie (HttpOnly, 7 days, Secure in production)
  audit.ts      writeAudit, writeOutbox, notify
  env.ts        APP_ENV and every mode flag
  constants.ts  Cities/areas, journeys, questionnaire, rubric, report categories, genders
  matching.ts   getRecommendations — the deterministic matching engine
  household.ts  Agreement versions, acceptance, viewing/handoff/move-in transitions, view builder
  sandbox.ts    Private sample worlds: persona accounts, counterpart generator, top-up
  demoBots.ts   Sample-housemate auto-responses (after* hooks)
  personas.ts   Persona templates (pure data; imported by the sign-in page)
  credibility.ts computeScore / snapshotScore
  money.ts dates.ts email.ts db.ts client.ts ogImage.tsx
prisma/         schema.prisma, migrations/, seed.ts
scripts/        switch-to-research.sh (production mode switch + deploy)
tests/          e2e_research.py, e2e_gender.py, gender.unit.ts
```

---

## 7. Code conventions

### API routes

Every route uses the `handler()` wrapper and the envelope:

```ts
export const POST = handler(async (req, { rid, params }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  // validate → return fail("VALIDATION", "Plain message.", 422, rid, { field_errors: { field: "…" } })
  const result = await prisma.$transaction(async (tx) => {
    // mutate, bump `version` where the aggregate has one
    await writeAudit(tx, { eventType: "thing.done", actorId: user.id, resourceType: "thing",
                           resourceId: id, action: "do" }, rid);
    await writeOutbox(tx, "thing_done", { id });
    await notify(tx, otherId, "event_name", "Title", "Body without private details.");
    return …;
  });
  await afterSomething(id); // demo-bot hook, if this step involves a counterpart (§8)
  return ok(result, rid);
});
```

- Success: `{ data, meta: { request_id } }`. Error: `{ error: { code, message, field_errors, retryable }, meta }`.
- Throw `new ApiError(code, message, status, fieldErrors?)` from helpers; `handler()` translates it.
- Route files may export **only HTTP handlers** (Next rejects other exports at build — put shared
  constants in `lib/`). `params` arrives already awaited via `handler()`.
- Optimistic concurrency: mutable aggregates carry `version`; transitions accept
  `expected_version` / `expected_plan_version` and return `409 VERSION_CONFLICT` when stale.
- Idempotency: create endpoints accept an `Idempotency-Key` header via `withIdempotency`; chat
  dedupes on `(senderId, clientMessageId)`.

Status/code vocabulary — reuse, don't invent synonyms:

| Status | Codes |
|---|---|
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN`, `SUSPENDED`, `NOT_PUBLISHED`, `IDENTITY_PENDING` |
| 404 | `NOT_FOUND` (also for "exists but you may not know") |
| 409 | `STATE_CONFLICT`, `VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `NEEDS_REAGREEMENT`, `COOLDOWN` |
| 422 | `VALIDATION`, `CONSENT_REQUIRED`, `INCOMPLETE`, `UNDECIDED_DATES`, `NO_CHANGE`, `CODE_EXPIRED`, `INVALID_CODE` |
| 429 | `RATE_LIMITED`, `TOO_MANY_ATTEMPTS` (+ `Retry-After`) |
| 502/503 | `EMAIL_SEND_FAILED`, `EMAIL_NOT_CONFIGURED` |

### Client pages

- Signed-in pages are client components that call the API with `api()` from `lib/client.ts`
  (adds `X-Request-ID`, throws `ApiClientError` with `code`, `status`, `fieldErrors`). Use
  `newIdempotencyKey()` per create action.
- After any mutation, re-fetch and render server state; don't patch local state optimistically
  (chat's pending bubble is the one exception).
- Server components (landing, privacy, terms) may import `lib/env.ts`; client components read
  `process.env.NEXT_PUBLIC_APP_ENV`.
- Pattern for page actions: a `call(fn, okMsg)` helper that returns `true/false`, shows the API
  message on failure and keeps the user's input (see `household/page.tsx`).

### Database

- IDs are `cuid()`. Enums are plain strings documented in schema comments; validate them in the route.
- JSON lives in `String` columns (`contributions`, `acceptedValues`, `genderPreference`,
  `includedCosts`…): `JSON.stringify` on write, parse defensively on read.
- Several user references are plain strings without FKs (`Introduction.lowUserId`,
  `Membership.userId`, `Notification.recipientId`, audit actor IDs). Deleting a user does
  **not** cascade to them — clean them up explicitly.
- Migrations live in `prisma/migrations/`; the first is a baseline (`00000000000000_init`).
  Vercel builds run `prisma migrate deploy` against that environment's branch, so a merged
  migration reaches each database on its next deploy.

---

## 8. Domain rules (the parts that are easy to break)

### Matching (`lib/matching.ts`)
Hard constraints (all two-way): same city · ≥1 common area · overlapping monthly-equivalent rent
bands · overlapping stay ranges · each person's habit answer is in the other's accepted set ·
gender compatibility (`gendersCompatible`) · overlapping move-in windows (`undecided` never
matches) · not blocked · not in an active household · same sandbox world.
Score 0–60 = 6 per identical habit (≤36) + 2 per common area (≤10) + 1 per overlapping day (≤14).
Sort: score desc, then userId asc. Up to 3 reasons; differing-but-accepted habits become
"Discuss" topics. **Credibility does not affect ranking.** Never show the score as a percentage.

### Credibility (`lib/credibility.ts`)
Identity 40 · email 10 · phone 10 · reference 20 · additional evidence 20 (cap 100). Computed
server-side from `VerificationCheck` rows with `status = "verified"`; snapshots are append-only.
Demo modes grant identity/email/phone on publish (60). Beta grants only email; identity + phone
come from staff approval in the ops console.

### Gender preference (private)
`Search.gender` ∈ woman | man | non_binary | prefer_not_to_say | null. `Search.genderPreference`
= JSON array, default all three. Open-to-anyone accepts everyone; otherwise the other person's
stated gender must be in your set. `prefer_not_to_say`/null only match people open to anyone.
Never displayed publicly; edited on Profile and in onboarding's Living habits step.

### Household agreement (`lib/household.ts`)
- States: `proposed → active → completed | closed`. `derivedStage`: planning · viewing ·
  application · move_in_pending · **needs_reagreement**.
- `proposePlanChange` creates version N+1, the proposer auto-accepts, an active household
  goes to `needs_reagreement`. `acceptPlan` forms the household (from proposed) or restores the
  progress stage once every active member accepts the latest version.
- Viewings and the application call `requirePlanAgreed()` → `409 NEEDS_REAGREEMENT`.
- Notice options: 2/4/6/8/12 weeks. Bills: `equal` | `same_as_rent`. Notes ≤ 500 chars.
- One active household per person; forming one pauses both searches and expires pending intros.
- Viewing outcome: all `completed` → completed; all identical → that state; else `disputed`.
- Handoff becomes `accepted` only when every member consents ("Demo application accepted; no
  home is reserved"). Move-in completes only when every member confirms `moved_in` — never by time.

### Introductions & chat
Intro text 30–300 chars; 10 new per 24 h and 20 pending max; expires after 7 days; one record
per unordered pair; 30-day resend cooldown after decline/expiry. Accepting creates the single
conversation for the pair. Messages ≤ 2,000 chars, HTML-escaped server-side (the client renders
with `dangerouslySetInnerHTML` relying on that), chat polls every 2 s (no websockets). Money-
request wording triggers a non-blocking caution. Block is immediate, bilateral and silent; it
closes the conversation and any shared household. Reports never change anyone's score.

### Research mode: sample worlds and sample housemates
- **Isolation invariant:** a user with `sandboxWorldId` only sees/introduces/reports users with
  the same `sandboxWorldId`; users with `null` never see sandbox users. Enforced in matching,
  `GET /users/[id]`, intros and reports — any new cross-user feature must enforce it too.
- A world = one tester (`sandboxWorldId = own id`) + `isDemoBot` counterparts generated **to
  match that tester's search** (`generateCounterparts`, 6 at creation; `topUpWorld` adds 4 when
  matches fall below 3, cap 18). Counterparts respect the tester's gender preference.
- `lib/demoBots.ts` hooks (`afterIntroduction`, `afterMessage`, `afterPlanProposedOrChanged`,
  `afterShortlistAdded`, `afterViewingProposed`, `afterViewingOutcome`,
  `afterHandoffActivity`, `afterMoveIn`) make counterparts accept/reply/vote/consent. They are
  no-ops for real users and must never throw into the caller. **If you add a step that needs a
  counterpart's action, add a hook, or solo testers will get stuck.**
- Personas (`lib/personas.ts`): Ben (London, fresh), Hana (London, women-only, household in
  progress), Chidi (Lagos, fresh), Zainab (Lagos, household in progress). Each click creates a
  brand-new private copy (emails `demo-<key>-<hex>@sandbox.housemate.test`); site-wide cap 30/min.
- Sample people carry a visible "Sample housemate · replies automatically" label and their first
  chat message says so.

### Auth, consent, privacy
Email OTP: 6 digits, 10-minute expiry, 5 attempts, 5 requests/hour/email. Consent to the privacy
notice is checked **before** the code is consumed (so a missing tick doesn't burn the code).
Settings offers data export (`/me/export`) and deletion (`/me/delete`: soft —
`deletion_pending`, unpublished, sessions revoked; no purge job exists yet). Mark sensitive DOM
with `data-clarity-mask="true"` (emails, codes, chat bodies, bios, report text).

---

## 9. UI & copy

- Tokens: `ink #23221e` (text), `paper #f6f4ef` (page), `cream #faf9f5`, `brand-*` greens
  (`brand-600 #2f6a5a` primary). Landing uses `font-display` + `tracking-tightest`, large radii
  (`rounded-4xl`/`5xl`) and a black pill CTA (`bg-ink text-cream`).
- Reuse `btn-primary | btn-secondary | btn-ghost | btn-danger`, `card`, `input`, `label`,
  `chip`, `field-error` from `globals.css` instead of re-styling.
- Accessibility: ≥ 44 px touch targets (`min-h-[44px]`), real labels, `role="alert"` on errors,
  dialogs with `role="dialog" aria-modal`, text alongside every colour signal, respect reduced
  motion. Keep buttons enabled and explain on submit rather than silently disabling them.
- Mobile first: check at 375 px. Signed-in pages have a bottom nav — fixed elements sit at
  `bottom-20 md:bottom-6`. The floating Feedback pill hides on chat threads.
- Avoid `backdrop-blur` and heavy blurred shadows (they caused blank areas while scrolling on phones).
- Copy: UK English, sentence case, plain words, no exclamation-mark marketing. Honesty labels are
  fixed phrases — "Demo verified", "Sample availability", "Checks completed — not a guarantee of
  safety", "Demo application accepted; no home is reserved". The banner text comes from `BANNER`.

---

## 10. Verifying and shipping

**Definition of done:** `npm run typecheck` clean · `npm run test:unit` passes · both e2e suites
pass against a local research-mode server · UI checked in the browser at 375 px for anything
visual · migration (if any) applied locally · commit with a descriptive message.

Then:

1. `git checkout staging && git merge main && git push origin staging && git checkout main`
   (allowed) → wait for the preview to be Ready (`vercel ls housemate-platform`) → run the e2e
   suites against the staging URL.
2. Ask the user to deploy production: `git push origin main` — or, for env changes,
   `CLARITY_ID=… FEEDBACK_URL=… bash scripts/switch-to-research.sh` (it rejects placeholder values
   and forces a rebuild when there's no new code).
3. After it's live, re-run the e2e suite against https://gethousemate.vercel.app and clean up (§11).

Notes: Vercel's free plan builds one deployment at a time (a stuck "BLOCKED" usually means
another build or a repo-access problem). Long waits: use a backgrounded `until … ; do sleep 10; done`
loop, not chained sleeps. Production variables via `vercel env add/rm` work. Preview variables are
flaky in the CLI: a general Preview var can't be added once branch-scoped ones exist, and removing
branch-scoped ones can fail silently — use the Vercel dashboard for those.

---

## 11. Cleaning up after a production e2e run

Record the baseline first (`select count(*) from "User"`), run the suite, then delete **only**
test worlds — never truncate:

```sql
CREATE TEMP TABLE test_owners AS SELECT id FROM "User"
  WHERE "createdAt" >= '<run start UTC>' AND "isDemoBot" = false
    AND (email LIKE 'demo-ben-%' OR email LIKE 'demo-zainab-%' OR email LIKE 'demo-hana-%'
         OR email LIKE 'tester%@example.com' OR email LIKE 'g%@example.com');
CREATE TEMP TABLE test_users AS SELECT id FROM "User"
  WHERE id IN (SELECT id FROM test_owners) OR "sandboxWorldId" IN (SELECT id FROM test_owners);
DELETE FROM "Household" WHERE id IN (SELECT "householdId" FROM "Membership" WHERE "userId" IN (SELECT id FROM test_users));
DELETE FROM "Introduction" WHERE "lowUserId" IN (SELECT id FROM test_users) OR "highUserId" IN (SELECT id FROM test_users);
DELETE FROM "Report" WHERE "reporterId" IN (SELECT id FROM test_users);
DELETE FROM "TesterFeedback" WHERE "testerId" = 'T-E2E';
DELETE FROM "Notification" WHERE "recipientId" IN (SELECT id FROM test_users);
DELETE FROM "AuditEvent" WHERE "actorId" IN (SELECT id FROM test_users) OR "subjectId" IN (SELECT id FROM test_users);
DELETE FROM "IdempotencyKey" WHERE "actorId" IN (SELECT id FROM test_users);
DELETE FROM "AuthCode" WHERE email LIKE '%@example.com';
DELETE FROM "User" WHERE id IN (SELECT id FROM test_users);
```

Run with `psql "$(neon connection-string research)"` and confirm the count matches the baseline.

---

## 12. Gotchas & hard-won lessons

- **`NEXT_PUBLIC_*` values are compile-time.** Changing them in Vercel needs a rebuild; a no-op
  `git push` doesn't trigger one.
- **`git push` / `vercel env` against production are blocked by the sandbox** even after chat
  approval — prepare a script or command for the user instead of retrying or working around it.
- **Neon's `dev` branch auto-archives**; the first connection wakes it (slow, not broken).
- **The Vercel CLI's stored token expires**; any `vercel` command refreshes it.
- **Next 16 regenerates `AGENTS.md` and may rewrite `tsconfig.json`** on `next dev`/`build`
  (`jsx: react-jsx`, `.next/dev/types`). Commit those changes rather than fighting them.
- **Resend's test sender only delivers to the account owner.** On-screen codes exist because
  real testers couldn't receive email — don't remove them from research mode.
- **Contributions used to be stored in each person's own period**, which showed Lagos annual rent
  as monthly. Always normalise to monthly before storing.
- **Shared persona logins collide.** That's why personas create fresh private accounts.
- **Seeded `dev`/`staging` people are shared and don't auto-reply**; research behaviour (sample
  worlds) only happens with `APP_ENV=research`.
- **Dead code to ignore:** `PROTOTYPE_BANNER`, `pairKey`, `ENV_LABEL`, `EMAIL_DELIVERY`,
  `IS_STAGING`, `IS_DEV`, `formatMonthlyEquivalent`, `getSessionCookieName`. `Meeting` table has
  no API.

---

## 13. Not built yet (don't assume it exists)

Real identity/KYC vendor · real listings feed (sample homes + user links only) · reference
checks and room-offer authority review (the `existing_room` journey is a label) · video meetings
· email/SMS notifications (in-app only) · outbox dispatcher (events are written, nothing consumes
them) · retention/purge jobs (deletion is soft) · websockets · Prisma 7 · ESLint.

Before anything reaches real users in `beta`: a verified Resend sending domain, finalised privacy
notice and lawful basis (UK GDPR / Nigeria NDPR) with legal advice, and the PRD's other production
gates.
