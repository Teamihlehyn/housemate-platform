---
name: beta-prelaunch-review-2026-11
description: Pre-launch security review for the 11 Nov 2026 beta (Peabudy rename) - finding IDs HM-01..HM-25, status, and threat-model summary
metadata:
  type: project
---

First review 2026-11-09 against main @ 48746d1: NO-GO as-is. Re-review same day of the uncommitted fix + UI rebuild: OK to push to staging; production beta switch still gated on HM-06 and the items below. Product renamed Peabudy; sending domain peabudy.com.

**Why:** real strangers in London and Lagos from 11 Nov (invite-led, staff video ID check). Tickets in docs/product/beta/ (security.md SEC-01..12, engineer.md ENG-01..27). Full report kept git-ignored in docs/security/.

**How to apply:** on the next review, re-verify each ID against code and update status (open / fixed in <commit> / accepted). "Fixed (WT)" = fixed in the working tree on 2026-11-09, not yet committed: confirm the commit hash next time. Do not record exploit steps here until fixed (public repo).

Threat model in one line: assets = member PII (email, phone, gender + preference, location detail, chats, reports), staff console; main actors = unverified sign-ups, verified bad actors (scam/harassment), outsiders abusing unauthenticated endpoints; key boundaries = viewer verification gate, block, sandbox world, staff role.

Status after 2026-11-09 re-review:
- HM-01 fixed (WT): verified-only gate in recommendations, users/[id], intro order (lib/verification.ts)
- HM-02 fixed (WT): block ends pending intros; assertNotBlocked in accept, households POST, messages POST (lib/blocks.ts)
- HM-03 fixed (WT): crypto OTP, atomic per-code attempts, hourly per-email cap, constant-time compare (lib/auth.ts)
- HM-04 fixed (WT, server): requireHomesEnabled on all 8 homes routes. Residual Low: plan.propertyId unvalidated
- HM-05 fixed (WT): lib/env.ts fails closed; scripts/switch-to-beta.sh; CLARITY_ID null in beta
- HM-06 OPEN (founder): peabudy.com email DNS
- HM-07 fixed (WT): deletion_pending blocked in session + verify-code; delete closes intros/chats/households
- HM-08 partial (WT): per-IP + site-wide caps on emailed codes. Open: IPv6 per-/64 bucketing, staff exempt from site-wide cap, invite-only not server-enforced
- HM-09..HM-21 OPEN (unchanged; see first list in docs/security report)
- HM-22 NEW Low/Medium (research prod): onboarding/profile gender + name echoes not Clarity-masked
- HM-23 NEW Low: IP_HASH_SALT has a public default; not set outside beta script
- HM-24 NEW Low: AuditEvent has no index for the rate-limit counts
- HM-25 NEW Low: switch-to-beta.sh can leave production half-switched if a step fails; no final confirmation

Clean at re-review: npm audit 0; tsc clean; unit tests pass; no secrets/personal emails in commit candidates; docs/security/ ignored; Vercel overwrites x-forwarded-for (not spoofable on Vercel).

Related: [[recurring-weak-spots]]
