#!/usr/bin/env bash
# Switch gethousemate.vercel.app to user-testing (research) mode and deploy.
# Production uses the Neon `research` branch (sample homes only; testers get
# private sample worlds). The beta database and pilot code are untouched —
# to go back, set APP_ENV/NEXT_PUBLIC_APP_ENV=beta and point DATABASE_URL/DIRECT_URL at `beta`.
#
# Requires: vercel CLI (logged in, project linked) and neon CLI (logged in, linked).
# Optional: CLARITY_ID=... FEEDBACK_URL=https://tally.so/r/... bash scripts/switch-to-research.sh
set -euo pipefail
cd "$(dirname "$0")/.."

set_prod() {
  vercel env rm "$1" production --yes >/dev/null 2>&1 || true
  printf '%s' "$2" | vercel env add "$1" production --yes >/dev/null
  echo "  production  $1"
}
set_staging() {
  vercel env rm "$1" preview staging --yes >/dev/null 2>&1 || true
  if printf '%s' "$2" | vercel env add "$1" preview staging --yes >/dev/null 2>&1; then
    echo "  staging     $1"
  else
    echo "  staging     $1 — couldn't set via CLI; set it in Vercel → Settings → Environment Variables (Preview, branch: staging)"
  fi
}

echo "Setting production to research mode…"
set_prod APP_ENV research
set_prod NEXT_PUBLIC_APP_ENV research
set_prod DEMO_MODE true
set_prod NEXT_PUBLIC_SITE_URL https://gethousemate.vercel.app
set_prod DATABASE_URL "$(neon connection-string research --pooled)"
set_prod DIRECT_URL "$(neon connection-string research)"
[ -n "${CLARITY_ID:-}" ] && set_prod NEXT_PUBLIC_CLARITY_ID "$CLARITY_ID"
[ -n "${FEEDBACK_URL:-}" ] && set_prod NEXT_PUBLIC_FEEDBACK_URL "$FEEDBACK_URL"

echo "Making staging mirror production…"
set_staging APP_ENV research
set_staging NEXT_PUBLIC_APP_ENV research

echo "Deploying (push main → production)…"
git push origin main
echo "Done. Vercel is building; https://gethousemate.vercel.app updates in ~2 minutes."
