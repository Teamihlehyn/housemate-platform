# Deploying a staging environment (Vercel + Neon)

Goal: a public HTTPS URL (`https://<project>.vercel.app`) you can share with a few friends for
pseudo user-testing. Data is synthetic and the whole app is labelled a prototype.

Everything below is done from **your** accounts — the auth steps can't be automated for you.

---

## 0. Prerequisites

- A [GitHub](https://github.com) account
- A [Neon](https://neon.tech) account (free tier is enough)
- A [Vercel](https://vercel.com) account (free "Hobby" tier is enough)

The code is already prepared: Prisma targets Postgres, `.env.example` documents the variables, and
`prisma generate` runs automatically on install (`postinstall`).

---

## 1. Push the repo to GitHub

A git repo is already initialised locally with an initial commit. Create an empty GitHub repo
(no README/gitignore), then:

```bash
cd ~/HousematePlatform
git remote add origin https://github.com/<you>/housemate-platform.git
git branch -M main
git push -u origin main
```

> `.env` and `node_modules` are gitignored — your local DB credentials won't be pushed.

---

## 2. Create the Neon database

1. In the Neon console, **create a project** (pick a region near your testers, e.g. EU West / London).
2. It creates a database (default `neondb`). Open **Connection Details**.
3. Copy **two** connection strings — Neon shows a toggle for pooled vs. direct:
   - **Pooled** (host contains `-pooler`) → this becomes `DATABASE_URL`
   - **Direct** (no `-pooler`) → this becomes `DIRECT_URL`

   Both end with `?sslmode=require`. Example shapes:
   ```
   # Pooled  (DATABASE_URL)
   postgresql://neondb_owner:XXXX@ep-cool-name-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
   # Direct  (DIRECT_URL)
   postgresql://neondb_owner:XXXX@ep-cool-name.eu-west-2.aws.neon.tech/neondb?sslmode=require
   ```

---

## 3. Create the schema + seed the cloud database (from your machine)

Run this once, pointing at the **direct** URL (schema changes + seeding need the unpooled connection):

```bash
cd ~/HousematePlatform
DATABASE_URL="<neon-DIRECT-url>" DIRECT_URL="<neon-DIRECT-url>" npm run setup
```

You should see `✔ Seeded 24 members and 12 sample properties.`

> To wipe and re-seed later (fresh test round):
> ```bash
> DATABASE_URL="<neon-DIRECT-url>" DIRECT_URL="<neon-DIRECT-url>" npm run db:reset
> ```

---

## 4. Deploy on Vercel

1. Vercel → **Add New… → Project** → import your GitHub repo. Framework auto-detects as **Next.js**;
   leave build settings default.
2. Before the first deploy, open **Environment Variables** and add (Production + Preview):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** connection string |
   | `DIRECT_URL` | Neon **direct** connection string |
   | `DEMO_MODE` | `true` |

3. Click **Deploy**. When it finishes you'll get `https://<project>.vercel.app`.

> Why pooled for `DATABASE_URL`: each serverless function opens its own connection, and Neon's
> pooler keeps you under the connection limit. `DIRECT_URL` is only used for schema/migrations.

---

## 5. Share it

Send friends the Vercel URL. Tell them:

- Click **Get started**, enter **any email**. The 6-digit code appears on-screen in the **demo sink**
  (no real inbox needed) — that's expected for the prototype.
- Or use a **seeded persona** button (Amara, Ben, Chidi, …) to jump into a ready-made profile.
- To experience a full match, two people can sign in as **Amara** and **Ben** (London) and go through
  intro → chat → household → viewing → move-in.

Everything is clearly labelled a prototype: sample people, simulated checks, no real bookings.

---

## Notes & gotchas

- **Chat updates via polling** (every 2s), not websockets — fine for light testing, expect a ~2s lag.
- **Test clock:** seeded move-in dates are relative to when you seeded. Re-seed (step 3 re-run) if
  dates drift too far during a long testing window.
- **Resetting between test rounds:** `npm run db:reset` against the Neon direct URL (step 3).
- **Cost:** Neon + Vercel free tiers comfortably cover a handful of testers. No card required for Hobby.
- **This is staging, not production:** no real email, no rate-limit hardening for abuse, no custom
  domain. Don't put real personal data in it — it's for synthetic pseudo-testing only.
- **Locking it down (optional):** if you want it non-public, add Vercel's password protection
  (Project → Settings → Deployment Protection) — available on paid plans — or just share the URL
  privately; there's no search-engine sitemap.
