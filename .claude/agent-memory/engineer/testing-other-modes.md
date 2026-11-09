---
name: testing-other-modes
description: How to run research/beta e2e when the designer's dev server owns port 3000 in development mode
metadata:
  type: project
---

The designer usually runs `npm run dev` on :3000 in **development** mode, where e2e_research.py
has 4 env-caused failures (no consent required, no sandbox on email sign-up). Don't kill it and
don't start a second `next dev` in the same checkout (shared `.next/`).

**Why:** parallel agents share one checkout; breaking their server costs them time.

**How to apply:** rsync the repo (minus node_modules/.next/.env/.git) to the scratchpad,
`cp -cR node_modules` (APFS clone, fast), `createdb housemate_eng_research` / `housemate_eng_beta`,
`prisma migrate deploy` (+ seed for research), then run `next dev -p 3100` with explicit
`APP_ENV`/`NEXT_PUBLIC_APP_ENV`/`DATABASE_URL`. Beta needs no Resend key: e2e_beta.py inserts
AuthCode rows directly. Re-rsync after each code change. The guard hook blocks any Bash command
whose text contains `vercel env … production` — edit such scripts with Edit/Write, not python/sed.
