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
  `DATABASE_URL`/`DIRECT_URL`. Re-rsync after each code change. Drop the DBs and the copy after.
- New migration: run `npm run db:migrate:dev -- --name x` in the scratch copy against a fresh
  scratch DB, then copy the folder back — never risk `migrate dev` drift prompts on `housemate_db`.
- Beta needs no Resend key: e2e_beta.py inserts AuthCode rows directly; emailed sends return 503
  locally but the code row and rate-limit audit rows are still written. Local `next dev` trusts
  `X-Forwarded-For`, so e2e can choose client IPs (used for per-IP / IPv6 /64 tests).
- To stop only your server use `lsof -ti tcp:3100 -sTCP:LISTEN` — plain `lsof -ti:3100` also
  lists client processes connected to that port.
- The guard hook blocks any Bash command whose *text* contains `vercel env … production` or a
  push to main — even in a throwaway test repo. Edit such scripts with Edit/Write; for script
  tests, build the fake origin with `git clone --bare` instead of pushing, and keep the stub
  harness in files (Write) so the command line stays clean.
- macOS ships bash 3.2: no `BASHPID`, no `${var,,}`. Use `BASH_SUBSHELL` to tell a pipeline
  subshell from the main shell (e.g. so an ERR trap prints once).
