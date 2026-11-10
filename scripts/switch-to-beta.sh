#!/usr/bin/env bash
# Switch production (gethousemate.vercel.app) to the real-user beta and deploy.
#
# ROLLBACK: `bash scripts/switch-to-research.sh` puts production back in research mode
# (the research database and sample worlds are untouched by this script).
#
# The founder runs this: agents can't change production variables or push main.
# Requires: vercel CLI (logged in, project linked), neon CLI (logged in), curl, python3.
#
# Inputs come from the environment and are NEVER printed (safe under `bash -x` too):
#   RESEND_API_KEY              Resend key with sending access          (required)
#   EMAIL_FROM                  e.g. "Peabudy <hello@peabudy.com>" (required; domain must be
#                               verified in Resend and be peabudy.com or a subdomain of it)
#   ADMIN_EMAILS                comma-separated staff addresses         (required)
#   NEXT_PUBLIC_CONTACT_EMAIL   e.g. hello@peabudy.com                  (required)
#   NEXT_PUBLIC_SURVEY_URL      https:// survey link                     (optional)
#   EMAIL_LINK_SECRET           random secret for email links (ENG-12)   (optional)
#   SITE_URL                    public base URL (default https://gethousemate.vercel.app;
#                               use https://peabudy.com once it's the primary domain in Vercel)
#
# Example (values typed by you, not stored anywhere):
#   read -rs RESEND_API_KEY; export RESEND_API_KEY
#   EMAIL_FROM="Peabudy <hello@peabudy.com>" ADMIN_EMAILS="you@…" \
#   NEXT_PUBLIC_CONTACT_EMAIL="hello@peabudy.com" bash scripts/switch-to-beta.sh
#
# You're asked to type a confirmation twice: before any variable changes, and again before
# `git push origin main`. If a step fails after variables start changing, the script stops
# and tells you to roll back.
#
# -E so the ERR trap (installed in step 2) also fires inside functions.
set -Eeuo pipefail
cd "$(dirname "$0")/.."

BRAND_DOMAIN="peabudy.com"
SITE_URL="${SITE_URL:-https://gethousemate.vercel.app}"

die() { echo "Stopped: $*" >&2; exit 1; }

# confirm "PHRASE" — the person must type PHRASE exactly (read from the terminal/stdin).
confirm() {
  local answer=""
  printf '\nType "%s" to continue (anything else stops): ' "$1"
  read -r answer || true
  [ "$answer" = "$1" ]
}

# ---------------------------------------------------------------------------
# 1. Guards — all run before anything changes.
# ---------------------------------------------------------------------------
[[ "$SITE_URL" =~ ^https://[A-Za-z0-9.-]+$ ]] || die "SITE_URL must look like https://host (no path)."

for tool in vercel neon curl python3 git openssl; do
  command -v "$tool" >/dev/null || die "$tool isn't installed."
done

[ -z "$(git status --porcelain)" ] || die "the working tree isn't clean. Commit or stash first."
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || die "check out main first."

# Every input check runs in python3, which reads values from the environment, so no
# secret is ever expanded on a shell or command line (safe under `bash -x`). Then
# EMAIL_FROM's domain must be peabudy.com (or a subdomain) and 'verified' in Resend.
echo "Checking inputs and the sending domain with Resend…"
python3 - "$BRAND_DOMAIN" <<'PY' || die "an input check failed (see above). Nothing was changed."
import json, os, re, sys, urllib.request, urllib.error
brand = sys.argv[1]
PLACEHOLDERS = ("yourdomain", "example", "onboarding@resend.dev", "[DOMAIN]", "[CONTACT", "…", "...")
def bad(v):
    return not v.strip() or any(p in v for p in PLACEHOLDERS)
for name in ("RESEND_API_KEY", "EMAIL_FROM", "ADMIN_EMAILS", "NEXT_PUBLIC_CONTACT_EMAIL"):
    if bad(os.environ.get(name, "")):
        sys.exit(f"  {name} is empty or looks like a placeholder.")
for name in ("NEXT_PUBLIC_SURVEY_URL", "EMAIL_LINK_SECRET"):
    if name in os.environ and bad(os.environ[name]):
        sys.exit(f"  {name} is set but empty or looks like a placeholder. Unset it or fix it.")
if "NEXT_PUBLIC_SURVEY_URL" in os.environ and not os.environ["NEXT_PUBLIC_SURVEY_URL"].startswith("https://"):
    sys.exit("  NEXT_PUBLIC_SURVEY_URL must be an https:// link.")
if not re.fullmatch(r"[^@\s,]+@[^@\s,]+\.[^@\s,]+", os.environ["NEXT_PUBLIC_CONTACT_EMAIL"].strip()):
    sys.exit("  NEXT_PUBLIC_CONTACT_EMAIL must be a single email address.")
sender = os.environ["EMAIL_FROM"]
m = re.search(r"<([^<>@\s]+)@([^<>@\s]+)>\s*$", sender) or re.fullmatch(r"\s*([^<>@\s]+)@([^<>@\s]+)\s*", sender)
if not m:
    sys.exit('  EMAIL_FROM must be "Name <local@domain>" or "local@domain".')
domain = m.group(2).lower()
if domain != brand and not domain.endswith("." + brand):
    sys.exit(f"  EMAIL_FROM must send from {brand} or a subdomain of it (got {domain}).")
req = urllib.request.Request("https://api.resend.com/domains",
                             headers={"Authorization": "Bearer " + os.environ["RESEND_API_KEY"]})
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.load(r).get("data", [])
except urllib.error.HTTPError as e:
    sys.exit(f"  Resend rejected the key (HTTP {e.code}).")
except Exception as e:
    sys.exit(f"  Couldn't reach Resend ({type(e).__name__}).")
status = next((d.get("status") for d in data if d.get("name", "").lower() == domain), None)
if status != "verified":
    sys.exit(f"  {domain} is {'not added' if status is None else status} in Resend; it must be 'verified'.")
print(f"  {domain} is verified.")
PY

neon connection-string beta >/dev/null || die "couldn't read the Neon beta branch (run 'neon auth'?)."

echo
echo "All checks passed. Next: production's variables are switched to beta (database first,"
echo "mode last). Nothing is deployed until you confirm a second time."
confirm "switch to beta" || die "you didn't confirm. Nothing was changed."

# ---------------------------------------------------------------------------
# 2. Production variables. Values go through stdin, never argv, so nothing is
#    echoed even with `bash -x`.
#    Order (HM-25): the database first, the mode variables last, so a failure part-way
#    leaves production's mode untouched. From here on any failure is half-switched.
# ---------------------------------------------------------------------------
# Print once and stop. A failure inside a pipeline runs the trap in a subshell first, so
# only the main shell prints.
on_fail() {
  trap - ERR
  [ "${BASH_SUBSHELL:-0}" = 0 ] || exit 1   # (macOS bash 3.2 has no BASHPID)
  echo >&2; echo "FAILED: $1" >&2; exit 1
}
trap 'on_fail "production is half-switched — run scripts/switch-to-research.sh"' ERR

put() { # put NAME  — value read from stdin
  vercel env rm "$1" production --yes >/dev/null 2>&1 || true
  vercel env add "$1" production --yes >/dev/null
  echo "  set     $1"
}
put_env() { printenv "$1" | tr -d '\n' | put "$1"; }   # copy a variable from this shell
put_lit() { printf '%s' "$2" | put "$1"; }              # non-secret literal
drop() {
  vercel env rm "$1" production --yes >/dev/null 2>&1 && echo "  removed $1" || echo "  (no $1 to remove)"
}

echo "Setting production to beta…"
# 2a. Database first.
neon connection-string beta --pooled | tr -d '\n' | put DATABASE_URL
neon connection-string beta | tr -d '\n' | put DIRECT_URL

# 2b. Everything else.
put_lit NEXT_PUBLIC_SITE_URL "$SITE_URL"
put_env RESEND_API_KEY
put_env EMAIL_FROM
put_env ADMIN_EMAILS
put_env NEXT_PUBLIC_CONTACT_EMAIL
if printenv NEXT_PUBLIC_SURVEY_URL >/dev/null; then put_env NEXT_PUBLIC_SURVEY_URL; fi
if printenv EMAIL_LINK_SECRET >/dev/null; then put_env EMAIL_LINK_SECRET; fi
# Salt for hashing IPs in the code-request rate limit (HM-08, HM-23). Generated here and
# never shown; rotating it only resets the per-IP counts.
openssl rand -hex 32 | tr -d '\n' | put IP_HASH_SALT

# Clarity stays off until the consent banner ships (D8, ENG-14); the built-in feedback
# form replaces Tally. Test-only switches must never reach real users.
drop NEXT_PUBLIC_CLARITY_ID
drop NEXT_PUBLIC_FEEDBACK_URL
drop TEST_TODAY
drop FORCE_SEED

# 2c. Mode last. Both mode variables come from one value: the app refuses to start in
# production if they differ or aren't a known mode (lib/env.ts, HM-05).
MODE=beta
put_lit DEMO_MODE false
put_lit APP_ENV "$MODE"
put_lit NEXT_PUBLIC_APP_ENV "$MODE"

# ---------------------------------------------------------------------------
# 3. Deploy. NEXT_PUBLIC_* values are baked in at build time, so force a build.
#    The variables are all beta now, but the live site is unchanged until this build.
# ---------------------------------------------------------------------------
trap 'on_fail "production variables are set to beta but nothing was deployed. Run scripts/switch-to-research.sh to put them back (or fix the problem and run: git push origin main)."' ERR

echo
echo "Production variables are set to beta. The live site doesn't change until it's rebuilt."
if ! confirm "push to production"; then
  trap - ERR
  echo "Stopped before deploying. The variables are set to beta but nothing was deployed." >&2
  echo "Undo them with scripts/switch-to-research.sh, or deploy later with: git push origin main" >&2
  exit 1
fi

echo "Deploying (push main → production)…"
git fetch -q origin main
if [ "$(git rev-parse main)" = "$(git rev-parse origin/main)" ]; then
  git commit -q --allow-empty -m "chore: redeploy to apply beta environment settings"
fi
git push origin main

cat <<EOF

Done. Vercel is building; $SITE_URL updates in about 2 minutes.
Check 'vercel ls housemate-platform' until the new deployment is Ready, then tick each:

  [ ] 1. The banner shows the beta text, not "Prototype".
  [ ] 2. /signin has no persona panel and no on-screen code.
  [ ] 3. A sign-in code arrives in a Gmail inbox (not spam), from $BRAND_DOMAIN.
  [ ] 4. A staff (ADMIN_EMAILS) sign-in works and /staff loads.
  [ ] 5. No sink_code: curl -s -X POST $SITE_URL/api/v1/auth/request-code \\
           -H 'content-type: application/json' -d '{"email":"YOUR-OWN-ADDRESS"}'
         returns {"data":{"status":"sent"}} with no sink_code, and
         curl -s -X POST $SITE_URL/api/v1/auth/demo-persona -H 'content-type: application/json' -d '{}'
         returns 404 NOT_FOUND.
  [ ] 6. /household shows no homes, viewings, application or move-in tabs.

Rollback: bash scripts/switch-to-research.sh
EOF
