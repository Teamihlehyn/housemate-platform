# Responsive QA (DES-19)

Run 10 Nov 2026 by the designer agent against the local dev server in **beta** mode
(`housemate-beta`), with a seeded local member, a local verifier for `/staff`, and a fresh local
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
| `/request-access` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
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
4. **Member page actions overflowed at 320 px** (Block was off-screen). The row now wraps: "Send
   introduction" takes the full width, Report and Block share the next row
   (`app/(app)/members/[id]/page.tsx`).
5. **The Feedback pill covered Block on the member page in landscape** (no bottom nav from
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
