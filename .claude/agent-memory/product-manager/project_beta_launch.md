---
name: project-beta-launch
description: Founder decisions for Peabudy's live beta (re-planned 2026-11-10): Lagos-first live launch, staff video ID then Didit, survey opt-in, research mode retired
metadata:
  type: project
---

**Current plan (founder decisions, 2026-11-10).** It supersedes the 9 Nov Option B/C, 11 Nov fast-track and both-cities plan.

- **Research mode is retired.**
  - Production goes to `beta` once. Personas and sample worlds stay in the code, dormant.
  - Staging becomes the permanent beta rehearsal on its own Neon branch, `beta-rehearsal` (ENG-33).
  - `switch-to-research.sh` is retired.
  - Rollback: Vercel Instant Rollback only to earlier *beta* deployments, then the sign-up pause, suspensions, then deployment protection.
- **Lagos first (D21).** London accounts wait with honest copy (`OPEN_CITIES`). Invite a Mainland cluster first: Yaba, Surulere, Gbagada.
- **Identity (D4).** At launch, the staff video check is mandatory.
- **Didit after launch (D22).**
  - Document + liveness + face match only. **No NIN/BVN lookups.**
  - Explicit biometric consent. Store only the result; never images.
  - Didit retention set as short as allowed.
  - `CLAUDE.md` rule 8 becomes "staff or an approved provider" only when ENG-35 ships (target ~2026-11-27).
- **Survey (D16).**
  - An unticked opt-in at sign-in, with a timestamp and version, a Settings toggle and an HMAC unsubscribe link.
  - An admin-only, audited CSV export.
  - Tally Free.
  - The founder sends from the hello@ mailbox, one person per email, for the first ≤50.
- **Sign-up control (D15).** No allowlist. Rely on the identity gate, HM-08 limits and a `SIGNUPS_PAUSED` switch.
- **Launch date (D18).** Fri 2026-11-13, go/no-go Thu 11-12 18:00, fallback Mon 11-16. Still open at that point: D11 (legal risk acceptance), D13 (the name vs Peabody), HM-26.

Background:
- Renamed to **Peabudy** on 2026-11-09. Domain peabudy.com, verified in Resend in the EU region. Code identifiers (housemate-platform, housemate_db) unchanged.
- **Name risk:** "Peabudy" is one letter from Peabody, a large London housing association (F-17).

**Founder update, 2026-11-10 evening** (overrides the bullets above where they conflict):
- **D15 is invite-only, not open sign-up.**
  - Public "request access" form; staff pre-check; invite link tied to the email (`INVITE_REQUIRED` 403 / `INVITE_INVALID` 422).
  - Existing accounts don't need an invite.
- **D17:** a branded survey email sent via a Resend staff action from the updates.peabudy.com subdomain. This replaces the CSV export and mail merge.
- **D11:** accepted. The draft legal text is published, labelled "pending review", with a named reviewer.
- HM-26 approved: an honest busy message, with a playful wait screen.
- Responsive pass for all widths; the priority device is a 360 px low-end Android.
- Deleting the research database needs an explicit founder go-ahead after launch.
- Fri 13 Nov launch is at risk; Mon 16 Nov is likely.
- Open: D13 and D20.

**Approval-first sign-up (2026-11-10, late; spec docs/product/beta/approval-first-signup.md, APPROVED by the founder on 2026-11-10, F1–F4 as recommended: Lagos launch Wed 18 Nov with go/no-go Tue 17 Nov 18:00; the ID call is part of approval; declined applicants can reapply after 30 days; London applications waitlisted):**
- The founder wants sign-up to be an application that staff approve before anyone can sign in.
- Design: create the User as `applicant` after an email OTP, plus an Application table. Answers reuse the real profile and search tables. The profile goes live at activation via the invite code, not at approval.
- Sign-in emails a code only to active members, with an identical response for every address.
- Proposed launch moves to Wed 18 Nov (F1).
- Code finding: the staff approve route sets `phoneVerified` without any phone check.

**Lesson:** don't record a general "I go with your recommendations" as approval of specific decisions. The founder changed D15 and D17 afterwards. List each decision explicitly and get per-item approval.

**Why:** the founder wants real users quickly, a fully tested live site, and feedback through the Feedback button plus a follow-up survey.

**How to apply:**
- Check the README "Live launch plan" in docs/product/beta/ for the latest status before planning further.
- Keep the honesty rules, staff/provider-only identity grants and consent-only survey emails, whatever the pressure on speed.

**Code gaps found on 2026-11-10** (verify before relying on them):
- The feedback dialog says "anonymous" while signed-in feedback stores userId.
- The staff feedback list doesn't show the member.
- Feedback isn't in /me/export.
- Signed-out feedback has no rate limit.
