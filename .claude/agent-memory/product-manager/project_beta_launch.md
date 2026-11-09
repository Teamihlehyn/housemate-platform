---
name: project-beta-launch
description: Founder decisions and the recommended fast-track shape for the first real-user beta (decided 2026-11-09), plus key beta-mode gaps found in code
metadata:
  type: project
---

Founder decisions on 2026-11-09:
- **D1:** real people only, London AND Lagos, launch 2026-11-11.
- **Email:** buy a cheap sending domain. vercel.app can't be verified in Resend, and on-screen codes aren't acceptable for real users.
- **Legal:** Claude drafts the privacy notice, terms and DPIA (in docs/product/beta/legal/, with an AI-draft banner and placeholders; counsel to review).
- **Back office:** build a back-office MVP.

Later on 2026-11-09:
- **Renamed to Peabudy.** The domain peabudy.com was bought on Vercel (F-01 done). The planned sender is `Peabudy <hello@peabudy.com>`, with the root domain verified in Resend (a deliberate deviation from Resend's subdomain advice). Brand text in the docs is renamed. Code identifiers (housemate-platform, housemate_db, hm_session) stay as they are. ENG-28 covers the user-facing rename.
- **Name risk:** "Peabudy" is one letter away from Peabody, a large London housing association in the same sector. F-17 covers a trademark knock-out search; D13 decides whether to announce publicly as Peabudy.
- **Designer:** working on a mascot-led landing page and conversational onboarding. This is off the 11 Nov critical path (D14). Onboarding needs PM review against the matching fields and honesty guardrails.
- **Email gate:** stays at 16:00 on 10 Nov, with a 12:00 tripwire. Pass rules: Gmail inbox, all auth checks pass; Outlook or Yahoo junk is acceptable only with mitigation.
- `scripts/switch-to-research.sh` hard-codes NEXT_PUBLIC_SITE_URL to gethousemate.vercel.app, so it must be updated for peabudy.com.

My recommendation (D3–D14 still open):
- **Option B:** on 11 Nov, a public announcement pointing to a Tally waitlist, plus an invite-only cohort of up to 20 per city.
- Go/no-go at 18:00 UK on 2026-11-10. Fallback is Option C (waitlist only; product opens 2026-11-16).
- Full scope: go/no-go 2026-11-27, open sign-up 2026-12-07.
- The work packs are in docs/product/beta/.

**Why:** open public sign-up on 11 Nov isn't safe: no moderation UI, no transactional email, unreviewed legal text. In research mode, testers are isolated in sandbox worlds, so they can't meet real people.

**How to apply:** check which decisions the founder has since made before planning further. Don't let speed override the honesty labels or staff-only identity grants.

Gaps found in code (verify they're still true before relying on them):
- In beta, unverified viewers can call /recommendations and /users/[id] and see real people (ENG-02).
- verify-code ignores the privacy version when checking consent, and lets deletion_pending accounts sign back in.
- Nothing sets the suspended status.
- Homes, viewings and the application are reachable in beta.
- Clarity loads without consentv2.
- The Discover chip shows the credibility score while the subtitle calls it "match strength".
- The fonts lack ₦ and Ṣ (designer finding).
