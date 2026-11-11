# Approval-first sign-up: UX (DES-20, DES-21, DES-22)

Spec: [`docs/product/beta/approval-first-signup.md`](../product/beta/approval-first-signup.md)
(F1–F4 approved as recommended). API: [`docs/engineering/approval-first-api.md`](../engineering/approval-first-api.md).
Back office: [applications-queue.md](applications-queue.md). City photos: [city-cards.md](city-cards.md).

Principle: joining is an application a person reviews, with a short video ID call. Nothing on these
screens implies a place in a queue, a guaranteed approval, a match, or that anyone is "safe".

## 1. Entry points

| Where | Beta | Demo modes |
|---|---|---|
| Landing header | "Sign in" (ghost) · **"Apply to join"** (primary; "Apply" under 360 px) | "Sign in" · "Get started" |
| Landing hero | **Apply to join** · See how it works; under it: "Every application is reviewed by a person, with a short video ID call. Already approved? Sign in" | unchanged |
| Final CTA | **Apply to join**; "Already approved? Sign in" | unchanged |
| `/request-access` | redirects to `/join` (`next.config.ts`); the page file is deleted | — |

## 2. `/join` (DES-20)

```
email + privacy consent ─► 6-digit code ─► 17 questions (autosave) ─► review + survey opt-in ─► Send ─► Application received
                     │                 ├─ outcome member      → /discover
                     │                 ├─ outcome unavailable → neutral page
                     │                 └─ status ≠ draft      → /join/status
                     └─ 429 site-wide  → waiting room (Retry-After countdown) · 403 paused → "Applications are paused"
```

- **Email step.** Pea and Bud: "Joining Peabudy is an application, and a person on our team reads
  every one." Three numbered steps (confirm email · tell us your plans · a short video ID call,
  about 10 minutes, then we email your invite). "We're open in Lagos. London applications are
  welcome too: we hold them until London opens." Required consent: "I agree that Peabudy can use
  my answers to review my application, as described in the privacy notice." Footnote: "You must be
  18 or over. Peabudy never asks for money."
- **Code step.** "Enter your code" with the address, expiry, junk-folder hint; "Send a new code",
  "Use a different email". Errors on the field (`INVALID_CODE`, `CODE_EXPIRED`).
- **Questions.** `QuestionFlow mode="join"`, the same questions, options and order as onboarding.
  Header: logo + "Finish later". Each Continue saves; "Saved" shows under the progress bar.
  Resume lands on the first unanswered question (`resumeScreen`).
  City step: photo cards, Lagos first; London has "Opening later — we'll hold your application"
  and a note when chosen.
  Name hint: "Your first name, as it is on your photo ID: we check it on the ID call."
- **Review.** "Check your application" with every answer and Edit links, including the two private
  rows marked "(private)". Note: what happens next, and "Your gender, who you'd live with and any
  address stay private. A reviewer only opens them if needed, and that's logged." Unticked survey
  opt-in (same wording as Settings). CTA "Send my application". `INCOMPLETE` jumps to the first
  missing question with the server's message.
- **Finish later.** "Your answers are saved. Come back to peabudy.com/join on any device and enter
  the same email address… Unsent applications are deleted 30 days after your last change."
- **Application received.** Pea and Bud, chip "Application received", "Thanks, {name}. We've got
  your application." "We'll email you within a day to book a 10-minute video ID call." A 4-step
  "What happens next" list (only step 1 ticked). Waitlisted variant: "{City} opens later", no ID
  call until then. Buttons: "See my status", "Back to the home page".
- **Editing a sent application** (`/join?edit=1`, only while `can_edit`): opens on the review,
  "Your application", Pea says each answer saves; CTA "Back to my status".

## 3. `/join/status` (DES-21)

One heading, one chip, one next step per state. Session view adds "Manage"; the magic link
(`?t=`) is read-only, with a **Sign in to change your answers** button (→ `/join`: email code, then
the application session). E1 and E5 point to that button. After any code, the app goes where the
server's `redirect` says (staff → `/staff`, users → `/discover`, applicants → `/join` or `/join/status`).

| Status | Chip | Heading | Body / next step |
|---|---|---|---|
| draft | Not sent yet | Your application isn't sent yet | Answers saved; deleted 30 days after the last change → **Continue my application** |
| submitted, in_review | ✓ Application received | We've got your application | "We'll email you within a day to book a 10-minute video ID call." Progress: sent ✓ · *we book your call* · the call, then our decision · you activate |
| call_booked | ✓ ID call booked | Your ID call is booked | Date and time in the city's time zone ("Thursday 19 November, 14:30 (Lagos time)"); how it works: about 10 minutes, have a passport/driver's licence/national ID card, 18+, "We don't record the call or keep a copy of your ID"; reschedule by replying to the email |
| approved | ✓ Approved | You're approved. Check your email for your invite. | From hello@peabudy.com, link works 14 days → **Have your activation code?** field → `/invite/<CODE>` |
| waitlisted | {City} opens later | We're holding your application until {City} opens | Nothing to do now |
| declined | Not this time | We can't offer you a place right now | "You're welcome to apply again from {date}." No reason, ever (F3). After the date: **Apply again** |
| withdrawn | Withdrawn | You withdrew your application | **Apply again** (signs out, then `/join`: the code reopens the same application) |

Manage (session only): Edit my answers (if `can_edit`) · Download my data · Withdraw (if
`can_withdraw`, inline confirm) · Delete my application (inline confirm, danger) · Sign out.
Every state shows "Peabudy never asks for money. Nobody from our team will ask for a fee to speed
up your application."
Signed out with no link: "Check your application" → "Continue with my email" (`/join`). Bad link:
"This status link doesn't work any more".

## 4. Activation `/invite/[code]` (DES-21)

valid → "Application approved" chip, "You're approved", masked email → **Email me a code** →
code (+ consent box only if the server says `CONSENT_REQUIRED`) → **Activate my account** →
the server's `redirect` (`/discover`). "When you activate": your profile becomes visible to people
whose plans fit; it shows our team checked your ID; report and block one tap away; "Checks
completed — not a guarantee of safety."
Invalid (unknown, used, expired, revoked, withdrawn, wrong account): "This activation link isn't
valid any more" → Sign in · Check my application · hello@peabudy.com.
Old `/signin?invite=CODE` links forward to `/invite/CODE`.

## 5. Sign in (approved users only)

Beta: "Sign in to Peabudy. For approved users." After any address, the same box:
"If you have an approved Peabudy account, we've sent a code. New here? Apply to join." The invite
field is gone; "Have an activation code?" opens a small field that goes to `/invite/<CODE>`. The
consent box only appears if verify returns `CONSENT_REQUIRED`. Demo modes are unchanged
(open sign-in, personas).

## 6. In-app

- `/onboarding`: an active user with a published profile goes to `/profile` (contract §4).
  Demo accounts that haven't published keep onboarding.
- `/profile`: five sections (About you · Where · Money and dates · Living habits · Housemate
  gender), each with Edit → the same `StepBody` controls → Save changes / Cancel. Name is
  read-only when `nameLocked` ("Checked with your photo ID… email hello@peabudy.com"). City is
  read-only ("To move to another city, email hello@peabudy.com") — assumption, see §8.

## 7. Emails (DES-22)

`docs/design/emails/<name>.html|.txt`, same email-safe build as `invite`/`survey` (tables, inline
CSS, 600 px, dark-mode tweaks, `[POSTAL ADDRESS]` kept). Synced with
`node scripts/sync-email-templates.mjs` into `lib/emails/templates.ts`. Subjects avoid HTML
entities (the subject is the `<title>`, and only `&amp;` is decoded).

| Name | ID | Subject | Notes |
|---|---|---|---|
| `code` | E0 | Your Peabudy code: {{code}} | One template for /join, sign-in and activation, so it never hints at an account. "Never share this code." |
| `application_received` | E1 | We’ve got your Peabudy application | Status link, next steps, what ID to bring, never asks for money |
| `application_waitlisted` | E1 + E5 | We’ve got your Peabudy application | "{{city_name}} opens later", no ID call until then, held up to 12 months |
| `approved` | E2 | You’re approved: activate your Peabudy account | Button + link + code typed out, expiry date, "Never share this link or code" |
| `declined` | E3 | About your Peabudy application | Kind, generic, reapply date, retention in plain words; no mascot, no reason |
| `call_booked` | E4 | Your Peabudy ID call: {{call_time}} | Time, how it works, ID to bring, "We don't record the call or keep a copy of your ID", free |

E4 shows `{{call_link}}` as "How to join: …" in plain text, because it's either the video link
staff entered or a sentence saying the link will follow.

## 8. Assumptions and open questions

1. **City changes after activation** go through hello@ (no in-app city edit). Changing city would
   change currency and could move someone to a city that isn't open. PM to confirm.
2. **Profile edits after approval** (bio, habits, dates) are allowed without re-review, per the
   spec. Name is locked. A bio could be changed to something a reviewer wouldn't have approved;
   reports remain the backstop. PM/security to confirm.
3. "About 10 minutes" for the ID call comes from the spec. If calls run longer, change the copy in
   `/join`, the status page and E1/E4 together.
4. The feedback pill is hidden on `/join` (it covered the sticky Continue). The status page keeps it.
