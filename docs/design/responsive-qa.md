# Responsive QA (DES-19)

Run 10 Nov 2026 by the designer agent against the local dev server in **beta** mode
(`housemate-beta`), with a seeded local user, a local verifier for `/staff`, and a fresh local
account for `/onboarding`. This is browser emulation, not real devices: the real-phone pass
(Tecno/Infinix at 360 px, then an iPhone) is still the founder's T4.

## How it was measured

Each page was loaded in a same-origin iframe at the exact width × height, then a script checked:

- **Overflow:** `scrollWidth` > width, and any visible element past either edge that isn't inside
  a scrolling or clipping container.
- **Targets:** every link, button, input, select and tab ≥ 44 px tall (inline links inside a
  sentence are exempt under WCAG 2.5.8; checkboxes are measured by their whole label).
- **Inputs:** computed font size ≥ 16 px (stops iOS zoom on focus).
- **Covered controls:** `elementFromPoint` at the centre and both ends of every control, at the
  top of the page and scrolled to the end. "@end" (the resting position for the last action) is a
  fail. "@top" means a control that is below the fold sits under the bottom nav or the floating
  Feedback pill until you scroll; that is expected and is listed as a note, not a fail.

Not measurable this way: safe-area insets (no notch in emulation; checked by code review instead),
the on-screen keyboard, and real scrolling performance.

## Results

✓ = pass. Notes are listed under the table. "—" = not run at that size.

| Page | 320×568 | 360×740 | 375×812 | 390×844 | 414×896 | 430×932 | 844×390 (landscape) | 768×1024 | 820×1180 | 1024×768 | 1280×800 | 1440×900 | 1920×1080 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Landing `/` | ✓ | ✓ | ✓ (fixed 1) | ✓ | ✓ | ✓ | ✓ (fixed 2) | ✓ (fixed 2) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/request-access` (retired 10 Nov: now redirects to `/join`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/invite/[code]` (invalid; valid checked visually at 375) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/signin` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/signin` busy state (HM-26) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/onboarding` (first screen) | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — |
| `/discover` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (fixed 3) | ✓ (fixed 3) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/members/[id]` | ✓ (fixed 4) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (fixed 3, 5) | ✓ (fixed 3) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/messages` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (fixed 3) | ✓ (fixed 3) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/messages/[id]` (chat) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (fixed 3) | ✓ (fixed 3) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/household` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (fixed 3) | ✓ (fixed 3) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/profile` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (fixed 3) | ✓ (fixed 3) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/settings` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (fixed 3) | ✓ (fixed 3) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/notifications` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (fixed 3) | ✓ (fixed 3) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/staff` ID checks + Access requests | ✓ | ✓ | — | ✓ | — | — | ✓ | ✓ | — | — | — | ✓ | — |
| `/safety` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/privacy` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/terms` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/unsubscribe` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Fixed in this pass

1. **Landing nav and footer links were 40 px tall.** Now `min-h-[44px]` (`app/page.tsx`).
2. **The Feedback pill sat on the landing footer links** at the end of the page. The footer now
   ends with a 64 px spacer (plus the home-bar inset).
3. **Signed-in top bar overflowed at 768–1023 px** (page 851 px wide at 768 and 844): the desktop
   nav, Feedback, the bell, the name and Sign out didn't fit. The name now hides from 768 to
   1023 px and the nav pills are 12 px narrower there (`components/AppNav.tsx`).
4. **Profile page (`/members/[id]`) actions overflowed at 320 px** (Block was off-screen). The row now wraps: "Send
   introduction" takes the full width, Report and Block share the next row
   (`app/(app)/members/[id]/page.tsx`).
5. **The Feedback pill covered Block on the profile page (`/members/[id]`) in landscape** (no bottom nav from
   768 px, and no bottom padding). The signed-in layout now has `md:pb-20`
   (`app/(app)/layout.tsx`).
6. **The Feedback pill ignored the home bar** and sat 80 px up on public pages that have no
   bottom nav. It now sits 16 px above the home bar on public pages and 76 px above it (clearing
   the 60 px nav) in the app, and respects the right inset in landscape
   (`components/ResearchTools.tsx`).
7. **Settings rows squeezed the button beside long descriptions at 320 px.** Rows stack on
   phones and sit side by side from 640 px.

Chat at 375 px: Report and Block are fully visible; the Feedback pill is hidden on chat threads
(screenshot taken). The earlier "Block half covered" report no longer reproduces.

## Notes (not fails)

- **"@top" overlaps** (expected, cleared by scrolling): on every phone width, controls below the
  fold start under the bottom nav (Discover cards, Settings rows) or the Feedback pill (request
  form fields, the sign-in "Request one" link). Each one clears when scrolled; none is covered at
  the end of the page.
- **Safe areas:** public pages (`PublicShell`, sign-in) pad left/right with
  `env(safe-area-inset-*)` and the bottom with the home-bar inset. The bottom nav, chat composer
  and onboarding CTA already used `env(safe-area-inset-bottom)`. `viewport-fit=cover` is set in
  the root layout.
- **Readable width on large screens:** public forms are `max-w-xl`, the app is `max-w-5xl`, chat
  is `max-w-2xl` from 768 px. Nothing stretches edge to edge at 1920.
- **Tablets:** the bottom nav shows below 768 px; from 768 px the top bar shows the full nav.

## Not verified (say so in the go/no-go)

- **Onboarding steps 2–18 and the "Ready to go live?" screen with the survey checkbox** were
  not walked at every width (only the first screen was measured). The checkbox uses the same
  markup as the Settings one, which passed. Walk them on a real 360 px Android in T4.
- **The on-screen keyboard in chat.** The thread uses a fixed container on phones and `100dvh`
  from 768 px. On Android Chrome the keyboard resizes the layout by default; on iOS Safari the
  fixed composer can sit behind the keyboard. Recommendation for the engineer (root layout is
  outside the designer's files): add `interactiveWidget: "resizes-content"` to the `viewport`
  export in `app/layout.tsx`, then test on an iPhone.
- **Real devices, Slow 3G and page weight (T4c).**

## Requests for the engineer (files the designer doesn't own)

- `/staff` Access requests tab (`app/(app)/staff/AccessRequests.tsx`), at 360 px: no overflow or
  small targets, but (a) the tab row scrolls sideways with no visible cue that "Feedback and
  reports" and "Audit" are there (add a right-edge fade or let tabs wrap); (b) the move month
  shows raw "2027-01" (format as "Jan 2027", and "Not sure yet" for `not_sure`); (c) the status
  chip says "pending" in lower case (use "Pending", sentence case); (d) "Asked 10/11/2026, 10:58"
  is ambiguous across UK/US readers (use "10 Nov, 10:58").
- `/privacy`, `/terms`: no layout faults at any width.

---

## Approval-first pages (DES-20/21/24), 10 Nov 2026

Same iframe method, against `housemate-beta-e2e` (beta mode, local `housemate_e2e_beta` DB, a
fake mail server on :8025 so the emailed codes could be read). `/profile` and `/onboarding` were
checked against `housemate-research` with a demo persona (activation needs a staff approval, and
local staff now needs `ADMIN_EMAILS`, so a beta user couldn't be created this round).

| Page / state | 320 | 360 | 390 | 430 | 768 | 1280 |
|---|---|---|---|---|---|---|
| Landing `/` (beta CTAs: Sign in · Apply to join) | ✓ | ✓ | — | ✓ | — | ✓ |
| `/join` email step | ✓ | ✓ | — | ✓ | — | ✓ |
| `/join` code step | — | ✓ visual | — | — | — | — |
| `/join` city step (photo cards) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/join` steps 4–17 and review | — | walked at 360 (all screens, autosave "Saved" each time) | — | — | — | — |
| `/join` "Application received" | — | ✓ visual | — | — | — | — |
| `/join/status` draft | ✓ | ✓ | — | ✓ | ✓ | — |
| `/join/status` submitted (session, with Manage) / magic link (read-only) / withdrawn | — | ✓ visual + text | — | — | — | — |
| `/signin` (approved users only, neutral message after send) | ✓ | ✓ | — | ✓ | — | ✓ |
| `/invite/[code]` invalid | ✓ | ✓ | — | ✓ | ✓ | — |
| `/profile` section editors (research persona) | — | ✓ visual, saved a budget change | — | — | — | — |
| `/onboarding` → `/profile` redirect for a published user; fresh account still onboards | — | ✓ | — | — | — | — |

No overflow, no off-screen controls, no input under 16 px. The only sub-44 px hits are inline
"privacy notice" / "Apply to join" links inside a sentence (exempt under WCAG 2.5.8).

**Not verified:** `/invite/[code]` valid → code → Discover (needs an approved application; the
engineer's e2e covers it), `/join/status` approved, call booked, waitlisted and declined (render
from one `view()` table; checked by code, not in the browser), the `/join` busy (HM-26) and
paused states, real devices, Slow 3G. Under reduced motion the city card's scale-up is
`motion-safe:` only, so it doesn't apply.

---

## Usability round 1 fixes (DES-25 to DES-33), 21 Nov 2026

The iframe sweep no longer works: `next.config.ts` now sends `X-Frame-Options: DENY` and
`frame-ancestors 'none'` (SEC-15), so every check below resized the tab itself and measured in
the page. Landing checked in `housemate-beta`; in-app pages in `housemate-research` with a demo
persona (a beta user needs a staff approval through the new password-protected back office).

**DES-27 hero: "Apply to join" visible without scrolling**

| Size | CTA bottom edge | Visible on load | Sideways overflow |
|---|---|---|---|
| 320 × 568 | 363 px | ✓ | none |
| 360 × 740 | 363 px | ✓ | none |
| 390 × 844 | 327 px | ✓ | none |
| 430 × 932 | 327 px | ✓ | none |
| 768 × 1024 | 669 px | ✓ | none |
| 1280 × 800 | in the first screen (screenshot) | ✓ | none |

| Page / state | 320 | 360 | 390 | 430 | 768 | 1280 |
|---|---|---|---|---|---|---|
| How it works, step 4 (₦ example) | ✓ (fixed: "a year each" no longer splits) | — | — | — | — | — |
| Discover: Messages badge (header + bottom nav), "New message" card link, search chips | — | ✓ visual | — | — | — | — |
| Discover: edit sheet (areas + budget), save → "Saved. 6 people fit now.", focus back on Edit | — | ✓ | — | — | — | — |
| `/join/status` submitted with "Better first matches" card | — | ✓ visual | — | — | — | — |
| `/join/better` deal-breakers: chips + exclusive "I have no deal-breakers" | — | ✓ (exclusivity checked by script) | — | — | — | — |

**Not verified in the browser:** the approved status screen with Resend invitation (needs a staff
approval), the household "Proposal sent / received" states (sample housemates accept instantly
in research mode), the Discover empty state (research mode tops up the sample world, so it never
empties), tablet/desktop for the in-app changes, real devices.

**DES-27 rework (founder direction, same day): "Find flatmates in Lagos"**

| Size | CTA bottom edge | Visible on load | Overflow |
|---|---|---|---|
| 320 × 568 | ≈ 330 px (from the screenshot) | ✓ | none |
| 360 × 740 | 331 px | ✓ | none |
| 390 × 844 | 331 px | ✓ | none |
| 430 × 932 | 331 px | ✓ | none |
| 768 × 1024 | 513 px | ✓ | none |
| 1280 × 800 | 468 px | ✓ | none |

Five-second check: the headline, "find flatmates" and Apply to join are all in the first screen
at every size above. The section nav now starts at 1024 px (at 768 it wrapped "How it works" onto
two lines). After scrolling the whole page, no element is left hidden by the reveal animation.
A fresh 2× phone at 360 px picks `*-720.jpg` (probe), not the 960. Screenshots: hero at 320, 768
and 1280; How it works, the match card, the agreement card and the city photos at 360; How it works
and both cards at 1280.

**DES-27b rotating hero** (`housemate-beta`; the CTA position was sampled every 250 ms for 9 s,
covering all three states):

| Size | CTA top/bottom (identical in Lagos, London and every city) | Visible | Word+tag fits the line | Overflow |
|---|---|---|---|---|
| 320 × 568 | 293 / 337 | ✓ | ✓ | none |
| 360 × 740 | 275 / 319 | ✓ | ✓ | none |
| 375 × 667 | 275 (H1 height constant at 80 px) | ✓ | ✓ | none |
| 390 × 844 | 275 / 319 | ✓ | ✓ | none |
| 430 × 932 | 289 / 333 | ✓ | ✓ | none |
| 768 × 1024 | 330 / 374 (fixed: at 68 px "London Coming soon" didn't fit; the headline is 44 px until 1024) | ✓ | ✓ | none |
| 1280 × 800 | 424 / 468 | ✓ | ✓ | none |

The layout shift from the rotation is zero: the CTA's top never moved at any size. Screenshots:
Lagos, London and every city at 375; Lagos at 768 and 1280. The 1280 London and every-city frames
weren't captured: the app hid the browser pane, the page reported `visibilityState: hidden`, and
the rotation correctly paused. Also checked: Pause stops it, and Play restarts it with focus still
on the button. The pill no longer covers the call line at 375. **Reduced motion** was checked by
code only (the tool can't emulate it): the timer never starts when the media query matches.

**Round 1, engineer hand-back (21 Nov), 375 × 812, `housemate-research`:**
- `/join` is now the six-screen application: "Where · Step 2 of 7" (city photo cards, then areas
  once a city is picked, plus "Why we ask"), "Money and dates · Step 3/4 of 7", "Living together ·
  Step 5 of 7" (gender and preference on one screen), "Your profile · Step 7 of 7" (review rows:
  name, areas, budget, move-in, about you, two private rows). ✓
- Date guard: earliest 10 Jan → latest `min` = 2027-01-10. Moving earliest to 1 Mar cleared
  latest, moved focus to it and said "Choose your latest date again. It must be on or after
  1 March 2027." ✓
- The bio counter starts at "40 more characters to go" (D-R5). ✓
- Funnel: `POST /api/v1/funnel` fires as the screens are viewed (200s). In development, React's
  strict mode sends `step_viewed` twice per screen; production sends it once.
- Notifications restyled (New chip, "Open →", dates as "21 Nov, 14:37"; the card content is now
  valid inside a button). ✓
- Not checked in the browser: the household proposals list (sample housemates accept straight
  away, so no pending state exists in research mode), desktop for these screens.
