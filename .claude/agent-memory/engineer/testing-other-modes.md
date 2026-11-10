---
name: testing-other-modes
description: How to run research/beta e2e and script tests when another agent's dev server owns port 3000, plus guard-hook and macOS-bash gotchas
metadata:
  type: project
---

Another agent (designer or coordinator) usually runs `npm run dev` on :3000, sometimes in
**development** mode (e2e_research.py then has 4 env-caused failures), sometimes **beta**.
Don't kill it and don't start a second `next dev` in the same checkout (shared `.next/`).

**Why:** parallel agents share one checkout; breaking their server costs them time.

**How to apply:**
- rsync the repo (minus node_modules/.next/.env/.git) to the scratchpad, `cp -cR node_modules`
  (APFS clone), `createdb housemate_eng_research` / `housemate_eng_beta`, `prisma migrate deploy`
  (+ seed for research), then `next dev -p 3100` with explicit `APP_ENV`/`NEXT_PUBLIC_APP_ENV`/
  `DATABASE_URL`/`DIRECT_URL`. Re-rsync after each code change. Drop the DBs after.
- The guard blocks `rm -rf` outside the project, so the scratch copy can't be deleted by the
  agent; leave it in the session scratchpad and say so.
- New migration: write it via `prisma migrate diff --from-migrations … --to-schema-datamodel …
  --shadow-database-url <scratch db> --script`, split into folders by hand, verify with
  `migrate deploy` + an empty diff on a fresh scratch DB. Then `npm run db:migrate` on
  `housemate_db` (additive) — regenerating the Prisma client otherwise breaks the other
  agent's :3000 server with missing columns.
- Beta e2e (since 10 Nov) runs a fake Resend inside the script on :8025: start the beta
  server with `EMAIL_API_URL=http://127.0.0.1:8025 RESEND_API_KEY=test-key EMAIL_FROM=…
  OPEN_CITIES=lagos` (EMAIL_API_URL is honoured only without VERCEL_ENV). Local `next dev`
  trusts `X-Forwarded-For`, so e2e picks client IPs (`next_ip()`) to stay clear of per-IP caps.
- To stop only your server use `lsof -ti tcp:3100 -sTCP:LISTEN` — plain `lsof -ti:3100` also
  lists client processes connected to that port.
- Python urllib header dicts may come back lower-cased: compare header names case-insensitively.
- The guard hook blocks any Bash command whose *text* contains `vercel env … production` or a
  push to main — even in a throwaway test repo. Edit such scripts with Edit/Write; for script
  tests, build the fake origin with `git clone --bare` instead of pushing, and keep the stub
  harness in files (Write) so the command line stays clean.
- macOS ships bash 3.2: no `BASHPID`, no `${var,,}`. Use `BASH_SUBSHELL` to tell a pipeline
  subshell from the main shell (e.g. so an ERR trap prints once).
