---
name: recurring-weak-spots
description: Patterns in the Housemate/Peabudy codebase that repeatedly produce security bugs - check these first on any new route or change
metadata:
  type: project
---

Patterns seen in the 2026-11-09 review (see [[beta-prelaunch-review-2026-11]]):

1. **Cross-user checks are re-implemented per route.** Block, sandbox world, verification and gender checks are copied inline, so new routes (and state transitions like intro accept or household create) miss some. Check each new cross-user route for block + world + verification + account status.
2. **Non-atomic read-then-write counters** (OTP attempts, rate limits via count()). Look for `x.attempts + 1` or count-then-create.
3. **Rate limits keyed only on the actor or email**; unauthenticated endpoints (request-code, feedback) have none.
4. **Mode flags fail open**: APP_ENV defaults to a demo mode; anything gated on `DEMO_MODE`/`IS_BETA` should be reviewed for what happens when the env var is missing.
5. **Error ordering creates oracles**: different 404/403/409 responses before the caller's own eligibility check leak facts about the target (existence, private gender compatibility).
6. **Account-status checks are inconsistent**: `deleted`, `deletion_pending`, `suspended` are checked in different places (session, guard, verify-code, matching).
8. **Clarity masking is added per field**, so redesigned screens re-introduce unmasked PII (names echoed in copy, gender radios). Check every new screen that shows or collects personal data.
9. **IP-based limits**: Vercel sets x-forwarded-for (not spoofable there), but IPv6 needs /64 bucketing and site-wide caps become a lockout lever.
10. **Silent-refusal designs leak at the next step**: making step 1 identical is not enough; check that step 2 (code verify, link check) answers identically when step 1 silently did nothing.
11. **Review-then-act without binding**: staff approvals must be tied to the exact data reviewed (lock edits or version-check the subject's data, not only the workflow row).
12. **State checks outside the transaction** in staff actions (subject accountStatus read before the tx) race with user-side transitions.
7. **Free-text into audit** via unvalidated `reason`/`reason_code` fields despite the allow-list rule.

**Why:** these produced most findings in the first pre-launch review.
**How to apply:** use as a checklist on every security review of new or changed routes.
