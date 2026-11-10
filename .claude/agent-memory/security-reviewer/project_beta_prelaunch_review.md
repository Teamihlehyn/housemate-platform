---
name: beta-prelaunch-review-2026-11
description: Pre-launch security review for the 11 Nov 2026 beta (Peabudy rename) - finding IDs HM-01..HM-34, status, and threat-model summary
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

Update 2026-11-10 (focused re-review of WT on top of 33f81c0; verdict OK for staging):
- HM-04 residual fixed (WT): propertyId validated outside beta, ignored in beta
- HM-08 fixed (WT): IPv6 /64 buckets, staff exempt from site-wide cap, xact advisory locks. Open decision HM-26
- HM-23 fixed (WT): no IP recorded without a 16+ char salt on Vercel; research script generates salt
- HM-24 fixed (WT): AuditEvent indexes migration
- HM-25 fixed (WT) for switch-to-beta.sh
- ENG-04 checks list reviewed: DTO = category/status/month only; others see verified-only
- HM-26 NEW (product decision, Low/Med): site-wide cap silently returns "sent" to members; recommended honest generic 429 for all, staff code still sent behind it
- HM-27 NEW Medium before beta: switch-to-research.sh (the beta rollback path) sets mode before database, no ERR trap

Update 2026-11-10 (SEC-14: invite-only sign-up, survey email, feedback, legal renderer; WT on top of 8e6add6; verdict OK for staging, no launch blockers in server code). Research mode is retired: prod + staging run beta.
- HM-26 fixed (WT): honest 429 for everyone; staff code still sent. Invite-only also stops refusals counting to the site-wide cap
- HM-27 resolved (WT): switch-to-research.sh now refuses to run; rollback = earlier beta deployment
- HM-13 fixed (WT) for feedback: per-IP signed out, per-member signed in
- HM-28 NEW accepted (pilot): request-code tells a known address whether it has an account (design option A, docs/engineering/invite-only-signup.md). Revisit before London/scale
- HM-29 NEW Low: invite lookups/refusals have per-IP caps only, no site-wide cap or alert; unbound staff codes can't be revoked
- HM-30 NEW Medium (privacy, before ~10 Dec): access requests promised [30]-day retention with no purge; not in /me/export or removed on delete
- HM-31 NEW Low: every staff role (not only admin) can mint unbound invites and read access-request PII
- HM-32 NEW Low: request-code email regex accepts multiple @ and commas (pre-existing)
- HM-33 NEW Low: survey send/eligibility not gated to beta (demo modes mark on-screen-code emails as verified)
- HM-34 NEW hygiene: untracked public/zz-qa.js would ship publicly; email templates still contain [POSTAL ADDRESS]; test uses a real-looking gmail address
- Info: invite codes stored as unsalted SHA-256; Markdown link allowlist lets "//host" through (repo-sourced); feedback DTO returns full userId; survey send mutates its audit row on failure
- Reviewed clean: HMAC unsubscribe tokens (timing-safe, fail closed on Vercel without secret), atomic invite consumption, survey dedupe lock, CSV formula guard, email HTML escaping, Markdown renderer (React text only)

Clean at re-review: npm audit 0; tsc clean; unit tests pass; no secrets/personal emails in commit candidates; docs/security/ ignored; Vercel overwrites x-forwarded-for (not spoofable on Vercel).

Related: [[recurring-weak-spots]]
