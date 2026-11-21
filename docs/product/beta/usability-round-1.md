# Usability round 1: findings, benchmarks and tickets

| | |
|---|---|
| Status | **D-R1…D-R5 approved by the founder on 21 Nov 2026 ("Please go ahead"), as recommended (§5).** Tickets ENG-50–60, DES-25–33 and SEC-16–19 are approved scope. **New feature:** the AI-guided chat ("Peabudy guide") is specced in [`ai-guided-chat.md`](ai-guided-chat.md), pending decisions D-G1…D-G4. Unblocked tickets are marked **Start now**. ENG-53 is unused (reserved) |
| Source | One moderated session on staging (beta mode), several participants, a moderator and the founder. Inputs: the founder's backlog and session export (kept outside the repo). **No participant names or attributable quotes appear here.** Participants are A–D, and their words are paraphrased |
| Limits (*Fact*) | One session, small n, and partly coordinated answers (the moderator lined up area, budget and dates so testers would match). It shows **that** problems exist, not **how often**, and it measured no drop-off. Everything below about drop-off is a *Hypothesis* to test |
| Words | Users (not members); visitor → applicant → user; staff work in the back office. The test materials say "Peabody"; the product is **Peabudy** |

---

## 1. What we learned

**Headline:** the path from **receiving a message → forming a household** broke twice. Both breaks happened at the exact job people come to Peabudy for.

| # | Finding (paraphrased) | Evidence type | Code check, 21 Nov (*Fact*) |
|---|---|---|---|
| F1 | A participant couldn't tell from Discover who had contacted them. Tapping a notification did nothing. The header "chat" icon opened the feedback form | Observed | Notification cards are plain `div`s with no link (`app/(app)/notifications/page.tsx:27`). The `Notification` model has no target field (`prisma/schema.prisma:594`). The mobile header's Feedback button uses a speech-bubble icon (`components/AppNav.tsx:86–89`, `IconFeedback` in `components/icons.tsx:54`). Conversations have **no read state** (no `lastReadAt` anywhere). "Mark all read" is the only read action (`app/api/v1/notifications/route.ts`) |
| F2 | After A proposed a household to B, a later proposal involving C failed with a message implying someone already had a household. The cause was B's pending proposal | Observed; root cause confirmed in code | `POST /households` refuses if **either** person has a `proposed` **or** `active` household, and says "One of you already has an active household." (`app/api/v1/households/route.ts:29–38`). The message is wrong (it's only a proposal), vague about whom, and it **reveals another user's state** to the proposer |
| F3 | Visitors couldn't say whether Peabudy finds flatmates, finds property or is a waiting list. On mobile, the main button needed a scroll. The headline wordplay and coloured hero text cost seconds. The green dot looked clickable | Observed (several participants) | Hero: "Two peas. One home." plus a two-line paragraph. On mobile, `HeroScene` renders **first** (`order-first`, `app/page.tsx:150`), pushing the CTA below the fold. The availability pill has a static green dot that does nothing (`app/page.tsx:121–123`) |
| F4 | An approved applicant saw "approved" on the site but found the invitation only in Gmail Promotions | Observed | The status page says "Check your junk folder too" but shows no destination address and offers **no self-serve resend**. Only staff can `resend_activation` (`app/api/v1/staff/applications/[id]/route.ts:49`). Status persists through a server-side `application` session (7 days, `lib/session.ts:13`) plus the magic link, **not** local storage (no `localStorage` in `app/join`) |
| F5 | The date picker allowed a latest move-in date before the earliest | Observed | The server already rejects it (`app/api/v1/me/search/route.ts:104–105`). The client inputs have no `min` (`components/apply/StepBody.tsx:182,188`), so people find out late |
| F6 | People read "untick to make it a deal-breaker" in opposite ways, and disagreed about what "nothing ticked" means | Observed | The current model is an **accepted set**: everything ticked by default = "Flexible"; untick = deal-breaker; you can't untick all (it falls back to your own answer) (`components/apply/useProfileDraft.ts:79,131–133`). **Also:** your own habit answer is **pre-selected** to the first option (`useProfileDraft.ts:79`), so a skipped question can't be told apart from a real answer |
| F7 | About 17–18 upfront questions felt like a lot. One participant said they might answer at random just to finish. Another argued area and budget are things people change on the fly | Opinion and hypothesis | 17 question screens + review (`useProfileDraft.ts:20–21`), after email, code and consent. `locationDetail` is collected but unused (`CLAUDE.md` §8). Matching **drops anyone without stay length** (`lib/matching.ts:65–74`) |
| F8 | Seeing prices changes how far people would live and how much they'd spend | Opinion | Discover has only "Adjust my search" → `/profile` in the empty state (`app/(app)/discover/page.tsx:116`) |
| F9 | "A person on our team meets everyone" needed explaining. People asked how to book the call. Participants **valued** the human call as a trust signal beyond an ID check, but worried about committing before seeing anyone relevant | Observed and opinion | The booking step is "we'll email you", and rescheduling is "reply to the email" (`app/join/status/page.tsx:211`) |
| F10 | The "How it works" Lagos example (Yaba) ends in pounds. The beacon dot invites a tap. There's logo and chat-bubble spacing to fix | Observed | `components/landing/HowItWorks.tsx:140,180` shows "Yaba · Surulere" and then "£950/mo each" |
| — | Wording drift | Code | Discover still says "members" (`discover/page.tsx:81,111,177`), against the founder's "users" rule |

---

## 2. Benchmarks: what the best products do

Every source was fetched or searched on 21 Nov 2026. Reviews and teardowns are *indicative*, not representative samples.

| Area | Best-in-class behaviour | Why people like it (evidence) | What we copy or adapt |
|---|---|---|---|
| **Value before sign-up** | **Duolingo** starts a lesson before any account exists. Sign-up comes after the first lessons, as soft and then hard walls | A Duolingo growth leader reported about **+20% DAU** from moving sign-up back a few steps, and **+8.2%** more from tuning the walls ([First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker)). The trade-off is fewer emails captured ([Taplytics](https://taplytics.com/blog/duolingo-ab-test-onboarding)) | We can't show real people before a human check (safety, `CLAUDE.md` §2.8). We **can** show value first with non-personal evidence: live counts of approved users per Lagos area and move-in month (no profiles), and an honest "who you'd match with" preview built from **your** answers. The application itself gets shorter (§4) |
| **Verification timing** | **Airbnb** asks guests to verify **before booking**, not at sign-up. Hosts never get the ID or selfie ([Airbnb help 1170](https://www.airbnb.com/help/article/1170), [Airbnb news](https://news.airbnb.com/an-update-on-identity-verification-on-airbnb/)). **Hinge** selfie verification is short, optional in many places, and doesn't keep the video ([Hinge help](https://help.hinge.co/hc/en-us/articles/10303221435539-What-is-Selfie-Verification-)) | The check sits at the point of commitment, where its purpose is obvious | Our staff call stays (D4, a founder decision; participants valued it). We copy **the timing logic** as an option for D-R1: browse a limited, consented preview, then the check before any contact. And copy **Hinge's honesty**: the badge says exactly what was checked |
| **Human onboarding as a feature** | **Superhuman** onboarded every user on a 30-minute live call; waitlist size followed call capacity ([First Round: Superhuman playbook](https://review.firstround.com/superhuman-onboarding-playbook/), [Sacra](https://sacra.com/chat/h/43692763-029d-477d-9891-29012ac81b02/)) | The call built trust and made users actually use the product. Some found a mandatory call annoying ([Gainsight](https://www.gainsight.com/blog/5-lessons-i-learned-from-superhumans-onboarding/)) | Frame the 10-minute call as **the trust promise**, not a hurdle. Self-serve booking and rescheduling (no email ping-pong). Show **what happens on the call** before people apply |
| **Messages and notifications** | Notifications **deep-link to the exact item**, never the home screen ([Airship](https://www.airship.com/?p=836), [OneSignal](https://onesignal.com/blog/deep-linking-best-practices/)). **Slack** reconciles read and unread so badges are right everywhere ([Slack engineering](https://slack.engineering/into-the-clouds/)). **Hinge** "Your Turn" puts chats waiting on you at the top ([Hinge newsroom](https://hinge.co/newsroom/your-turn-limits-test), [help](https://help.hinge.co/hc/en-us/articles/31662181659027-What-is-Your-Turn-Limits)) | Hinge reported its Your Turn Limits test **raised responsiveness by about 20%** (Hinge press, above) | One tap from notification → thread. One read state shared by the header, Discover and the inbox. "Waiting for your reply" sorted first. No read receipts to the sender (SEC-16) |
| **Commitment step after matching** | **Breeze** skips chat: after a match, both pick availability and the app books the date, with a penalty for cancelling ([App Store](https://apps.apple.com/gb/app/id1478108023), [Dazed](https://www.dazeddigital.com/life-culture/article/65865/1/i-tried-breeze-the-dating-app-that-takes-online-dating-offline)). **Hinge** allows many parallel conversations | Clear commitment states reduce ambiguity. Breeze reviews are mixed on volume ([Trustpilot](https://au.trustpilot.com/review/breeze.social)) | **Multiple pending proposals, mutual confirmation** (D-R2). Exclusivity starts only when **both** confirm, and other pending proposals then close with a neutral notice. Nobody sees anyone else's pairings |
| **Search flexibility** | **Airbnb** keeps the most-used filters (dates, type, price) on the main search, with a price slider showing the price spread ([TechCrunch](https://techcrunch.com/?p=906056), [Airbnb help 479](https://www.airbnb.com/help/article/479), [ClickZ](https://www.clickz.com/10-great-ux-features-from-the-airbnb-website/94645/)) | Changing a filter shows the result immediately, so trade-offs are visible | Area and budget chips on Discover, with an edit sheet and an instant result count (§3, ENG-59). City stays locked after approval |
| **Flatshare comparators** | **SpareRoom's** hero is literally "The UK's Number 1 Flatshare Site", with a search box (Rooms / Flatmates / Buddy ups) and a live count of rooms and flatmates ([spareroom.co.uk](https://www.spareroom.co.uk/), fetched 21 Nov). **Badi**: chat request → accept → match ([App Store](https://apps.apple.com/app/id1008653746)) | SpareRoom reviews praise ease of use and saved-search notifications, and complain about spam and unanswered messages ([Trustpilot](https://www.trustpilot.com/review/www.spareroom.com), [Kimola summary](https://kimola.com/reports/unlock-insights-with-our-comprehensive-spareroom-feedback-report-app-store-gb-154333)). Badi reviewers complain about fake users ([Trustpilot](https://www.trustpilot.com/review/badi.com?page=2)). Another flatmate site's reviewer complained about "heaps of questions before I can even search" ([Trustpilot, Flatmate Finders](https://au.trustpilot.com/review/flatmatefinders.com.au)) | Say plainly what it is, in the first line. Our differentiator answers SpareRoom's top complaint: **every person is checked by a human, and spam is impossible because contact needs a match**. Keep the question count low |
| **Lagos market** | Muster (Lagos rent-sharing with verified people) ([TechCabal](https://techcabal.com/?p=65361), [Technext](https://technext.ng/2021/01/18/startup-review-muster-helps-you-find-verified-people-to-split-apartment-cost-with/)); BienCasa Flatmate launching in five cities ([TechCabal](https://techcabal.com/2026/04/09/flatmate/)) | Little public user feedback found; I couldn't verify reviews from Lagos users | "Verified people" is table stakes in Lagos. Our wedge is **the written agreement before moving in** plus the human check |
| **Landing clarity** | Five-second tests ask "what does this company do?" and "what would you do next?" separately ([Lyssna guide](https://www.lyssna.com/guides/five-second-testing/), [Kalungi](https://www.kalungi.com/blog/5-second-test-ux-questions)). Test mobile and desktop separately, because mobile compresses the message ([Branded Agency](https://brandedagency.com/blog/five-second-test)) | — | A plain headline, CTA directly beneath, the animation after the CTA on mobile, and a five-second test in round 2 |
| **Invites landing in Promotions** | Keep transactional email single-purpose: one action, minimal HTML, a plain-text part, few links, separate streams for marketing ([Suped](https://suped.com/email-deliverability/answers/how-can-i-prevent-transactional-emails-like-account-verification-links-from-landing-in-the-gmail), [Mailjet](https://www.mailjet.com/blog/news/gmail-promotions-tab/)). Tab placement can't be guaranteed | — | Strip the activation email to one action, then add **self-serve resend** and on-page guidance (ENG-54). Never rely on the tab |
| **Progressive profiling** | **Bumble BFF** asks lifestyle prompts **after** the account exists, framed as raising match chances ([Pratt design critique](https://ixd.prattsi.org/2026/02/design-critique-bff-ios-app/), [Her Campus](https://www.hercampus.com/life/i-tried-bumble-bff-heres-what-happened/)). **Timeleft** uses a short quiz, then preferences ([App Store](https://apps.apple.com/app/timeleft/id6466442949)) | Prompts feel like personalisation, not paperwork | Ask habits **while the person waits for their ID call** (dead time today), framed as "better first matches" (§4) |

---

## 3. Tickets

Priority: **Fix-first** (before round 2) · **Improve** · **Decide** (blocked on §5).
Acceptance criteria are taken from the backlog, made testable.

### 3.1 Messages you can find and open (backlog #1), Fix-first, **Start now**

**ENG-50: Notifications open what they're about.** Owner E · Size S · No dependencies.
- **Current:** cards with no link; only "mark all read".
- **Target:**
  - Add `Notification.targetType` (`conversation | introduction | household | application | none`) and `targetId` (additive migration).
  - Every `notify()` call passes them. Today's calls are in `introductions`, `introductions/[id]`, `conversations/[id]/messages`, `households`, `households/[id]`, `me/delete` and `staff/applications/[id]`.
  - Cards become links to `/messages/{id}`, `/messages` (with the intro open), `/household` or `/join/status`.
  - Opening one marks that notification read: `POST /notifications/{id}/read`.
  - Links re-authorise on open: an inaccessible target → the page's normal 404 ("This user isn't available").
- **Acceptance:**
  - A messages B → B taps the notification → A's thread opens in one tap.
  - The notification is read afterwards.
  - A link to a blocked user's thread shows the 404 page.

**ENG-51: One read state across inbox, header and Discover.** Owner E · Size M · No dependencies.
- **Current:** no conversation read state; the header has no Messages entry on mobile (only the bottom nav).
- **Target:**
  - `ConversationRead {conversationId, userId, lastReadAt}` (additive), updated when the thread renders.
  - `GET /conversations` returns `unread` per thread and `unreadTotal`.
  - The Messages nav item shows an unread badge (bottom nav on mobile, top nav on desktop).
  - Discover cards show "New message" or "Introduced themselves" for people with unread activity, and tapping it opens the thread or intro.
  - The inbox sorts "Waiting for your reply" first (Hinge pattern).
- **Acceptance:**
  - From B, the notification and the Discover card each open A's thread in one tap, and the header opens the inbox.
  - After B reads the message, the notification, the Discover card and the inbox badge all show read after refresh.
- **SEC-16** reviews it.

**DES-25: Navigation and indicators.** Owner D · Size S.
- Remove the speech-bubble Feedback icon from the header (mobile).
- **Feedback stays in the floating pill**, plus a "Feedback" text link in the profile menu, never with a chat icon.
- The Messages icon with an unread badge (text plus count, for screen readers).
- The Discover card indicator, with text and not colour alone.
- Fix "members" → "users" on Discover (`discover/page.tsx:81,111,177`).
- **Acceptance:** nothing that looks like chat opens feedback; badges have text equivalents.

**SEC-16: Deep links and read state.** Owner S · Size XS.
- Notification targets are re-authorised on open (blocked, deleted, other world → 404).
- No IDs of other users appear in a URL beyond the existing `/members/[id]`.
- **No read receipts to the sender** (recommendation: read state is private to the reader, to avoid pressure and monitoring between strangers).
- The unread state isn't in any public DTO.

### 3.2 Pending proposal vs formed household (backlog #2), Fix-first

**ENG-52: Household proposals follow the agreed rule (D-R2).** Owner E · Size M · Depends on D-R2. **The copy and privacy fix starts now.**
- **Current:** a pending **or** active household for either person blocks any new proposal, with the misleading message "One of you already has an active household" (`households/route.ts:29–38`). Forming one pauses both searches and expires pending intros (`CLAUDE.md` §8).
- **Target, if D-R2 = recommended:**
  - **Proposals** (`proposed`) don't block each other. One person may have up to 3 outgoing pending proposals; incoming are unlimited, but each pair has one at a time.
  - **Formation** (all accept) is the exclusivity point. In the same transaction, the other pending proposals involving either person close as `withdrawn` (`reasonCode: "formed_elsewhere"`), and each other party gets a neutral notice: "This proposal is closed. {name} isn't available for a household right now."
  - Either person can withdraw a pending proposal, and the recipient can decline.
  - **Leaving** a household reopens search (as today).
  - **Errors never mention third parties.** Proposing to someone in an active household returns 409 with "{name} isn't available for a household right now". It never says why, and never reveals other proposals.
- **Start now, independent of D-R2:**
  - fix the error text to say whose state blocks and what to do, without leaking others ("You've got a pending proposal with {name}. Withdraw it to propose to someone else.");
  - add Withdraw and Decline if missing.
- **Acceptance:**
  - A proposes to B, then to C. The result follows D-R2.
  - If blocked, A sees the real reason (their own state only) and the action.
  - B can accept or decline.
  - Both accounts show the same outcome after refresh.
  - When A and B form a household, C's pending proposal with A closes with the neutral notice.
- **SEC-17** reviews it.

**DES-26: Proposal states from both sides.** Owner D · Size S · Depends on D-R2.
- Screens: **Proposal sent** (withdraw), **Proposal received** (accept / decline), **Household formed** (agreement next), **Closed** (neutral).
- No other users' names or conversations are shown.
- Copy says "pending", never "household", until both confirm.

**SEC-17: Proposal privacy.** Owner S · Size XS.
- No endpoint or message reveals whether another user has other proposals or a household.
- The auto-withdraw notice is neutral.
- Audit rows for withdraw, decline and auto-close.

### 3.3 Landing: say it plainly, CTA above the fold (backlog #3 and #10), Fix-first, **Start now** (copy final after D-R3)

**DES-27: Hero rewrite and layout.** Owner D (edits `app/page.tsx` and `components/landing/*`) · Size M.
- **Current:**
  - Wordplay headline "Two peas. One home.";
  - the hero animation renders first on mobile (`order-first`);
  - the CTA sits below it;
  - a decorative green dot.
- **Founder copy direction (21 Nov) overrides the draft below where they differ:**
  - the **headline must include "find flatmates"** (e.g. "Find flatmates in Lagos you'll actually get on with");
  - **much less text**, with **visuals and animation carrying the story** (the how-it-works sequence shown, not described);
  - the **CTA above the fold** on every listed width.
  - The animation must not push the CTA below the fold on mobile, and must respect reduced motion.
- **Target (draft):**
  - **H1:** "Find someone to share a home with in Lagos." (superseded: must include "find flatmates")
  - **Sub:** "We match you on move-in dates, budget, area and living habits. Everyone meets our team on a 10-minute video call first."
  - **Primary CTA directly beneath: "Apply to join"**; secondary "How it works"; "Sign in" stays in the header.
  - The animation moves **after** the CTA on mobile and gets smaller; the brand line ("Two peas. One home.") becomes a small tagline.
  - The dot becomes static text ("Open in Lagos") or a real link to `/join`; the PM recommends plain text.
  - A three-step strip below the hero: Apply → 10-minute video call → Meet people whose plans fit.
- **Acceptance:**
  - At 320, 360, 390 and 430 px and at 1280 px, the H1 and primary CTA are visible on load with no scroll (recorded in `docs/design/responsive-qa.md`).
  - In a five-second test (round 2), at least 4 of 5 first-time visitors say who it's for and what to do next (*proposed target*).

**DES-33: How-it-works consistency and visual cues.** Owner D · Size S · **Start now**.
- **Current:** "Yaba · Surulere" → "£950/mo each" (`HowItWorks.tsx:140,180`).
- **Target:**
  - one Lagos story end to end in **₦ per year**, with the monthly equivalent ("₦1,800,000/yr each (≈ ₦150,000/mo)"), consistent with `monthlyEquivalentMinor`;
  - London shown only in its own city view;
  - anything styled as a link is a link;
  - fix the logo and chat-bubble spacing.
- **Acceptance:** a visitor follows one example with no currency switch; every link-styled element works on mobile and desktop.

### 3.4 Approval and invite recovery (backlog #4), Fix-first, **Start now**

**ENG-54: Self-serve invitation recovery.** Owner E · Size S.
- **Current:** approved status says "check your email", with no address and no resend (staff-only `resend_activation`).
- **Target:**
  - the approved status shows the **masked destination** ("t•••@gmail.com");
  - a **Resend invitation** button (`POST /applications/resend-activation`, application session or magic link): revokes the old code, issues a new one, **max 3 per 24 h**, audited, never a second application;
  - short guidance ("Check Promotions or Spam. It's from hello@peabudy.com.");
  - the activation email is stripped to one action, with a plain-text part (Promotions-avoidance practice, §2).
  - Status recovery stays server-side; document "your browser remembers you for 7 days; after that, use the link in your confirmation email".
- **Acceptance:**
  - An approved applicant who missed the email recovers the invite without staff help.
  - Refresh or return shows the current status.
  - Resending creates no second application.
  - A fourth resend in 24 h is refused with a clear message.

**DES-28: Distinct received and approved moments.** Owner D · Size S.
- Two distinct screens and email subjects: "We've got your Peabudy application" vs "You're approved: activate your Peabudy account". These already differ in templates; make the **screens** match them.
- The approved screen has the address, resend and the Promotions hint.

**SEC-18: Resend abuse.** Owner S · Size XS.
- Rate limit, no enumeration (the session or magic link is needed), old code revoked, audit.

### 3.5 Valid move-in dates (backlog #5), Fix-first, **Start now**

**ENG-55: Date range guard in the client.** Owner E · Size XS.
- **Current:** the server rejects latest < earliest (`me/search/route.ts:104–105`), but the inputs allow it.
- **Target:**
  - latest `min` = earliest (same day allowed, matching the server);
  - if earliest moves past latest, clear latest, focus it and say "Choose your latest date again. It must be on or after {earliest}." Keep every other answer.
  - The same in Profile.
- **Acceptance:** earliest 15 Jan stops 14 Jan being chosen or submitted; moving the start past an existing end prompts a correction before continuing.

### 3.6 Deal-breakers you can't misread (backlog #6), Fix-first, depends on D-R4

**ENG-56: Explicit deal-breaker answers.** Owner E · Size S · Depends on D-R4.
- **Current:**
  - accepted-set UI ("untick to rule out");
  - "none ticked" is impossible;
  - **own answer pre-selected** (`useProfileDraft.ts:79`).
- **Target, if D-R4 = recommended:**
  - the UI asks "Which of these would rule out sharing a home for you?" (select deal-breakers);
  - **"I have no deal-breakers"** sits last and is mutually exclusive;
  - storage is unchanged for matching: `acceptedValues = all − selected` (two-way rule unchanged);
  - add `PreferenceAnswer.state` = `unanswered | none | some`;
  - **own answer has no default** (required, or explicitly deferred, §4).
  - Existing rows migrate to `none` if everything is accepted, otherwise `some`.
- **Acceptance:**
  - Choosing "no deal-breakers" clears specific choices, and vice versa.
  - Revisiting preserves the answer.
  - A skipped question stays distinguishable (`unanswered`).
  - Matching results for existing users are unchanged by the migration (snapshot test).

**DES-29: Deal-breaker screen.** Owner D · Size S · Depends on D-R4.
- "Your answer" (radio, none pre-selected), then "Would any of these rule someone out?" (chips plus the exclusive "No deal-breakers").
- A live summary line ("You won't be matched with people who say …").

### 3.7 Shorter road to a first match (backlog #7), Improve, depends on D-R5 (§4)

**ENG-57: Minimum application + deferred questions.** Owner E · Size L · Depends on D-R5, ENG-56.
- Implements §4's set.
- Matching treats deferred **stay** as "open" (1–36 months) instead of dropping the user (`lib/matching.ts:65–74`).
- **Unanswered habits are conservative:** an unanswered own answer can't satisfy anyone who has a deal-breaker on that dimension, and your own unanswered deal-breakers accept all. Two-way and deterministic; enforced again at intro time.
- Remove `locationDetail` from the flow (collected, unused).

**ENG-58: Step funnel tracking (no PII).** Owner E · Size S · **Start now** (instrument the current flow first, to get a baseline).
- Events go to `AuditEvent` or a new `FunnelEvent` table (event, step, flowVersion, anonymous applicationId, timestamp). Never answers, names or emails.
- Spec in §4.3.
- An admin-only funnel table in the back office (counts per step, per flow version, per city).

**DES-30: Prototype the short flow.** Owner D · Size M · Depends on D-R5.
- An accurate progress indicator ("Step 3 of 7").
- A one-line "why we ask" under each essential question.
- The "Better first matches" step shown while waiting for the call.

### 3.8 Edit area and budget while exploring (backlog #8), Improve, **Start now**

**ENG-59: Preference chips on Discover.** Owner E · Size M.
- **Current:** only "Adjust my search" → `/profile` in the empty state.
- **Target:**
  - Discover header shows chips "Yaba, Surulere · ₦1.5–2m/yr · Jan–Mar" with **Edit**: a bottom sheet with areas (within the locked city) and a budget range;
  - saving does `PATCH /me/search` (writes `SearchVersion`, as today) and refreshes results in place;
  - the empty state offers the same edit inline, plus the narrowest filter (exists: `narrowFilters`).
  - City changes stay with hello@ (approval-first spec, answer (a)).
- **Acceptance:** someone who picked Lekki changes area or budget from Discover, sees updated results or the empty state, and later finds the new values saved.
- **DES-31:** chip and sheet design; the thumb-reachable sheet; the result count. Size S.

### 3.9 Explain the human check, and self-serve booking (backlog #9), Improve, **Start now**

**DES-32: Explain the call before applying.** Owner D · Size S.
- Next to "Apply to join" and on `/join`: "Someone from the Peabudy team meets every applicant on a 10-minute video call. We check your photo ID matches you, answer your questions, then decide within a day or two."
- The badge copy stays exact: "Identity checked by the Peabudy team · {month}", and "Checks completed — not a guarantee of safety".
- *Wording:* "Someone from the Peabudy team", not "a member of".
- **Booking step (F-26):** "Book your 10-minute video call. Pick a time that suits you; it's on Google Meet. You'll get a calendar invite with a link to change or cancel. We don't record the call or keep a copy of your ID."

**ENG-60: Self-serve call booking (F-26 decided 21 Nov: Google Calendar appointment schedule + Google Meet).** Owner E · Size XS · Depends on the founder sending the booking link.
- **Current:** staff email to book; rescheduling means replying to the email.
- **Target (v1, link-out only):**
  - a **"Book your 10-minute video call"** button on the status page (submitted, in review) and in the application-received email (E1), linking to `NEXT_PUBLIC_CALL_BOOKING_URL`, opening in a new tab;
  - no data passed in the URL;
  - hidden if the variable is unset, falling back to today's "we'll email you" copy.
  - Staff mark **"Call booked"** by hand in the back office (existing action).
  - Reschedule and cancel come from Google's own confirmation email.
  - No Calendar API sync (later).
- **Acceptance:** an eligible applicant books, and changes a time, without asking the team. With the variable unset, no broken button appears.

### 3.9b Test approvals on staging (founder, 21 Nov), **Start now**

**ENG-67: "Approve without call (test only)".** Owner E · Size S · Security review: SEC-15 follow-up.
- **What:** a back-office action on **staging only** that approves an application without the video ID call, for test runs and seeded profiles.
  - Enabled only when `ALLOW_TEST_APPROVALS=true` **and** not production. In production (`VERCEL_ENV=production`) the action is refused with 404, and the variable is ignored.
  - Approved accounts get `idCheckMethod = "test"`. **No identity `VerificationCheck` is ever set to verified.** They show **"Test account — ID not checked"**, never "Identity checked".
  - Audited (`application.test_approved`, with the staff actor). Same roles and self-action ban as approve.
- **Acceptance:**
  - On staging with the variable set, the action approves and the profile shows the test label.
  - In production, the action returns 404 even with the variable set.
  - No test-approved account ever carries an "Identity checked" label or the identity check.
  - The switch-to-beta script refuses to run if `ALLOW_TEST_APPROVALS` is set for production.

### 3.10 Security for the verification-timing option (D-R1), not needed (D-R1 = A)

**SEC-19: Threat model for "limited preview before verification".** Owner S · Size S · Only if D-R1 leans to option B.
- What an unverified applicant could see:
  - first name, area, move-in month, budget band, habits summary, no photo or bio;
  - only consented fields;
  - no contact;
  - rate-limited browsing;
  - no exact dates (stalking and inference risk);
  - interaction with gender preference (HM-09-style inference).
- **Recommendation stays verification-first for the pilot** (§5).

---

## 4. Onboarding-shortening proposal (backlog #7)

### 4.1 Audit: "What breaks if we ask this later?"

The current `/join` runs email → code → consent, then 17 question screens + review.

| Screen | Used by (*Fact*) | What breaks if asked later | Proposal |
|---|---|---|---|
| First name | Staff ID match; display | Staff can't match the ID; no display name | **Keep** |
| Journey | Label only (not a matching rule) | Nothing | **Defer** to Profile (default "Find a place together"); ask just in time when proposing a household |
| City | Eligibility (`OPEN_CITIES`), currency | Waitlisting and currency | **Keep** (photo cards), merged with areas |
| Areas | Hard constraint | No matches | **Keep**, same screen as city; editable from Discover (ENG-59) |
| Location detail | **Unused** | Nothing | **Remove** (data minimisation) |
| Budget | Hard constraint | No matches | **Keep** as a starting range ("you can change this any time"); editable from Discover |
| Dates | Hard constraint | No matches | **Keep**; month-level window by default, exact dates optional |
| Stay length | Hard constraint; missing → excluded | User excluded from matching today | **Defer** to "Better first matches"; treated as open until answered (ENG-57) |
| Gender | Two-way gender rule | Safety: a women-only seeker could be shown to men | **Keep**, merged with preference on one screen |
| Gender preference | Two-way gender rule | Same | **Keep** (merged) |
| 6 habits | Hard constraints | First matches less precise | **Defer** to "Better first matches", **while waiting for the ID call** (dead time today). Conservative matching until answered (ENG-57) |
| Bio | Staff review; intros | Staff can't judge genuineness | **Keep**, minimum 40 characters (from 80) with prompt chips |
| Review | Confidence | — | **Keep** |

**Result:**
- **The application** is email + code + consent, then **6 question screens** (name · city & areas · budget · dates · living with (gender + preference) · bio) + review. That's 17 → 6.
- **Then, on the status page while waiting:** "Better first matches: 7 quick taps" (6 habits + stay), with a progress bar and skip. Answering is optional but nudged: "People who answer these see fewer mismatches." *That claim is a hypothesis; show it only once measured. Until then, say "helps us match you more precisely".*
- **Then, just in time:** journey (when proposing a household), anything else when the feature needs it.

### 4.2 Eligibility vs first useful match
- **Eligibility:** email ownership, consent, name, open city, bio (staff review), the ID call.
- **Useful first match:** city + area + budget + dates + gender rule. These are the hard constraints that most often empty a result.
- **Habits** refine; they rarely make the difference between zero and some matches in a small pilot. *Hypothesis; ENG-58 measures it.*

### 4.3 Funnel tracking spec (ENG-58; no PII)

| Event | When | Properties (allowed) |
|---|---|---|
| `join.viewed` | `/join` opens | `flowVersion`, `source` (utm or ref, ≤ 64 chars) |
| `join.code_sent` / `join.email_confirmed` | Steps 1–2 | `flowVersion` |
| `join.step_viewed` / `join.step_completed` | Each screen | `step` (screen id), `index`, `flowVersion`, `msOnStep` (bucketed) |
| `join.step_skipped` | Skip on optional or deferred steps | `step` |
| `join.submitted` | Submit | `flowVersion`, `city` |
| `application.call_booked` / `application.approved` / `application.activated` | Lifecycle | `daysSinceSubmit` |
| `prefs.deferred_answered` | A "Better first matches" answer | `step` |
| `discover.first_viewed` | First Discover after activation | `resultCountBucket` (0, 1–2, 3–5, 6+) |

- Key: an anonymous `funnelId` per application, never the user ID, email or answers.
- Retention: 12 months.
- Report: completion per step per flow version per city.

---

## 5. Decisions for the founder (all **approved 21 Nov 2026** as recommended)

**Approved:**
- **D-R1:** verification-first, with self-serve booking and non-personal value before applying.
- **D-R2:** up to 3 pending outgoing proposals; exclusive only when both confirm; other pending proposals close with a neutral notice.
- **D-R3:** "Apply to join" primary, with Sign in in the header.
- **D-R4:** explicit deal-breakers with an exclusive "No deal-breakers" option and no pre-selection.
- **D-R5:** the 6-screen application; habits and stay while waiting for the call; journey just in time; the address field removed.

**Still open:** F-26, the booking tool (founder.md).

| ID | Decision | Options | **Recommendation (approved)** | Blocks |
|---|---|---|---|---|
| **D-R1** | Verification timing | A. Verification first (today). B. Limited, consented preview, then verification before any contact | **A for the pilot, with the call made easy** (self-serve booking ENG-60, clear explanation DES-32, the habits step during the wait). Add non-personal value before applying: live counts per area and month, no profiles. Revisit B after round 2 with SEC-19. *Why:* real strangers, a small pilot, and the call is the trust promise participants valued | SEC-19 (only if B) |
| **D-R2** | Household exclusivity | A. One pending at a time (today, but fix the message). B. **Several pending; exclusive only when both confirm; other pending proposals close neutrally** | **B**, with up to 3 outgoing pending proposals. Nobody sees anyone else's pairings | ENG-52 (rule), DES-26 |
| **D-R3** | Landing primary action | A. Apply to join. B. Sign in. C. Waitlist | **A, "Apply to join"**, with sign-in in the header. Waitlisting is automatic for other cities | DES-27 final copy (layout starts now) |
| **D-R4** | Deal-breaker semantics | A. Keep accepted-set ("untick"). B. **Select deal-breakers + explicit "No deal-breakers"; skipped stays distinguishable; no pre-selected own answer** | **B** (storage unchanged for matching) | ENG-56, DES-29, ENG-57 |
| **D-R5** | The minimum application set | §4.1 as proposed, or keep everything upfront | **§4.1**: 6 screens, then habits and stay while waiting, journey just in time, location removed | ENG-57, DES-30 |

**Start now (not blocked):**
- ENG-50, ENG-51, ENG-54, ENG-55, ENG-58, ENG-59, ENG-60 (after F-26);
- the ENG-52 copy fix;
- DES-25, DES-27 layout, DES-28, DES-31, DES-32, DES-33;
- SEC-16, SEC-17, SEC-18.

---

## 6. Round 2 test plan

- **Set-up:** staging (beta mode), **seeded test profiles** (clearly test accounts, never shown in production) across combinations:
  - 3 Lagos areas × 2 budget bands × 2 move-in windows;
  - one women-only preference;
  - one seed with **no possible match** (an empty state);
  - one person who has already proposed elsewhere (tests D-R2);
  - one person who sends the participant a message during the session.
- **Participants:** 5–6 new people, not from round 1, on their own phones (one low- or mid-range Android at 360 px). They choose their own area, budget and dates.
- **Unguided tasks:**
  1. five-second test of the landing;
  2. apply;
  3. book the call;
  4. find your invitation (it lands in Promotions on purpose for one participant);
  5. find someone suitable;
  6. reply to the incoming message;
  7. change area or budget;
  8. propose a household;
  9. withdraw it.
- **Success metrics (*proposed targets*):**
  - five-second test: ≥ 4 of 5 name what it is and what to do;
  - task success ≥ 80% per task without help;
  - application time-on-task median ≤ 6 minutes (new flow);
  - notification → thread in 1 tap for 100%;
  - zero participants confused about proposal vs household;
  - SUS-style ease rating recorded.
- **Also log:** step drop-off (ENG-58), errors and quotes (paraphrased, no names in the repo).

---

## 7. Owners and parallel work (to avoid collisions)

| Stream | Owner | Tickets | Files they own |
|---|---|---|---|
| E1, messaging | Engineer | ENG-50, ENG-51 | `prisma/schema.prisma` (notifications and reads), `app/api/v1/notifications/*`, `app/api/v1/conversations/*`, `lib/audit.ts` (`notify` signature) |
| E2, application | Engineer | ENG-54, ENG-55, ENG-58, then ENG-57 | `app/api/v1/applications/*`, `components/apply/useProfileDraft.ts`, `lib/applications.ts`, `lib/matching.ts` (ENG-57 only) |
| E3, households and Discover | Engineer | ENG-52, ENG-59, ENG-60 | `app/api/v1/households/*`, `lib/household.ts`, `app/api/v1/me/search/*` (chips save) |
| D1, landing | Designer | DES-27, DES-33 | `app/page.tsx`, `components/landing/*` |
| D2, in-app UI | Designer | DES-25, DES-26, DES-31 | `components/AppNav.tsx`, `app/(app)/discover/page.tsx` (visual layer), `app/(app)/household/page.tsx` (visual layer) |
| D3, apply and status | Designer | DES-28, DES-29, DES-30, DES-32 | `components/apply/StepBody.tsx`, `components/apply/QuestionFlow.tsx`, `app/join/status/page.tsx` |

**Shared-file rule:** for `discover/page.tsx`, `household/page.tsx` and `join/status/page.tsx`, the engineer lands the data and API changes first, then the designer does the visual pass on top. One PR at a time per file. **Schema changes only through the engineer.**
