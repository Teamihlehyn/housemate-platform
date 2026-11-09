# Peabudy design system — "Calm ledger"

> Status: **applied** (9 Nov 2026). The founder approved the direction and renamed the product
> from Peabudy to **Peabudy** (peabudy.com). Live tokens are in `tailwind.config.ts`
> (semantic colours read `--pb-*` CSS variables in `app/globals.css`); fonts load in
> `app/layout.tsx`. Brand, mascot and motion: §14. Conversational onboarding pattern: §15.
> Companion files: [`design-system-preview.html`](./design-system-preview.html) (open in a
> browser), [`ux-plan.md`](./ux-plan.md) (phased plan). [`tokens.proposed.ts`](./tokens.proposed.ts)
> is the historical proposal; the config is the source of truth now.

The direction in one line: **the calm, caring warmth of a wellness app, with the clear,
confident money display of a good banking app.** Lovi for how it feels, Revolut for how money and
progress read. We borrow principles only, not their logos, illustrations, palettes or layouts.

---

## 1. What we borrowed, and what we didn't

What we studied (9 Nov 2026). lovi.care was fetched and its CSS inspected. revolut.com sits
behind a bot check, so we read its served stylesheet tokens plus third-party write-ups of its
public site, which are unofficial ([getdesign.md](https://getdesign.md/design-md/revolut/preview),
[open-design.ai](https://open-design.ai/systems/revolut/)).

| From | Observed | Principle we take | What we do differently |
|---|---|---|---|
| Lovi | Warm off-white canvas (`#f6f5f4`), warm near-black text (`#292824`), very large radii (24/40/48 px), pastel accent tints, one message per section, calm and unhurried copy ("feels like self care"), credentials and method shown openly | **Calm through space and softness.** Very few elements per screen, generous rounding, warm neutrals, and evidence shown rather than claimed. | Our neutrals were already close (`paper #f6f4ef`, `ink #23221e`), so we keep them. Our accent is a sage green, not their lilac/cyan. We show no awards or "trusted by" claims: we show what was checked. |
| Revolut | A display grotesk at weight 500 with tight tracking over an Inter body, near-black pill buttons, almost no shadows (depth comes from surface contrast), pale tinted cards paired with a saturated accent, 300 ms opacity/transform transitions | **Confident clarity.** One big number per card, a pill primary action, flat surfaces, short purposeful motion, tabular figures for money. | No gradients, no dark marketing sections, no "growth" energy. Money is shown to make things fair, not to sell. |

What we deliberately **don't** take: Revolut's urgency and upsell patterns, Lovi's "% fit"
scores on products (we never show a compatibility percentage), and any wellness or medical
language.

---

## 2. Psychology of the product

People are choosing **strangers to live with** and agreeing **money**. That is a high-anxiety,
high-regret decision. The design job is to lower uncertainty, keep things fair and visible, and
never manufacture urgency.

| # | Principle | Evidence | What it means for the design |
|---|---|---|---|
| P1 | **Reduce uncertainty before asking for commitment.** People trust strangers more when they get specific, relevant information. | Abrahao, Parigi, Gupta & Cook (2017, *PNAS*): in an experiment with 8,906 Airbnb users, reputation information raised trust in strangers and offset homophily (preferring people like you) ([PDF](https://web.stanford.edu/~pparigi/PNAS-2017-Abrahao-9848-53.pdf)). | Lead with **concrete facts** (dates, areas, budget, habits) and **what has been checked**. Put explanations next to every number. Never use photos-first layouts that invite judging people on looks or demographics. |
| P2 | **Visual quality and up-front disclosure signal trustworthiness.** | NN/g's four trust factors: design quality, up-front disclosure, comprehensive and current content, connection to the wider web ([NN/g](https://nngroup.com/articles/trustworthy-design/)). | Polish matters: no typos, no broken states, consistent components. Honesty labels ("Sample housemate", "Demo verified") sit in the same visual system as everything else, not hidden in grey small print. |
| P3 | **Avoid the swipe "rejection mind-set".** | Pronk & Denissen (2020, *Social Psychological and Personality Science*): acceptance fell about 27% from the first to the last option as people browsed more profiles ([Tilburg](https://research.tilburguniversity.edu/en/publications/a-rejection-mind-set-choice-overload-in-online-dating/)). | **A short, finite list** (our matching already returns a handful). No swiping, no infinite feed, no "who liked you" teasers. "Pass" is quiet and reversible ("Hidden for this session"). An intro is a written note, not a tap. |
| P4 | **Money and chores are the main conflicts, so make fairness visible.** | UK polls: about 60% have argued about cleaning ([Nationwide, 2019](https://www.nationwide.co.uk/media/news/house-share-from-hell-brits-reveal-lack-of-sharing-leads-to-housemate-squabbles)). Money and bills were the issue people took most seriously (32%), and SpareRoom (2026) reports wage gaps causing problems for 43% of flatmates ([SpareRoom blog](https://blog.spareroom.co.uk/how-wage-gaps-can-spark-friction/), [Property Reporter](https://www.propertyreporter.co.uk/room-rents-rise-30-as-wage-gaps-spark-flatshare-rows.html)). | The agreement card is the hero of the household screen: **big tabular figures**, each person's share in words and numbers, a split bar with labels, the version and who has accepted. "Discuss" topics put habit differences on the table early. |
| P5 | **Scams make people wary, especially in Lagos.** | Lagos coverage describes inspection-fee scams, copied listings and fake agents ([BusinessDay](https://businessday.ng/bd-weekender/article/6-signs-a-lagos-house-agent-might-be-scamming-you/), [Pulse](https://www.pulse.ng/story/how-to-know-if-a-house-agent-in-lagos-is-trying-to-scam-you-2025021312104997876)). | Never ask for money in-product. Keep the money-request caution in chat. Make "no real money moves here" a visible, calm line on money screens. Report and block always one tap away. |
| P6 | **Progress you can see keeps people going, as long as it is honest.** | Nunes & Drèze (2006, *J. Consumer Research*): people given a head start on a reward card completed it more often (34% vs 19%) ([EurekAlert summary](https://www.eurekalert.org/news-releases/904084)). | Show onboarding and household progress as named stages ("Step 2 of 4 · Viewing"). Count steps people have **genuinely** finished, never pre-fill progress artificially. Celebrate each mutual milestone quietly. |
| P7 | **Colour carries meaning, but the effects are context-dependent.** | Elliot & Maier (2014, *Annual Review of Psychology*): colour affects affect and behaviour, but the field is early and effects depend on context ([PubMed](https://pubmed.ncbi.nlm.nih.gov/23808916/)). | Colour is used for **state and wayfinding, never as the only signal**. Red is reserved for destructive actions and errors (never for "pass" or "decline"). Green means "agreed or confirmed", not "safe". |
| P8 | **Respect and autonomy when saying no.** (Design principle, not a cited study.) | — | Declining, withdrawing and leaving a household use neutral wording ("Not for me", "Withdraw intro"), never show the other person a reason, and are never framed as failure. |

**What we will never design:** a "safe", "trusted" or "verified" badge without saying what was
checked; a compatibility percentage; countdowns or "3 people are viewing this"; streaks; guilt
copy on decline ("Are you sure? Ben will be disappointed"); pre-ticked consent.

### How each design lever supports the psychology

| Lever | Choice | Why |
|---|---|---|
| Colour | Warm paper canvas, near-black ink, sage-green brand for agreement, three soft tints (apricot, lilac, sky) for categories | Warm neutrals feel domestic, not clinical. The tints add Lovi-like warmth without becoming signals. |
| Type | Friendly-geometric display (Plus Jakarta Sans) over a high-legibility UI face (Inter) with tabular figures | A warm display face for warmth; a neutral, highly legible face for everything people must read accurately (money, dates, terms). |
| Spacing | 4 px base, generous section gaps (32–40 px), one primary action per screen | Space lowers perceived effort and anxiety (Lovi). Fewer choices per screen also helps (P3). |
| Motion | 120–320 ms, ease-out, opacity and small translate only; no bounce on serious actions | Motion confirms that something happened (Norman's feedback) and never hurries or celebrates risk. |

---

## 3. Design principles

1. **Show what's true.** Every check, sample and demo is labelled with its fixed honesty phrase,
   in the main type size, not hidden.
2. **One screen, one job.** One primary action per screen. Secondary actions are quieter, and
   destructive ones are separated.
3. **Money at a glance.** Amounts are the largest text on money cards, in tabular figures, with
   the period always stated ("/mo", "/yr") and a monthly equivalent for NGN annual rent.
4. **Calm by default.** Warm space and soft corners, nothing urgent, nothing blinking.
5. **Mutual, not one-sided.** Every shared decision shows both people's status side by side.
6. **Everyone can use it.** WCAG 2.2 AA, 44 px targets, 16 px body text, works at 375 px on a
   low-end phone with a slow connection.

---

## 4. Voice and copy

UK English, sentence case, plain words, no exclamation-mark marketing.

| Do | Don't |
|---|---|
| "You both want Hackney" | "Perfect match!" |
| "Checks completed — not a guarantee of safety" | "Verified and safe" |
| "Not for me" / "Withdraw intro" | "Reject" / "Unmatch" |
| "We couldn't send that. Check your connection and try again." | "Oops! Something went wrong" |
| "Waiting for Ben to accept version 3" | "Pending" |
| "£950/mo each · bills split equally" | "£950" (no period or context) |

**Fixed honesty phrases (never paraphrase):** "Demo verified" · "Sample availability" ·
"Checks completed — not a guarantee of safety" · "Demo application accepted; no home is
reserved" · "Sample housemate · replies automatically". The banner text comes from `BANNER`.

**Errors** say what happened and what to do next. **Empty states** say why it's empty and give
one next step. **Buttons** start with a verb ("Send introduction", "Accept version 3").

---

## 5. Colour tokens

All ratios were calculated with the WCAG 2.x relative-luminance formula (script run 9 Nov 2026).
AA requires 4.5:1 for body text, 3:1 for large text (≥ 24 px, or ≥ 18.66 px bold) and 3:1 for UI
component boundaries and focus indicators.

### Neutrals (warm)

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `canvas` (paper) | `#f6f4ef` | Page background | — |
| `surface` | `#ffffff` | Cards, sheets, inputs | — |
| `surface-soft` (cream) | `#faf9f5` | Nested panels, own-row highlights | — |
| `ink-900` (ink) | `#23221e` | Primary text, primary button | 14.48 on canvas · 15.92 on white |
| `ink-700` | `#4a4740` | Secondary text, body copy in cards | 8.43 on canvas |
| `ink-600` | `#5f5b52` | Labels, meta text | 6.15 on canvas · 6.76 on white |
| `ink-500` | `#6b675e` | **Lowest allowed text colour** (captions, timestamps) | 5.13 on canvas · 5.35 on cream · 5.63 on white |
| `ink-400` | `#8f897c` | Input borders, icons (non-text) | 3.48 on white · 3.16 on canvas (≥ 3:1 for UI) |
| `ink-300` | `#b9b3a5` | Disabled borders, decorative only | 2.09 — never text |
| `ink-100` | `#e4e0d6` | Hairlines and dividers (decorative) | 1.32 — never the only boundary of a control |
| `ink-50` | `#efeae0` | Muted fills, "Sample" tag background | `ink-700` on it: 7.73 |

### Brand (sage green: agreement, confirmation, links)

Unchanged from today, so nothing breaks: `50 #f0f7f4 · 100 #dbece4 · 200 #b9d9cd · 300 #8dbfae ·
400 #5e9f8b · 500 #3f8471 · 600 #2f6a5a · 700 #28554a · 800 #22453d · 900 #1e3a33`.

| Pair | Ratio |
|---|---|
| white on `brand-600` (confirm button) | 6.31 |
| white / cream on `brand-700` (own chat bubble) | 8.44 / 8.01 |
| `brand-600` text on canvas / white (links) | 5.74 / 6.31 |
| `brand-800` on `brand-100` (agreed pill) | 8.62 |
| `brand-700` on `brand-100` | 6.88 |
| `brand-500` focus ring on canvas | 4.02 (≥ 3:1 ok) |

### Tints (warmth and categories, never status)

| Tint | 100 (fill) | 500 (dot, illustration) | 800 (text on 100) | Ratio |
|---|---|---|---|---|
| Apricot | `#fbe7d6` | `#e7965f` | `#8a3f14` | 6.25 |
| Lilac | `#ece6fb` | `#9b86e0` | `#4f3794` | 7.49 |
| Sky | `#e1ecfa` | `#5b8fd6` | `#17518f` | 6.74 |

### Semantic

| Role | Fill | Text / icon | Border | Ratio |
|---|---|---|---|---|
| Success / agreed | `brand-100` | `brand-800` | `brand-200` | 8.62 |
| Caution / waiting / needs re-agreement | `#fdf1d8` | `#7a4b00` | `#f0d39a` | 6.62 |
| Danger / error | `#fdecea` | `#9f1d14` (on fill), `#b42318` (on white) | `#f5c2bd` | 6.90 / 6.57 |
| Info | sky-100 | sky-800 | `#c3d7f3` | 6.74 |
| Banner (environment) | `#fef3c7` (amber-100, today's) | `#78350f` (amber-900) | `#fde68a` | 8.15 |

### Current issues found while auditing (fix in Phase 1)

- `placeholder:text-stone-400` on white is **2.52:1**, which fails AA. Use `ink-500` (5.63).
- The landing page's `text-ink/40` on cream is about **2.74:1**, which fails. Use `ink-500`.
- `stone-500` meta text is 4.80:1. It passes, but it's a different (cool) grey family from
  `ink`. Map it to `ink-600`.
- **Glyph gap:** Schibsted Grotesk and Hanken Grotesk have **no `₦` glyph**, and `layout.tsx`
  loads only the `latin` subset. Lagos rent is drawn in a fallback system font today (see §7).
- **Discover shows the match score as "Demo X/100"**, but the match score runs 0–60 and isn't a
  credibility figure. That reads as a misleading trust number. See the match card spec (§11.6)
  and the questions in `ux-plan.md`.

### Dark mode: position

**Not in this release.** Tokens are defined (in `tokens.proposed.ts` and the preview's theme
toggle) so components are built against semantic variables, not raw hex. Ship dark mode only
after the light theme is stable and tested with users. Proposed dark values: canvas `#161512`,
surface `#1f1e1a`, text `#f3f1ea` (16.16 on canvas), muted `#b5b0a4` (7.71 on surface),
brand `#8dbfae` (8.10 on surface), primary button `#8dbfae` with `#161512` text (8.87).

---

## 6. Typography

### Research and shortlist

Requirements: free (Google Fonts via `next/font`), legible at 13–16 px, tabular figures for
money, glyphs for `£` and `₦`, and full Latin coverage for Nigerian names, including Yoruba dot-
below letters (`Ọ ọ Ẹ ẹ Ṣ ṣ`) and the combining tone marks U+0300, U+0301 and U+0323. We
downloaded each font from the Google Fonts API and checked its character map and `tnum`
feature with fontTools (9 Nov 2026).

| Font | `₦` | Ọ Ẹ | Ṣ | Combining marks | `tnum` | Note |
|---|---|---|---|---|---|---|
| **Plus Jakarta Sans** | yes | yes | yes | yes | yes | Friendly geometric, made for display. Its v2.7 changelog notes a naira fix ([GitHub](https://github.com/tokotype/PlusJakartaSans/releases)) |
| **Inter** | yes | yes | yes | yes | yes | Best small-size legibility of the set, 2,849 glyphs |
| Inter Tight | yes | yes | yes | yes | yes | Tighter Inter for headings |
| Source Serif 4 / Literata | yes | yes | yes | yes | yes | Warm serifs, good full coverage |
| Lexend, Nunito Sans, Public Sans, Work Sans, Space Grotesk, Noto Sans | yes | yes | yes | yes | mixed | Full coverage |
| Schibsted Grotesk (current display) | **no** | yes | **no** | partial | yes | Fails ₦ and Ṣ |
| Hanken Grotesk (current body) | **no** | yes | **no** | partial | **no** | Fails ₦, Ṣ and tabular figures |
| Manrope, Geist, Bricolage Grotesque, Mona Sans, DM Sans, Figtree, Outfit, Sora | **no** or partial | mixed | **no** | mixed | mixed | Rejected |

**Pairings considered**

1. **Plus Jakarta Sans (display) + Inter (body). Recommended.** Jakarta's open, rounded
   geometry brings the warmth Lovi has, and at 700–800 with tight tracking it is as confident as
   Revolut's headings. Inter takes everything people must read precisely: money, dates, terms
   and chat. Both are variable fonts, so two files cover every weight.
2. **Inter Tight (display) + Inter (body).** The safest and most "fintech" option, closest to
   Revolut's grotesk-over-Inter pairing. It is very clear but less warm, and a little generic.
3. **Source Serif 4 (display) + Inter (body).** The most editorial and calm, with a "considered
   decision" tone. Serif headlines are harder to do well at small mobile sizes, and the result
   feels less like an app.

**Why one family for numbers:** all money is set in Inter with `font-variant-numeric:
tabular-nums` so columns of rent line up. Hero amounts may use Jakarta, since its figures are
also tabular.

**Loading (for the engineer or designer when approved):** use `Plus_Jakarta_Sans` and `Inter`
from `next/font/google` with `subsets: ["latin", "latin-ext", "vietnamese"]`. `₦` and `Ṣ` live in
**latin-ext**, and the precomposed `Ọ/Ẹ` and combining marks live in the **vietnamese** subset
(we checked Google's `unicode-range` values). Browsers download a subset only when the page uses
it, so London pages pay nothing extra.

### Type scale (mobile → ≥ 768 px)

| Token | Size / line height | Weight | Font | Use |
|---|---|---|---|---|
| `display-xl` | 40/44 → 64/68, tracking −0.035em | 800 | Jakarta | Landing hero only |
| `display` | 32/36 → 44/48, −0.03em | 800 | Jakarta | Section heroes, celebration |
| `h1` | 26/32 → 32/38, −0.02em | 700 | Jakarta | Page title (one per page) |
| `h2` | 20/26 → 24/30, −0.015em | 700 | Jakarta | Card and section titles |
| `h3` | 17/24 | 600 | Inter | Sub-sections, list headings |
| `money-xl` | 36/40 → 44/48, tabular | 700 | Jakarta | Agreement hero amount |
| `money` | 20/26, tabular | 600 | Inter | Inline amounts |
| `body-lg` | 18/28 | 400 | Inter | Lead paragraphs |
| `body` | **16/24** | 400 | Inter | Default body. Up from today's 14 px `text-sm`, for a mixed-age audience |
| `body-sm` | 14/20 | 400–500 | Inter | Meta, secondary lines |
| `caption` | 13/18 | 500 | Inter | Timestamps, helper text. Minimum size for anything people need to read |
| `overline` | 12/16, +0.06em, uppercase | 600 | Inter | Rare labels only. Never for honesty phrases |

---

## 7. Spacing, layout, radii, elevation

**Spacing (4 px base):** `1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 8=32 · 10=40 · 14=56 · 20=80`.
Page gutter is 16 px at 375 px and 24 px from 768 px. Space between cards is 12 px on mobile and
16 px on desktop. Section gap is 32–40 px.

**Layout:** a single column up to 640 px of content (`max-w-xl`) for flows such as onboarding,
chat and the agreement. Discover uses two columns from 768 px. Bottom nav on mobile; fixed
elements sit at `bottom-20 md:bottom-6`.

**Radii**

| Token (Tailwind) | px | Use |
|---|---|---|
| `rounded-tag` | 10 | Small chips inside cards, tags |
| `rounded-field` | 14 | Inputs, small buttons, list rows |
| `rounded-panel` | 20 | Inner panels (money rows) |
| `rounded-card` | 24 | Cards |
| `rounded-sheet` | 32 | Bottom sheets (top corners), hero panels |
| `rounded-full` | 9999 | Buttons, chips, nav indicator |

Named keys are used so Tailwind's default `rounded-lg`/`rounded-xl` keep working during
migration.

**Elevation.** Mostly flat (Revolut), with depth from surface contrast. **No `backdrop-blur`, no
blur above 16 px.**

| Token | Value | Use |
|---|---|---|
| `e0` | none + 1 px `ink-100` border | Default cards on canvas |
| `e1` | `0 1px 2px rgb(35 34 30 / .06)` + border | Raised cards (match card) |
| `e2` | `0 8px 16px -8px rgb(35 34 30 / .18)` | Sheets, toasts, menus |
| `scrim` | `rgb(35 34 30 / .48)`, solid, no blur | Behind dialogs |

---

## 8. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `instant` | 100 ms | linear | Press feedback (colour) |
| `quick` | 160 ms | `cubic-bezier(.2,0,0,1)` | Hover, chip toggle, focus |
| `standard` | 240 ms | `cubic-bezier(.2,0,0,1)` | Cards entering, toast in, tab change |
| `gentle` | 320 ms | `cubic-bezier(.3,0,0,1)` | Sheets, step transitions, milestone tick |

Rules: animate **opacity and transform only** (cheap on low-end phones). Translate distances
are 4–12 px. Press is `scale(.98)`. No bounce or spring on money or safety actions. A milestone
(household formed, version agreed, moved in) gets one gentle tick-draw and a short line of copy,
with no confetti. Skeleton shimmer is the only looping motion.

**Reduced motion** (`prefers-reduced-motion: reduce`): all transforms are removed; fades stay at
≤ 120 ms or are dropped; shimmer becomes a static fill; marquees stop and show as a wrapped
list; auto-scrolling chat jumps instead of smooth-scrolling.

---

## 9. Iconography

Replace emoji-as-icons (`🔍 💬 🏠 👤 🔔 💷 📅`) with **one outline icon set: Lucide** (ISC
licence), 24 px grid, 1.75 stroke, drawn at 20 px in UI and 24 px in the nav. Emoji render
differently on every phone, carry tone we don't control, and screen readers read them out
("magnifying glass tilted left"). Every icon-only button gets an `aria-label`. Decorative icons
get `aria-hidden="true"`. Emoji stay only in what people write themselves.

Adding `lucide-react` is a dependency, so it goes to the engineer. The alternative is inline SVGs
in `components/icons.tsx` with no dependency.

---

## 10. Logo

**Chosen: the Pod** (replaces the earlier "Two doors" recommendation, which no longer fits the
name). Two peas in one open pod: two housemates, one home. See §14.

- **Mark:** sage `brand-600` rounded tile (rx 18/64), an open pod in `brand-100`, two peas in
  `pea-400` with a `pea-500` shade, and tiny faces. Faces are removed in `app/icon.svg` (16 px).
- **Wordmark:** lowercase `peabudy`, a custom monoline drawn from circles and stems (x-height 40,
  stroke 9, round caps). It is geometry, not a font, so it renders the same everywhere and needs
  no outlining. Paths: `WORDMARK_PATHS` in `components/brand/Logo.tsx`.
- **Files:** `public/peabudy-logo.svg` (ink), `public/peabudy-logo-light.svg` (cream, for dark
  backgrounds), `public/peabudy-mark.svg`, `public/peabudy-wordmark.svg`, `app/icon.svg`;
  touch icon and link preview from `components/brand/socialImage.tsx`.
- **Clear space:** half the mark's width on every side. **Minimum:** mark 16 px; lockup 96 px wide.
- Don't recolour the peas, add a shield or tick to the mark, or put the faces on anything that
  implies a person was checked. Run a trademark search before final adoption.

---

## 11. Components

Each spec lists anatomy, tokens and **every state**. The class names are the proposed
`globals.css` names.

### 11.1 Buttons

| Variant | Class | Default | Hover | Active | Focus-visible | Disabled | Loading |
|---|---|---|---|---|---|---|---|
| Primary | `btn-primary` | `ink-900` fill, `cream` text, pill, 48 px tall (44 px compact) | `#000` | scale .98 | 2 px `brand-500` ring + 2 px offset | `ink-300` fill, `ink-700` text, still focusable and explains why on click (§9 of CLAUDE.md) | Spinner plus a verb ("Sending…"), width locked, `aria-busy` |
| Confirm | `btn-confirm` | `brand-600`, white text | `brand-700` | .98 | ring | as above | as above |
| Secondary | `btn-secondary` | white, 1 px `ink-400` border, `ink-900` text | `ink-50` fill | .98 | ring | `ink-300` border | as above |
| Ghost | `btn-ghost` | transparent, `ink-700` | `ink-50` | .98 | ring | `ink-500` | — |
| Danger | `btn-danger` | white, `#f5c2bd` border, `#b42318` text | `#fdecea` | .98 | ring in `#b42318` | — | — |
| Icon | `btn-icon` | 44×44 circle, ghost | `ink-50` | .98 | ring | — | — |

The **primary** action is ink (neutral and confident). **Confirm** green is used only for
agreement acts (accept a version, confirm move-in), so green comes to mean "we agree".
Use one primary or confirm button per view.

### 11.2 Inputs, labels, errors

- `input`: 48 px tall, `rounded-field`, white, 1 px `ink-400` border (3.48:1), 16 px text (which also
  stops iOS zooming on focus), placeholder in `ink-500`.
- States: **focus**: 2 px `brand-600` border and ring · **filled**: unchanged · **error**:
  `#b42318` border, an icon and message below (`field-error`, `role="alert"`, linked by
  `aria-describedby`), and the input keeps its value · **disabled**: `ink-50` fill, `ink-500`
  text · **read-only**: no border, `surface-soft`.
- `label` sits above the field in 14/20 at weight 600 in `ink-700`. Helper text is in `caption`
  `ink-600`. A character counter sits on the right, in `ink-500`, and turns `#7a4b00` near the
  limit.
- Segmented choices (habits, notice, bills) are **radio cards**: 48 px rows with a visible
  radio and the label, never a colour-only selection.

### 11.3 Chips

| Kind | Look | States |
|---|---|---|
| Filter or choice chip | 36 px visual inside a 44 px hit area, pill, white with `ink-400` border | Selected: `ink-900` fill, cream text **and** a check icon · hover `ink-50` · focus ring · disabled `ink-300` |
| Info chip (area, habit) | Tint-100 fill, tint-800 text | Static |
| **Sample tag** | `ink-50` fill, dashed 1 px `ink-400` border, `ink-700` text, beaker icon: "Sample housemate · replies automatically" | Static, always visible next to the name |
| **Demo verified** | White, 1 px `brand-200` border, `brand-800` text, check icon, "Demo verified" | Static |
| Status pill | Semantic fill/text: "Agreed by both", "Waiting for Ben", "Needs re-agreement" | Static |

### 11.4 Cards

`card`: white, `rounded-card`, 1 px `ink-100` border, `e0`, 20 px padding (24 px on desktop).
`card-soft`: `surface-soft`, no border, for nested content. Interactive cards (the whole card is
a link) get hover `e1`, a `brand-500` focus ring on the card, and press `.99`.

### 11.5 Credibility badge

- **Compact** (lists and headers): an outline chip showing a checklist icon and "Demo checks 60/100",
  linking to the breakdown. Neutral `ink` colours, **never** green or a shield, because the
  number is evidence, not safety.
- **Expanded** (profile): a title "Checks completed — not a guarantee of safety", then a row per
  category (Identity 40 · Email 10 · Phone 10 · Reference 20 · Additional evidence 20) with a
  status in words ("Demo verified" or "Not checked"), points earned, and a hollow or filled
  circle as the icon, so the meaning never relies on colour.
- States: loading (skeleton rows) · no checks ("No checks yet" plus what that means) · beta
  pending ("Identity check pending" in caution style).

### 11.6 Match card (Discover)

Anatomy, top to bottom: initials avatar (tint-100 background chosen deterministically, not by
gender) · name and the **Sample tag** where it applies · areas · one fact row (budget with
period, move-in window) in `body-sm` with icons · **"Why you match"**, up to 3 reasons with check
icons · **"Worth discussing"**, differing-but-accepted habits in apricot info chips · actions:
`Introduce` (primary), `View profile` (secondary), `Not for me` (ghost, quiet, reversible).

- **No number on the card.** The ranking is explained by a line at the top of the list ("Sorted
  by shared dates, areas and habits"). If the founder wants a figure kept, label it in words
  ("Shares 4 of 6 habits"), never "/100" and never as a percentage.
- States: default · hover (`e1`) · focus within · introduced ("Intro sent · waiting for reply",
  card turns `surface-soft`, the primary action becomes "View intro") · hidden ("Hidden for this
  session · Undo" toast) · loading skeleton · empty list (§11.11).

### 11.7 Chat bubble

- Mine: right-aligned, `brand-700` fill, cream text, `rounded-card` with a 6 px corner on the tail side.
  Theirs: left-aligned, white, `ink-100` border, `ink-900` text.
- Max width 80%. 16 px text. Time and status in `caption` below the bubble: "Sent", "Read" (if
  that ever exists), **"Sending…"** (pending, 70% opacity), **"Not sent · Try again"** (a danger
  text button with 44 px target).
- System messages are centred, `ink-600` on `ink-50`: "Ben accepted your intro", "This is a
  sample housemate who replies automatically."
- **Money caution:** an inline caution card under the triggering message: "Never send money
  before you've viewed a home and signed a real tenancy. Peabudy never asks you to pay."
- Thread header: name, Sample tag, and a "More" menu containing **Report** and **Block**, always
  reachable within one tap. Bubble bodies keep `data-clarity-mask="true"`.

### 11.8 Agreement / money summary card

The hero of the household screen, Revolut-style money at a glance.

- Header: "Household agreement · Version 3", plus a status pill ("Agreed by both" / "Waiting for
  Ben" / "Needs re-agreement").
- **Hero amount:** each person's monthly share in `money-xl` with "/mo each". When shares differ,
  show one row per person. For Lagos: "₦200,000/mo equivalent" with "₦2,400,000/yr" beneath it.
- **Split bar:** a horizontal bar with two segments, **with name and percentage labels in text**
  under it (never colour alone).
- Rows: Bills ("Split equally" / "Same as rent split") · Notice ("4 weeks if someone leaves") ·
  Stay length · Notes.
- Acceptance strip: each member's avatar with "Accepted v3" or "Not yet". The current user's
  action is `Accept version 3` (confirm) or `Propose a change` (secondary).
- Footer line: "No money moves through Peabudy."
- States: proposed · agreed · needs re-agreement (caution border with a diff hint: "Rent changed
  from £950 to £1,000") · version conflict ("Ben changed this while you were editing. Review
  version 4.") · loading.

### 11.9 Progress stepper

- **Onboarding:** "Step 2 of 6 · Destination" in text, plus a segmented bar. Completed segments
  are `ink-900`, the current one is `brand-500`, upcoming ones are `ink-100`. The list has
  `aria-label="Progress"` and the current item `aria-current="step"`.
- **Household stages:** Planning → Viewing → Application → Move-in, as labelled dots on a line.
  Done = filled with a check, current = ring with the label in bold, upcoming = hollow.
  `needs_reagreement` shows the line paused at the current stage with a caution pill. Progress
  never moves backwards silently.

### 11.10 Bottom nav

64 px plus `env(safe-area-inset-bottom)`, white, top hairline. Four items, each a 24 px icon over
a 12 px label (labels are always shown). The active item gets an `ink-50` pill behind the icon,
`ink-900` text and `aria-current="page"`. Inactive items are `ink-600`. Unread count badge:
`#b42318` with white text, plus sr-only text ("3 unread"). No blur.

### 11.11 Empty, loading, error, offline

- **Loading:** skeletons shaped like the real content, in `ink-50` with shimmer (static under
  reduced motion). After 8 s add "Still loading — slow connection?" with Retry.
- **Empty:** a 48 px outline icon in a tint-100 circle, an `h2` title, one sentence of why, and
  one action. Discover example: "No one fits all your essentials yet" · "Your narrowest filters:
  move-in dates, budget." · `Adjust my search`.
- **Error (page):** "We couldn't load your matches." · what to try · `Try again` (keeping
  context). **Error (inline):** `field-error` under the field.
- **Offline:** a slim caution bar under the header ("You're offline. We'll retry when you're
  back."). Composer messages queue as "Sending…".

### 11.12 Dialogs and sheets

On mobile these are a **bottom sheet** (`rounded-sheet` top corners, drag handle, max 90vh, content
scrolls inside). On desktop they are centred at 480 px. `role="dialog" aria-modal="true"`, a
title in `aria-labelledby`, focus moved to the first field, focus trapped, Esc and the scrim
close it (unless there's unsaved input, which asks "Discard your intro?"), and focus returns to
the trigger. Actions sit at the bottom: primary right on desktop, full-width stack on mobile with
the primary on top.

### 11.13 Toasts

Shown above the bottom nav (`bottom-20 md:bottom-6`), `ink-900` fill with cream text, `rounded-panel`,
`e2`. Use `role="status"` for success and info, `role="alert"` for errors. One at a time.
Success toasts auto-dismiss after 5 s (paused on hover or focus). Errors persist until
dismissed. An optional action ("Undo") gets a 44 px target.

---

## 12. Do and don't

| Do | Don't |
|---|---|
| Put the honesty phrase beside the thing it describes | Put "Demo" in a tooltip or footnote |
| Show both people's acceptance state side by side | Show only "You accepted" |
| Use icons with labels in the nav | Use emoji as icons |
| Use tabular figures and a period for money (`£950/mo`) | Write "£950" alone or mix monthly and annual without saying so |
| Make "Not for me" quiet and reversible | Make decline red or ask for a reason |
| Keep buttons enabled and explain on submit | Grey out a button with no reason given |
| Use flat surfaces and hairlines | Use `backdrop-blur` or large blurred shadows |

---

## 13. Migration table (current → proposed)

| Current | Proposed | Notes |
|---|---|---|
| `font-display` = Schibsted Grotesk | `font-display` = Plus Jakarta Sans | Same utility name. Glyph fix for `₦`/`Ṣ` |
| `font-sans` = Hanken Grotesk | `font-sans` = Inter | Add `tabular-nums` to money via the `.num` utility |
| `next/font` `subsets: ["latin"]` | `["latin", "latin-ext", "vietnamese"]` | Needed for `₦`, `Ṣ`, `Ọ`, tone marks |
| `bg-paper` / `bg-stone-50` page | `bg-canvas` (`#f6f4ef`) | `paper` is kept as an alias |
| `text-stone-900`, `text-ink` | `text-ink` (`ink-900`) | |
| `text-stone-700` / `-600` | `text-ink-700` / `text-ink-600` | Warm greys replace cool stone |
| `text-stone-500` / `-400`, `text-ink/40`–`/60` | `text-ink-500` (minimum for text) | Fixes 2.5–2.7:1 failures |
| `border-stone-200` / `-100` | `border-ink-100` | Decorative |
| `border-stone-300` (inputs) | `border-ink-400` | Meets 3:1 for controls |
| `rounded-lg` (buttons) | `rounded-full` | Pill buttons everywhere |
| `rounded-xl` (cards) | `rounded-card` (24 px) | |
| `shadow-sm` on `.card` | none (border only), `shadow-e1` on raised cards | |
| `btn-primary` (green) | `btn-primary` (ink) + new `btn-confirm` (green) | Review each green CTA: keep green only for agreement acts |
| `btn-secondary` / `btn-ghost` / `btn-danger` | Same names, new tokens | |
| `chip bg-brand-100 text-brand-800` | `chip-status-success` | |
| `chip bg-stone-100 text-stone-500` (sample) | `chip-sample` | Dashed border and icon, more visible |
| `bg-amber-50 border-amber-200 text-amber-800/900` | `bg-caution-50 border-caution-200 text-caution-800` | |
| `text-red-600` (`field-error`) | `text-danger-600` (`#b42318`) | Adds an icon |
| `animate-pulse rounded bg-stone-200` | `skeleton` (`ink-50` + shimmer) | Static under reduced motion |
| Emoji icons in `AppNav`, Discover, empty states | Lucide outline icons | Dependency → engineer |
| `animate-marquee` | Unchanged | Already stops under reduced motion |
| Match card "Demo {score}/100" | Removed, replaced by reasons | Needs a founder or PM decision (`ux-plan.md`) |


---

## 14. Peabudy brand: mascots, colour and motion

**Name and idea.** "Two peas in a pod": two people who fit, one home. The tone is warm and a bit
playful in moments of progress, and stays plain and calm for money and safety.

**Mascots: Pea and Bud** (`components/brand/Pea.tsx`). Round peas with two eyes, cheeks and a
mouth. Moods: `sleep`, `awake`, `happy`, `wow`, `wink`. Tones: `pea`, `fresh`, `sage`, plus
`apricot`, `lilac`, `sky` for variety. Pure SVG with no gradients or filters, so they're cheap on
low-end phones; decorative (`aria-hidden`) unless given a `label`.

Rules:
- Mascots **celebrate progress the person made** (a question answered, a profile published).
  They never stand in for a person, never signal safety, verification or compatibility, and never
  appear on report, block or money-dispute flows.
- Anything a mascot says must be true ("Every match tells you why. No % scores.").
- No counts or "people waiting" unless they come from real data.

**Colour additions.** `pea-50…700` (mascot greens, illustration only, never text on light
backgrounds). Pastel washes `.bg-pastel` / `.bg-pastel-soft` are layered `radial-gradient`s on
`paper`: no blur filters, no `backdrop-blur`.

**Motion additions** (`tailwind.config.ts`): `bob` (3.2 s / 4.4 s, 6 px), `pop-in` (420 ms),
`wiggle` (520 ms), `blink` (4.8 s). Opacity and transform only. Under
`prefers-reduced-motion: reduce` every loop stops and other animations finish in 1 ms; the
landing page's eye-follow is off.

**Fonts applied.** Plus Jakarta Sans (display, 500–800) and Inter (body) with
`latin`, `latin-ext` and `vietnamese` subsets, so ₦, Ṣ, Ọ/Ẹ and tone marks render in-font.

**Contrast fixes applied.** Placeholders are `ink-500` (5.63:1 on white); every `stone-*` grey
was mapped to the `ink-*` scale (`stone-400/500` text became `ink-500/600`); input borders are
`ink-400` (3.48:1); pill buttons, 44 px minimum targets, and `btn-confirm` (green) only for
agreement acts (accept a version, confirm a viewing, consent to the application, confirm move-in).

## 15. Pattern: conversational flow (onboarding)

Borrowed patterns (not art or layout) from a mascot-led onboarding reference:

| Element | Spec |
|---|---|
| Top row | Back (hidden on the first screen) · "Section · n of 18" · Skip (only where the field is optional and empty: address; "open to anyone") |
| Progress | Five section segments: done `ink`, current `pea-500`, upcoming `ink-100` |
| Mascot line | Pea (52 px) and a white speech bubble. Personal once the name is known |
| Question | One `h1` per screen, focusable (`tabIndex=-1`); focus moves to it on every step |
| Input | Radio rows (52 px, visible radio), choice chips (44 px, tick + fill), money inputs with currency prefix, month steppers |
| Reassurance | Lock icon (private: gender, preference, address) or eye icon (shown to matches: name, budget, bio), in `ink-700` |
| Live reaction | Name: a "Hello, my name is" tag that fills letter by letter. Habits: a pod of six sleeping peas, one wakes per answered habit, with an "n of 6 peas awake" pill (counts the person's own answers, not other people) |
| Dealbreakers | Each habit asks "what you do" then "who could you live with?"; a live line says "Flexible" or "Dealbreaker: you won't be matched with people who say …" |
| CTA | Sticky black pill, full width on mobile, above the safe area. Enter submits |
| Errors | Inline under the field (`role="alert"`); server field errors jump back to the screen that owns the field |
| Payoff | "Your profile is ready, {name}" with Demo checks and the fixed honesty line, then the first three real matches from `/recommendations` ("n people fit right now", sample label in research). Empty state if none |

The data contract is unchanged: `PATCH /me/profile` (name, journey, bio), `PATCH /me/search` in
the same three groups as before (place; budget, dates and stay; gender, preference and habits),
then `POST /me/search/publish`. A live "people fit so far" count is **not** shown during
onboarding because no endpoint returns one before publishing.
