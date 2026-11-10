---
name: invite-only-entry
description: Lagos beta entry design (D15/HM-26/D16): request access, invite landing, busy screen, survey opt-in — decisions and honesty limits
metadata:
  type: project
---

Founder approved on 2026-11-10: invite-only beta in Lagos (launch Fri 13 Nov 2026). Landing CTA
is "Request an invite" in beta only (research/dev keep "Get started"). Survey emails are
consent-only: the opt-in is unticked, in onboarding's last step and Settings, and the copy
promises "About 4 minutes, sent once with at most one reminder", so the survey email says
4 minutes too (the coordinator once asked for "3-minute"; consistency with what people agreed to
won). The busy screen (HM-26) only shows a countdown from Retry-After, never a queue position.

**Why:** strangers + money + Lagos scams: nothing on these screens may imply a place in a queue,
a guarantee of an invite, or safety.
**How to apply:** reuse `components/PublicShell.tsx` for new public pages; keep the invite email
neutral (invites can be ad hoc and unbound to an email). See [[peabudy-brand-mascots]].
