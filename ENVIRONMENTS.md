# Environments

Three environments, isolated databases, env-aware behaviour. Everything is driven by `APP_ENV`.

| Env | `APP_ENV` | Where | Database (Neon branch) | Demo sink / personas | Login email | Banner |
|-----|-----------|-------|------------------------|----------------------|-------------|--------|
| **development** | `development` | Local (`npm run dev`) | local Postgres `housemate_db` | on | console sink | Prototype |
| **staging** | `staging` | Vercel (staging env) | `staging` (seeded demo data) | on | on-screen sink | Prototype |
| **beta** | `beta` | Vercel (Production) | `beta` (clean, real users) | **off** | **real email (Resend)** | Beta (checks still simulated) |

- **Demo sink** returns the 6-digit code in the API response so it can be shown on-screen. It is **always off in beta** regardless of `DEMO_MODE`.
- **Seeded personas** (the quick-login buttons) are hidden when `NEXT_PUBLIC_APP_ENV=beta`.
- Verification and property partners are still **simulated in every environment** until real vendors are integrated — beta says so plainly in its banner.

## Neon branches (project `muddy-unit-38565676`)

```
staging  [default]  — seeded demo data (24 members, 12 properties)
dev                 — seeded copy, for PR preview deploys
beta                — cleaned: 0 users, 12 sample properties kept
```

Get a branch's connection strings:
```bash
neon connection-string <branch> --pooled   # runtime DATABASE_URL
neon connection-string <branch>            # migrations DIRECT_URL
```

## Environment variable matrix

Set these per Vercel environment (Production = beta, custom "staging", Preview = dev):

| Variable | development (`.env`) | staging | beta (Production) |
|----------|----------------------|---------|-------------------|
| `APP_ENV` | development | staging | beta |
| `NEXT_PUBLIC_APP_ENV` | development | staging | beta |
| `DATABASE_URL` | local Postgres | `staging` pooled | `beta` pooled |
| `DIRECT_URL` | local Postgres | `staging` direct | `beta` direct |
| `DEMO_MODE` | true | true | *(unset — forced off)* |
| `RESEND_API_KEY` | — | — | **required** |
| `EMAIL_FROM` | — | — | **required** (verified sender) |

## Schema changes (migrations)

Schema is managed with **Prisma Migrate** (not `db push`). Migrations live in `prisma/migrations/` and are committed.

```bash
# Author a new migration locally (edits schema.prisma first):
npm run db:migrate:dev -- --name add_something

# Apply pending migrations to an environment (also runs automatically on deploy):
DATABASE_URL=... DIRECT_URL=... npm run db:migrate
```

`npm run build` runs `prisma migrate deploy` before `next build`, so every Vercel deploy applies pending migrations to that environment's branch automatically.

## Local development

```bash
createdb housemate_db           # once
cp .env.example .env            # APP_ENV=development, local Postgres
npm install
npm run setup                   # migrate deploy + seed
npm run dev
```

## Deploying

Once GitHub + Vercel Git is connected:
- push to **`main`** → deploys **beta** (Production)
- push to **`staging`** → deploys **staging**
- open a **PR** → preview deploy on the `dev` branch DB

## Beta go-live checklist (NOT just a deploy)

Opening beta to real people requires non-code approvals from the PRD's production gates:

- [ ] Privacy notice + lawful basis (UK GDPR & Nigeria NDPR)
- [ ] Age / safety assessment
- [ ] Security & access-control review
- [ ] Retention policy + data-deletion flow operational
- [ ] Housing/fee compliance (England Right to Rent scoped separately; NG market rules)
- [ ] Incident / moderation coverage
- [ ] **Real verification & listing vendors** — until these exist, beta must keep stating checks are simulated and must not be used for real tenancy decisions.

The infrastructure is ready before these are done; **opening to users is gated on them.**
