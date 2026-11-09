---
name: design-direction-calm-ledger
description: Calm ledger design system — applied 2026-11-09 with the Housemate → Peabudy rename; what is decided and what is still open
metadata:
  type: project
---

The founder approved the "Calm ledger" system on 2026-11-09 and renamed the product **Peabudy**
(peabudy.com). Applied in code: Plus Jakarta Sans + Inter (latin, latin-ext, vietnamese), warm
`ink-*` scale replacing every `stone-*`, ink pill `btn-primary`, green `btn-confirm` only for
agreement acts, semantic `--pb-*` CSS variables, pastel radial-gradient washes, inline icon set in
`components/icons.tsx` (no Lucide dependency). Logo is the **Pod** (two peas, one pod), not
"Two doors". See [[peabudy-brand-mascots]].

**Why:** founder asked for an exciting, mascot-led landing page and onboarding (inspired by a
Letterly onboarding video) while keeping the calm, honest money UX.

**How to apply:** build new screens on these tokens; never reintroduce `stone-*`. Still open:
D2 (the "Demo X/100" chip was removed from Discover cards per DES-01 #18, confirm with the
PM), D4 (bottom nav is now hidden on chat threads and onboarding; confirm with testers), dark mode
not shipped.
