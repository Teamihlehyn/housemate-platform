---
name: peabudy-brand-mascots
description: Rules for Peabudy's pea mascots (Pea and Bud) and playful motion, so delight never undermines honesty
metadata:
  type: project
---

Mascots Pea and Bud (`components/brand/Pea.tsx`) celebrate progress the person made: a question
answered, a profile published. They must never stand in for a real person, signal safety,
verification or compatibility, or appear in report, block or money-dispute flows. Anything they
say must be true. Counts shown near them ("n of 6 peas awake") count the person's own answers,
never other people, unless backed by a real API.

**Why:** the founder wants Letterly-style delight, but Peabudy's core principle is honesty, and
cute UI near trust signals reads as reassurance we can't give.

**How to apply:** when adding mascot moments, check the copy against what the API actually
returns. A pre-publish "people fit so far" count was deliberately left out (no endpoint). Motion is
opacity/transform only and stops under reduced motion. Screenshots from the hidden browser pane
freeze CSS animations at frame 0, so verify animated state with JS, not screenshots. See
[[design-direction-calm-ledger]].
