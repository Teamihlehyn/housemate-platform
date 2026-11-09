# Peabudy UX plan: beautiful, interactive, very simple

> Status: **proposed** (9 Nov 2026). It depends on the founder approving the design system
> ([`design-system.md`](./design-system.md)). The product-manager's beta launch plan lives in
> `docs/product/`. This plan doesn't change its scope, and any sequencing conflict goes back to
> the PM.

**Goal:** a first-time user in London or Lagos can go from landing to a mutually agreed household
plan without help, feeling calm and in control, on a low-end phone.

**Assumed success metric** (to be confirmed by the PM): the share of new testers who reach an
**agreed household plan (version accepted by both)** in their first session. Supporting metrics
are listed in §6.

---

## Decisions needed before Phase 1

| # | Question | My recommendation | Why it matters |
|---|---|---|---|
| D1 | Approve the "Calm ledger" direction: Plus Jakarta Sans + Inter, ink-pill primary, sage green for agreement, warm neutrals replacing `stone-*` everywhere? | **Yes.** It unifies the landing page's ink/paper style with the signed-in app, and it fixes the missing `₦` glyph. | Touches every screen, so it needs a founder decision |
| D2 | Discover shows the match score as **"Demo X/100"**, but the score is 0–60 and isn't a credibility measure. Remove it? | **Remove the number from cards.** Explain the order in one line and lean on the reasons. If a figure is wanted, use words ("Shares 4 of 6 habits"). | It currently looks like a trust score. That's an honesty issue (§1 of CLAUDE.md). PM to confirm |
| D3 | Pick a logo concept | **1 · Two doors.** It's warm, says "two people, one home", and works at 16 px | Brand, OG images, app icon |
| D4 | Hide the bottom nav inside a chat thread so the composer has room? | **Yes**, with a back button in the thread header | Chat is the most-typed screen on small phones |
| D5 | Add `lucide-react` (dependency) or hand-drawn inline SVG icons? | **`lucide-react`.** It's tree-shaken, ISC-licensed and consistent | A dependency, so the engineer owns it |

---

## Phase 1: Quick wins (about 1 week, low risk, mostly designer)

The aim is to look and read like one product, and fix the accessibility and honesty problems.

| Change | Owner | Notes |
|---|---|---|
| Adopt tokens: merge `tokens.proposed.ts` into `tailwind.config.ts`, paste the CSS variables into `globals.css`, restyle `btn-*`, `card`, `input`, `chip` and `field-error` | Designer | Class names stay the same, so pages restyle without edits |
| Swap fonts in `app/layout.tsx` to Plus Jakarta Sans + Inter with `latin`, `latin-ext` and `vietnamese` subsets | Designer | Fixes `₦` falling back to a system font. Check `Ṣ`, `Ọ` and tone marks render |
| Replace `stone-*` with `ink-*` using the migration table (design-system §13) | Designer | Mechanical, so review screen by screen at 375 px |
| Fix contrast failures: `placeholder:text-stone-400` (2.52:1) and landing `text-ink/40` (2.74:1) → `ink-500` | Designer | |
| Body text from 14 px to 16 px in reading contexts (bios, chat, agreement, intro) | Designer | Mixed-age audience. 16 px inputs also stop iOS zoom |
| Emoji icons → outline icons in `AppNav`, Discover, empty states. Add `aria-label` to icon-only buttons | Designer + **Engineer** (dependency) | |
| Bottom nav: active pill, `aria-current="page"`, unread badge with sr-only text, safe-area padding | Designer | |
| A visible, consistent **Sample tag** (dashed, with icon) everywhere a sample person appears: cards, profile, thread header, household | Designer | Same fixed phrase, made more noticeable |
| Remove "Demo X/100" from match cards (after D2) | Designer | Also update the landing mock ("Demo 80") |
| Add `tabular-nums` to every money figure, and always state the period | Designer | |

**Done when:** typecheck is clean; every signed-in screen has been checked at 375 px and desktop;
keyboard-only pass of nav, onboarding and the intro dialog; spot-checks for contrast; both e2e
suites still pass (they key on text and roles, so check that labels haven't changed).

---

## Phase 2: Core flows (2–3 weeks, designer + engineer)

### 2.1 Onboarding: fewer steps, same consent

Today there are 6 steps: Journey · Destination · Budget & dates · Living habits · About you ·
Publish.

| Simplification | Owner |
|---|---|
| **Merge "About you" into "Publish"**: a review screen with the bio inline and editable. Six steps become five. | Designer (presentation); **engineer** if the step-save calls change |
| **Smart defaults**: preselect the city's currency and period (shown, editable), default the stay range to the common case, and default the gender preference to "Open to anyone" (already the data default) with a plain explanation | Designer; defaults that live in `lib/constants.ts` → **engineer** |
| **Habit questions as radio cards**, one per screen section, with "You'll be matched only with people whose answer you accept" said once, not six times | Designer |
| **Show the payoff on every step**: a live line such as "6 sample housemates fit so far" in research mode, or "Matches use these dates" in beta | **Engineer** (a count endpoint or the existing exclusions data) + designer |
| Progress: "Step 2 of 5 · Destination" plus a segmented bar. Back always keeps what was entered | Designer |
| Never pre-tick consent. Keep consent before the code is consumed | Unchanged (security-sensitive: no change proposed) |

### 2.2 Discover: a calm, finite list

- Match card per design-system §11.6: "Why you match" and "Worth discussing" (differing-but-
  accepted habits become conversation starters, which is good for fairness, P4).
- "Not for me" hides the card for the session with an Undo toast. No red, no reason asked.
- The intro composer becomes a bottom sheet with **three starter prompts** that insert editable
  text ("Hi {name}, I'm also looking in {area} from {month}…"). The character counter explains
  the 30-character minimum *before* send, and the send button stays enabled and explains on
  press. Designer; prompts are client-side copy, with no API change.
- Empty state uses the existing `exclusions.narrowFilters`, with one action ("Adjust my search")
  that deep-links to the right Profile section. **Engineer** if anchors need IDs on Profile.

### 2.3 Messages: safe first contact

- Thread header: name, Sample tag, and a "More" menu with **Report** and **Block** (one tap to
  the menu, one to the action). Today Report sits on the profile, so add it to the thread.
  **Security reviewer** to review the block confirmation copy.
- Pending, failed and retry states for bubbles (design-system §11.7). The money caution becomes
  an inline card with plain advice that also covers Lagos inspection-fee scams.
- System messages for milestones ("You formed a household with Ṣadé. Next: check the
  agreement.") with a deep link. These are client-rendered from existing state where possible;
  otherwise → **engineer**.

### 2.4 Household: the agreement is the hero

- Agreement card per design-system §11.8: big tabular money, a labelled split bar, a status pill,
  and acceptance side by side. For Lagos, show the monthly equivalent and the annual figure.
- **"What changed"** on re-agreement: "Rent: £950 → £1,000 each". Needs the previous version's
  values. **Engineer** to expose the prior version in the household view if it isn't already.
- One "next step" card at the top, driven by `derivedStage` (the copy exists in `household/page.tsx`).
  Everything else collapses into labelled sections (Agreement · Homes · Viewings · Application ·
  Move-in), with the current stage open.
- Version conflict (`409 VERSION_CONFLICT`): "Ben changed this while you were editing. Review
  version 4", with the user's edits kept in a draft. **Engineer** to confirm the client keeps
  the input, following the existing `call()` pattern.

### 2.5 Profile, credibility and settings

- Expanded credibility breakdown (§11.5) on the profile and on your own Profile, with "How to add
  checks" for each missing category, phrased honestly ("Reference checks aren't available yet").
- Privacy controls get plain-language summaries: who sees what, with an example of the public
  card ("This is what others see").

---

## Phase 3: Delight (ongoing, after Phase 2 is validated)

Small, honest moments that confirm progress. No gamification.

| Micro-interaction | Detail | Reduced motion |
|---|---|---|
| Press feedback | Every button scales to `.98` in 100 ms | Colour change only |
| Choice chips and radio cards | 160 ms fill with the tick fading in | Instant |
| Intro sent | The sheet slides down and a toast reads "Intro sent to Amara · we'll tell you when they reply" | Fade only |
| Mutual milestone (household formed, version agreed, moved in) | A 320 ms tick drawn in the status pill, plus one sentence on what's next. No confetti | Static tick |
| Money figures | When a split changes, the number cross-fades (no counting-up animation, which reads as a slot machine) | Instant |
| Skeletons | Shimmer only after 300 ms, to avoid flicker on fast loads | Static fill |
| Pull to refresh in Messages | Optional, if testers ask for it | — |
| Dark mode | Ship the defined tokens after light is stable | — |
| Logo motion | The doors in "Two doors" open slightly on the sign-in success screen (one 400 ms run) | None |

Also in this phase: OG image and app icon from the chosen logo, an illustrated empty-state set
(simple line art in the tint colours, not stock imagery), and printable or shareable PDF styling
for the agreement (**engineer**).

---

## 4. Accessibility plan (WCAG 2.2 AA)

| Area | Action | Phase |
|---|---|---|
| Contrast | Token ramp guarantees ≥ 4.5:1 for text and ≥ 3:1 for controls. Fix the two known failures | 1 |
| Targets | Keep 44 px minimum (2.5.8 asks 24 px; we exceed it). Chips get 44 px hit areas | 1 |
| Focus | 2 px `brand-500` ring with 2 px offset on every interactive element. Focus not obscured by the sticky banner or bottom nav (2.4.11): add `scroll-padding-top`/`-bottom` | 1 |
| Names | `aria-label` on icon-only buttons. Emoji removed from accessible names | 1 |
| Dialogs | Focus trap, Esc, return focus, labelled titles. Convert the intro composer and `ReportDialog` | 2 |
| Errors | `role="alert"` + `aria-describedby` + input kept. Error summary at the top of long forms | 2 |
| Status | Toasts `role="status"`. Chat new-message announcements throttled (polling every 2 s must not spam screen readers) | 2 |
| Motion | Global reduced-motion rule (in `tokens.proposed.ts`). Marquee becomes a static list | 1 |
| Language | Names keep their diacritics. Add `lang` attributes only for non-English UI text (none today) | — |
| Testing | VoiceOver iOS + TalkBack Android pass on the five core screens. Keyboard-only run of the full journey | 2 |

---

## 5. Performance guardrails for low-end phones

- Two variable font files, with subsets loaded only on demand (`next/font` does this).
- No `backdrop-blur`, no blur above 16 px, and animate only opacity and transform.
- Skeletons shaped like the real content to avoid layout shift. Images (future listings) lazy-
  loaded with fixed aspect ratios.
- Keep chat polling as it is, but render new bubbles without re-rendering the whole list
  (**engineer**).

---

## 6. How we'll measure success

There is no analytics product beyond Clarity and the feedback form, so use what exists.

| Metric | Source | Target (proposed, PM to confirm) |
|---|---|---|
| First-session completion to an agreed household plan | Audit events (`household.*`, plan acceptance) per tester | Baseline now, then +25% after Phase 2 |
| Onboarding drop-off by step | Audit or step-save events + Clarity funnels | No step loses more than 15% |
| Time to first intro | Audit timestamps | Median under 6 minutes |
| Intro composer abandonment | Clarity (opened vs sent) | Under 30% |
| Rage clicks and dead clicks on core screens | Clarity | −50% versus the current build |
| Comprehension: "What does the number on a profile mean?" | Moderated test (User Testing Kit) | 4 of 5 testers say "checks completed, not safety" unprompted |
| Perceived safety and calm (1–5) | Feedback form question | ≥ 4.0 median |
| Accessibility defects | Manual audit checklist | Zero AA failures on the five core screens |

Instrumentation of new events → **engineer**, with **security reviewer** sign-off that no
message bodies or private data enter events (CLAUDE.md §2.3).

---

## 7. Who does what

| Work | Designer | Engineer | Security reviewer | PM |
|---|---|---|---|---|
| Tokens, globals, fonts, page restyles | ✔ | review | | |
| Icon dependency | spec | ✔ | | |
| Onboarding step merge, live match count | flow + UI | API/step logic | | scope |
| Intro prompts and composer sheet | ✔ | | | |
| Report/Block in the thread header | UI + copy | wiring if needed | review copy and flow | |
| "What changed" on re-agreement | UI | expose previous version | | |
| Match score removal (D2) | UI | | | **decide** |
| Metrics and events | definitions | implementation | privacy review | targets |

## 8. Risks and open questions

- **Not validated with users.** Every recommendation here is from heuristics and the cited
  research. Phase 1 should be tested in the next research round before Phase 2 goes broad.
- Real test findings may exist that I haven't seen. Please share them, because they could
  reorder Phase 2.
- Plus Jakarta Sans's rendering of stacked Yoruba diacritics (dot-below plus tone mark) needs a
  visual check on Android Chrome and iOS Safari with real names.
- Unifying the visual style changes every screen at once, so the e2e suites and Clarity heatmaps
  should be compared before and after.
