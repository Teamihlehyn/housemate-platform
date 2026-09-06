# Housemate — MVP prototype

A local, full-stack prototype of the Housemate platform from the MVP PRD: find people whose living
preferences and move-in dates fit yours, see what's verified, and organise a shared home end-to-end.

**This is a prototype** — sample people, simulated checks, no real bookings, payments or documents.
Every screen carries the "Prototype — sample people, simulated checks, no real bookings" banner.

## Stack

- **Next.js 15** (App Router) — landing page, authenticated app, and the `/api/v1` REST API in one process
- **Prisma + PostgreSQL** — local Postgres for dev, Neon (serverless Postgres) for staging
- **Tailwind CSS** — calm, neutral, accessible housing UI (WCAG-minded, 44px touch targets, keyboard focus)

## Quick start (local)

Requires a running Postgres (e.g. Homebrew: `brew services start postgresql`).

```bash
createdb housemate_db                 # once
cp .env.example .env                  # then set DATABASE_URL / DIRECT_URL to your local Postgres
npm install                           # runs `prisma generate` via postinstall
npm run setup                         # db push + seed (24 members, 12 sample properties)
npm run dev                           # http://localhost:3000
```

A local `.env` for Homebrew Postgres looks like:

```
DATABASE_URL="postgresql://<you>@localhost:5432/housemate_db"
DIRECT_URL="postgresql://<you>@localhost:5432/housemate_db"
DEMO_MODE="true"
```

Then open **http://localhost:3000**, click **Get started**, and either sign in with any email
(the 6-digit code appears in the on-screen "demo sink") or use a **seeded persona** for a profile
that already has matches ready.

> Tip: open two browser windows (or one normal + one private) and sign in as **Amara** and **Ben**
> to play both sides of a London household.

### Seeded demo personas

| Persona | City | Journey | Use for |
|---|---|---|---|
| `amara@demo.housemate.test` / `ben@demo.housemate.test` | London | Find together | **T01** two students form a household and move in |
| `chidi@demo.housemate.test` / `damola@demo.housemate.test` | Lagos | Has-a-place / Find together | **T02** annual-rent budgets, monthly-equivalent display |
| `femi@demo.housemate.test` (host) / `grace@demo.housemate.test` | Lagos | Room to offer / Find together | **T03** existing room route |
| `verifier@demo.housemate.test` | — | Staff | Operations → **Audit explorer** (`/staff`) |

## What's implemented (core end-to-end slice)

Landing page · email-code auth · onboarding (journey → city/areas → budget/dates → living habits →
bio → publish) · simulated core identity + contacts → **demo credibility 60–100** · **deterministic
date-aware matching** (hard constraints + 0–60 ranking with explanations) · discovery & public
profiles · introductions (send/accept/decline/withdraw, limits, cooldowns) · **persistent chat**
(client-message-id dedup, money-request caution) · **household** workspace (propose/accept, plan
versions, one-active-household concurrency) · **shortlist** (sample catalogue + user links, votes) ·
**viewings** (propose/confirm/outcome, disputed on disagreement) · **rental handoff** (dual consent →
mock partner accepts, "no home is reserved") · **move-in confirmation** (completes only when both
confirm) · notifications inbox · block · pause/resume search · **staff audit explorer**.

Every state-changing operation writes an **audit event + outbox event in the same transaction**,
increments an aggregate **version** (optimistic concurrency via `expected_version` → `409`), and
supports **idempotency keys**. Public DTOs never expose contacts, legal identity, addresses or evidence.

## Architecture

```
app/
  page.tsx, safety/, signin/        # public marketing + auth
  (app)/                            # authenticated shell (server-side auth guard)
    onboarding/ discover/ members/[id]/ messages/ household/ profile/ notifications/ staff/
  api/v1/                           # REST API route handlers
lib/
  matching.ts    # deterministic eligibility + ranking (algorithm match-v1)
  credibility.ts # rubric v1 scoring (identity 40 / email 10 / phone 10 / reference 20 / additional 20)
  audit.ts       # writeAudit + writeOutbox + notify (transaction-scoped)
  household.ts   # workspace view builder + stage derivation
  guard.ts       # requireUser / requireStaff / withIdempotency
  api.ts, session.ts, money.ts, dates.ts, constants.ts
prisma/
  schema.prisma  # accounts, profiles, searches, verification, introductions, chat,
                 # households, properties, viewings, handoffs, audit, outbox, idempotency
  seed.ts        # synthetic members + sample properties (deterministic via TEST_TODAY)
```

## Useful scripts

```bash
npm run db:reset   # wipe + re-seed the database (prisma db push --force-reset + seed)
npm run build      # production build / full type-check
```

## Deploy a staging environment (Vercel + Neon)

For sharing with a few testers. See `DEPLOY.md` for the full step-by-step. In short:

1. **Neon** — create a project + database, copy the **pooled** and **direct** connection strings.
2. **Seed the cloud DB** from your machine:
   ```bash
   DATABASE_URL="<neon-direct-url>" DIRECT_URL="<neon-direct-url>" npm run setup
   ```
3. **Vercel** — import the GitHub repo, add env vars `DATABASE_URL` (pooled), `DIRECT_URL` (direct),
   `DEMO_MODE=true`, and deploy. Share the resulting `https://<project>.vercel.app` URL.

## Scope notes vs. the PRD

This is the **core end-to-end vertical slice** (the T01–T03 happy paths plus key unhappy paths and
server-side guards). Deliberately out of scope for this first local build: full verification
simulator with reviewer queues and reference/room-authority depth, the complete moderation/appeals
console, privacy export/deletion jobs, the AI dataset manifest/export, and websockets (chat uses
short polling). The data model, audit/outbox discipline, versioning and permission boundaries are
built to extend into those areas.
