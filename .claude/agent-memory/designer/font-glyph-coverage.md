---
name: font-glyph-coverage
description: Which Google fonts actually carry ₦, Yoruba dot-below letters and tabular figures; next/font subsets Housemate needs
metadata:
  type: project
---

Schibsted Grotesk and Hanken Grotesk (the fonts in use as of Nov 2026) have **no ₦ or Ṣ glyph**, and Hanken has no `tnum`. Fonts with full coverage (₦, Ọ/Ẹ/Ṣ, combining U+0300/0301/0323, tnum) include Plus Jakarta Sans, Inter, Inter Tight, Source Serif 4, Literata, Public Sans, Work Sans and Noto Sans. Manrope, Geist, DM Sans, Figtree, Outfit and Sora fail.

**Why:** Lagos rent is shown in NGN, and many users have Yoruba names. A missing glyph silently falls back to a system font.

**How to apply:** check any proposed font with fontTools against the Google Fonts TTF (fetch the css2 API with a non-browser User-Agent to get the TTF). `next/font` needs `subsets: ["latin","latin-ext","vietnamese"]`: ₦ and Ṣ are in latin-ext, and precomposed Ọ/Ẹ and the combining marks are in vietnamese. See [[design-direction-calm-ledger]].
