---
name: invite-only-entry
description: Lagos beta entry is approval-first (10 Nov 2026): /join application, status page, activation, members-only sign-in; honesty limits
metadata:
  type: project
---

Superseded D15's request-access/invite flow on 2026-11-10: founder approved approval-first
sign-up (F1–F4). Joining is an application at `/join` (email code first, then the shared
conversational questions, autosaved per screen), staff approve after a ~10-minute video ID call,
the applicant activates at `/invite/[code]`, and `/signin` is members-only with one identical
neutral message for every address. London is accepted but held (waitlisted). Launch moved to
Wed 18 Nov 2026. Survey opt-in stays unticked, "About 4 minutes, sent once with at most one reminder".

**Why:** strangers + money + Lagos scams; "everyone you see was reviewed by a person" is the
trust promise, and the old split sign-in leaked which emails had accounts (HM-28).
**How to apply:** never imply a queue position, a guaranteed approval, a match or safety on these
screens; declines never show a reason; keep the sign-in message identical for all addresses.
Shared question components live in `components/apply/` (see [[peabudy-brand-mascots]],
[[city-photo-cards]]).
