# Deploying

Vercel deploys from git. Full checklist: [`CLAUDE.md`](CLAUDE.md) §10–11.

| Branch | Deploys to | Database |
|---|---|---|
| `main` | production, https://gethousemate.vercel.app | Neon `research` (now) or `beta` (after the switch) |
| `staging` | https://housemate-platform-git-staging-teamihlehyns-projects.vercel.app | Neon `staging` |
| anything else | a preview URL | Neon `dev` |

Every build runs `prisma migrate deploy` first, so merged migrations reach that branch's
database on its next deploy. `NEXT_PUBLIC_*` values are baked in at build time: changing one
needs a new build, not just a variable change.

## Releasing a change

1. Locally: `npm run typecheck`, `npm run test:unit` and the e2e suites pass (see README).
2. `git checkout staging && git merge main && git push origin staging && git checkout main`, wait
   for the preview to be Ready (`vercel ls housemate-platform`), run the e2e suites against it.
3. The founder pushes production: `git push origin main`. Agents can't.
4. Re-run the e2e suite against production, then clean up test data (CLAUDE.md §11).

## Switching production mode (founder runs these)

- **To beta (real users):** `scripts/switch-to-beta.sh`. Read its header first. It needs
  `RESEND_API_KEY`, `EMAIL_FROM` (on peabudy.com, verified in Resend), `ADMIN_EMAILS` and
  `NEXT_PUBLIC_CONTACT_EMAIL` in your shell. It refuses placeholders, an unverified domain, a dirty
  tree or another branch. It never prints a secret, and it prints a smoke-test list at the end.
- **Back to research (rollback):** `bash scripts/switch-to-research.sh`, optionally with
  `CLARITY_ID=… FEEDBACK_URL=…`.

Both scripts set production variables, force a rebuild and push `main`.
