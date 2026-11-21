# Usability round 1: design changes (DES-25 to DES-33)

Spec and decisions: [`docs/product/beta/usability-round-1.md`](../product/beta/usability-round-1.md)
(D-R1 to D-R5 approved as recommended, 21 Nov 2026). API: [`approval-first-api.md` §7](../engineering/approval-first-api.md).
Nothing here is validated with users yet; round 2 tests it.

## DES-25 Navigation and indicators
- **Phones:** the header chat icon is now **Messages** (→ `/messages`) with a count badge. Feedback
  never uses a chat icon: it stays in the floating pill, as a "Feedback" text button from 640 px,
  and as a row in Settings.
- **Badges** (header icon, bottom nav, desktop nav) count unread messages plus introductions
  waiting for you, from `GET /conversations/unread` (polled every 30 s while visible, and on focus).
  Every badge has a text equivalent ("Messages, 2 new").
- **Discover cards:** a full-width link at the top of the card, "New message · Open →" or
  "Introduced themselves · Reply →", with an icon and text, not colour alone. It uses the server's
  `activity.href`. It's private to the reader: no read receipts (SEC-16).
- "members" → "users" on Discover.

## DES-27 Landing (founder direction, 21 Nov: "find flatmates", less text, visuals talk)
- **Hero:** eyebrow "Open in Lagos · London later" (plain text, no dot) → H1 **"Find flatmates in
  Lagos"** → "Matched on budget, area and habits. Agree the money stuff first." (11 words) →
  **Apply to join** → one line with a video-call icon: "Everyone meets our team on a 10-minute
  video call first." Pea and Bud follow (smaller on phones), with the tagline "Two peas. One home."
- **The rest of the page:** each section is a heading plus at most one short line, and the visuals
  carry the meaning (`components/landing/StoryCards.tsx`):
  - How it works: four illustrated step cards (a mascot plus an icon): Apply · 10-minute call ·
    See who fits · Agree the money.
  - "Every match says why": an animated match card (Tolu A., Yaba; reason chips pop in).
  - "Agree the rent split": an animated agreement card (₦1,800,000 a year each, about ₦150,000 a
    month; the split bar fills; "Agreed by both" pops in).
  - "Lagos now. London later.": the two city photos with "Open now" / "Opening later".
  - Trust: the checks example plus four tiles (title and one line).
  - Final CTA: "Find your flatmate" + Apply to join.
- **Motion:** CSS transform/opacity only. It plays once when scrolled into view, never above the
  fold (so the CTA can't move), and not at all under reduced motion or without JS.
- **Weight:** the landing page now has about 290 words, and no video. City photos are lazy, with
  `srcset` 480/720/960 and `sizes` capped so phones (2–2.75×) load the 720 w file (47–55 KB).
- The old paragraph-heavy `HowItWorks`, `WakeThePod` and `CitySwitch` are no longer on the landing
  page; the files are kept for now.
- Benchmarks: SpareRoom (says what it is in the first line), Revolut/Lovi-style visual storytelling
  (one idea per card, motion that explains).

## DES-27b Rotating city headline (founder, 21 Nov)

**Built** (`components/landing/HeroCities.tsx`): "Find flatmates in **Lagos** [Open now] →
**London** [Coming soon] → **every city** [Coming soon]".
- **Headline:** the city line is one fixed-height mask (`h-[1.15em] overflow-hidden`). Each state
  slides up out of it, transform and opacity only, over 650 ms with
  `cubic-bezier(.2,.8,.2,1)`, and dwells 2.8 s. The tag travels with its word, so "Coming soon" is
  always beside "London". The open city is green.
- **Photo card:** it follows the word, cross-fading with a slow Ken Burns-style scale (900 ms).
  "Every city" is the two photos split on a diagonal with a "+" disc, so no new stock photos are
  needed. A solid white caption chip ("Lagos · Open now", "London · Coming soon", "More cities ·
  Coming soon") keeps the text AA over any photo. Pea and Bud peek over the card's corner.
- **Accessibility:**
  - The H1 holds one static screen-reader sentence ("Find flatmates in Lagos. London and more
    cities coming soon."), and the rotating part is `aria-hidden`.
  - A visible 44 px **Pause/Play** button sits on the card (WCAG 2.2.2).
  - It pauses on mouse hover (mice only, so a phone tap can't leave it stuck), on keyboard focus
    inside the hero (except on the Pause button itself), and while the tab is hidden.
  - Under reduced motion it never starts, so people see Lagos, static.
- **Performance:** Lagos is server-rendered, eager, with `fetchPriority="high"` and no entrance
  animation (it's the LCP). London's `src` is set only at idle after first paint. The collage
  reuses the same `srcset`/`sizes`, so nothing downloads twice, and phones get the 720 w files
  (≤ 55 KB).
- The separate city-photo section was removed (the hero now does that job). So was the header
  link to it.
- The Feedback pill now waits until the landing page has scrolled 480 px, so it no longer covers
  the call line at 375 px. The footer keeps "Give feedback".

**Research** (21 Nov 2026). I found no published teardown of Airbnb, Uber, Bolt, Glovo, Stripe or
Revolut hero rotators: searches returned app listings or paywalled reviews, so their exact
mechanics are unverified. What the sources do show:
- Rotator components size the line to the widest word ("auto-sizes to the widest word to prevent
  layout shift"), keep the text a semantic H1, and premium versions slide words in from below and
  out at the top with a refined ease: [Framer Rotating Text Pro](https://www.framer.com/marketplace/components/rotating-text-pro/),
  [Framer Text Rotation](https://www.framer.com/marketplace/components/text-rotation/),
  [Framer Rotating Headline](https://www.framer.com/marketplace/components/rotatingheadline/),
  [Mintlify word rotate](https://www.mintlify.com/SikandarJODD/animations/components/word-rotate).
- The classic CSS pattern stacks absolutely positioned words that rotate or slide on the X axis
  ([CodyHouse animated headlines](https://codyhouse.co/gem/css-animated-headlines),
  [CodePen](https://codepen.io/pupismyname/pen/yyNvewo)). Syncing captions to cross-fading images
  needs exact timing ([Duke SNCC gateway](https://blogs.library.duke.edu/bitstreams/2017/07/14/sncc-digital-gateway-homepage-updates/)).
  Mood comes from one strong photo per city ([UX Planet, Big City Guide](https://uxplanet.org/case-study-big-city-guide-landing-page-design-8d892b90dcac)).
- Clarity first: Stripe's headline is "a straightforward description of what they offer"
  ([Swipefiles](https://swipefiles.com/teardowns/stripes-homepage)); SpareRoom says what it is in
  line one (round-1 doc).
- **Accessibility pitfalls:** auto-updating text must be pausable, and there's no five-second
  exception for auto-updating content ([WCAG 2.2.2 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)).
  One control per page is fine, and `aria-live` on a rotator floods screen readers
  ([WAI carousel](https://www.w3.org/TR/wai-aria-practices-1.1/examples/carousel/carousel-1.html),
  [WebAIM](https://webaim.org/techniques/carousels/)). So: static SR text, `aria-hidden` rotator, a
  Pause button.
- **Performance pitfalls:** animate only transform and opacity; layout-property slides count as
  CLS ([web.dev CSS for Web Vitals](https://web.dev/articles/css-web-vitals),
  [Shopify: transforms](https://shopify.dev/docs/storefronts/themes/best-practices/performance/use-transform-for-animations)).
  Never hide the LCP image behind a reveal ([Shopify: LCP](https://shopify.dev/docs/storefronts/themes/best-practices/performance/dont-hide-lcp-image-behind-animations)).

What I took: the slide-up mask with a long ease, word plus tag as one unit, a fixed-height line,
the image tied to the word with a cross-fade rather than a wipe (cheaper, no clip-path animation),
a static first frame, and a Pause button.

## DES-28 Received vs approved
- Received: chip "Application received", H1 "We've got your application" (matches E1's subject).
- Approved: solid green chip "Application approved", H1 "You're approved", then an
  "Activate your account" card: the masked address (`email_hint`), sender and subject, a
  Promotions/Spam hint, **Resend invitation** (`POST /applications/resend-activation`, `{ t }` on the
  magic link), the 3-a-day message when `resends_left` is 0, the code field, and "Your browser
  remembers you for 7 days…".
- E2 is stripped to one action (no mascot, no extra box): heading, one line, button, fallback
  link and code, never-share line.

## DES-31 Discover search chips
Chips for areas, budget and dates (the server's ready-made labels) plus **Edit** (areas and
budget) → a bottom sheet on phones, a centred dialog from 640 px. It uses the same `StepBody`
controls, with the actions pinned above the home bar. Saving re-runs Discover and says
"Saved. 6 people fit now." (or "No one fits these yet: try another area or a wider budget."), and
focus returns to Edit. The empty state offers "Change areas or budget" (opens the sheet) and
"Dates and habits" (Profile).

## DES-32 The call, explained before applying
"Someone from the Peabudy team meets every applicant on a 10-minute video call. We check your
photo ID matches you, answer your questions, then decide within a day or two." Under the landing
CTA, as step 3 on `/join`, and in short form on the received status.

## DES-33 One Lagos example
The landing page follows Tolu in Yaba throughout (match card, then the ₦ agreement card). London
appears only as its own photo tile. The fake-clickable dot is gone.

## DES-26 Proposal states (D-R2)
On `/household` while `proposed`:
- **Sent:** chip "Proposal sent · pending", "You proposed a household to {name}", "It's pending
  until {name} accepts…", then **Withdraw proposal** (inline confirm).
- **Received:** chip "Proposal received · your answer", "{name} proposed a household", the
  agreement with **Accept & form household**, and **Decline proposal** (inline confirm). "If you
  decline, {name} just sees that the proposal is closed."
- A three-step strip: Proposed → Both accept → Household formed. The word "household" is only used
  as a noun for the result; the status is always "pending" until both accept.
- **Formed:** "Household formed. You're now planning together…".
- **Closed:** "This is closed. This proposal or household has ended…". It never says why, and never
  names anyone else.
- **Several pending proposals (ENG-52 final):** "Your proposals" / "Your other proposals"
  lists only your own: "Waiting for your answer" (Review) and "Sent by you" (Open, Withdraw with an
  inline confirm). "Pending until both of you accept. When you form a household, your other
  proposals close." The side you're on comes from `household.proposal.direction`, with
  `can_withdraw`/`can_decline` deciding the buttons.

## DES-29 Deal-breakers (D-R4)
Your answer (radio), then "Which of these would rule out sharing a home for you?" with
"Choose any that apply, or say you have none. This works both ways." Ruled-out chips turn
apricot with a ✕; then "or", then the exclusive **I have no deal-breakers**. Choosing either
clears the other. Summary line: "You won't be matched with people who say …" / "No deal-breakers:
any answer is fine with you." / "Choose your deal-breakers, or 'I have no deal-breakers'."
Nothing is shown as chosen until the person answers (`state` from ENG-56, or not yet saved).

## DES-30 Short application + Better first matches (D-R5)
- `QuestionFlow` now says "{section} · Step n of N", so it stays accurate when ENG-57 shortens
  the screen list, and shows a "Why we ask:" line under each essential question.
- It also takes a custom run of `screens` (`flowLabel`, `skipAll`); the last screen finishes.
- `/join/better`: the six habits + stay length, optional and skippable, "Better first matches ·
  Step n of 7", saved per screen. It's reached from a status-page card while waiting for the call
  ("n of 7 answered"; "Your answers help us match you more precisely": not a measured claim).
