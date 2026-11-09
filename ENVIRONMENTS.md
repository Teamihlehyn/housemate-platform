# Environments

Behaviour is set by `APP_ENV` (server) and `NEXT_PUBLIC_APP_ENV` (browser, baked in at build).
They must match. Every flag lives in `lib/env.ts`. Full detail: [`CLAUDE.md`](CLAUDE.md) §4.

| `APP_ENV` | Where | Login codes | Personas and sample worlds | Identity check | Homes, viewings, move-in |
|---|---|---|---|---|---|
| `development` | local | on screen | personas | automatic (demo) | on |
| `staging` | Vercel preview | on screen | personas | automatic (demo) | on |
| `research` | production today | on screen (not for staff) | every account gets a sample world | automatic (demo) | on (sample homes) |
| `beta` | production from launch | **emailed** (Resend) | off | **staff review** | **off** (agreement only) |

It fails closed: on the production deployment the server won't start unless `APP_ENV` is one of
the four values and `NEXT_PUBLIC_APP_ENV` equals it. Anywhere else, an unset or unknown
`APP_ENV` runs as `development` **without** on-screen codes. `DEMO_MODE=false` also turns
on-screen codes off. Beta also limits browsing to identity-checked people.

## Variables

| Variable | Needed | Notes |
|---|---|---|
| `APP_ENV`, `NEXT_PUBLIC_APP_ENV` | always | One of the four modes, same value in both |
| `DATABASE_URL`, `DIRECT_URL` | always | Pooled (runtime) and direct (migrations) Postgres |
| `DEMO_MODE` | optional | `"false"` turns on-screen codes off outside beta |
| `RESEND_API_KEY`, `EMAIL_FROM` | beta | `EMAIL_FROM` on a domain verified in Resend, e.g. `Peabudy <hello@peabudy.com>` |
| `ADMIN_EMAILS` | beta | Comma-separated staff addresses; always emailed codes |
| `NEXT_PUBLIC_CONTACT_EMAIL` | beta | Shown when someone needs a person (e.g. cancelling a deletion) |
| `IP_HASH_SALT` | beta | Salt for hashing IPs in the code-request limit; set by `switch-to-beta.sh` |
| `NEXT_PUBLIC_SITE_URL` | cloud | Absolute base URL for link previews |
| `NEXT_PUBLIC_CLARITY_ID`, `NEXT_PUBLIC_FEEDBACK_URL` | research only | Clarity is never loaded in beta |
| `TEST_TODAY` | tests | Pins "today" (`YYYY-MM-DD`) |

## Databases (Neon project `muddy-unit-38565676`)

`research` (production now) · `beta` (clean, for the real-user launch) · `staging` (seeded) ·
`dev` (seeded, PR previews, auto-archives). Get connection strings with
`neon connection-string <branch>` (direct) or `--pooled`. Never paste them into files.

Schema changes go through Prisma Migrate only (`npm run db:migrate:dev -- --name x`). Each Vercel
build runs `prisma migrate deploy` against its own branch.
