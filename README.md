# Peabudy

Peabudy (formerly Housemate) helps people in London and Lagos find a compatible housemate and
agree the money (rent split, bills, notice) in writing before anyone moves in.

**Start with [`CLAUDE.md`](CLAUDE.md).** It is the authoritative guide: rules, commands,
environments, domain rules and gotchas. This README is only the short version.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript · Prisma 6 + PostgreSQL (Neon in the cloud) ·
Tailwind CSS 3 · Resend for login email · hosted on Vercel. One app, REST API under `/api/v1`,
no background workers.

## Run it locally

Needs Node 20+ and a local Postgres (e.g. `brew services start postgresql`).

```bash
createdb housemate_db
cp .env.example .env        # set DATABASE_URL and DIRECT_URL to your local database
npm install                 # also runs prisma generate
npm run setup               # apply migrations + seed sample data
npm run dev                 # http://localhost:3000
```

`APP_ENV=development` (the default in `.env.example`) shows login codes on screen. To run the app
the way production does today, start it with `APP_ENV=research NEXT_PUBLIC_APP_ENV=research`.

## Check your work

```bash
npm run typecheck
npm run test:unit
python3 tests/e2e_research.py http://localhost:3000                        # research-mode server
python3 tests/e2e_gender.py http://localhost:3000 "postgresql://$USER@localhost:5432/housemate_db"
python3 tests/e2e_beta.py http://localhost:3100 "postgresql://$USER@localhost:5432/<beta_test_db>"  # beta-mode server, local DB only
```

## More

- [`ENVIRONMENTS.md`](ENVIRONMENTS.md): the four modes and their variables.
- [`DEPLOY.md`](DEPLOY.md): how staging and production deploys work, and switching modes.
- `docs/product/`, `docs/design/`: specs and the beta work pack.

Internal names (`housemate_db`, the `hm_session` cookie, the Vercel project
`housemate-platform`, `*.housemate.test` sample emails) predate the rename and stay as they are.
