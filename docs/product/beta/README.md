# Peabudy beta: work pack index

| | |
|---|---|
| Status | **Draft for execution. Not yet approved scope.** Written 9 Nov 2026 by product-manager; updated 9 Nov 21:30 for the domain and the rename; **re-planned 10 Nov for the founder's live-launch direction (next section). Where older sections conflict with it, the live launch plan wins** |
| Name | **Peabudy** (renamed from Housemate by the founder, 9 Nov 2026). Brand text in these packs says Peabudy. Code identifiers keep their names: the repo, the `housemate-platform` Vercel project, `housemate_db`, `hm_session`, test email patterns. The name is subject to the check in F-17 / D13 |
| Domain | **`peabudy.com`, bought on Vercel on 9 Nov (F-01 done).** Sender: `Peabudy <hello@peabudy.com>` (F-02). Site: `https://peabudy.com` once the founder points it at the project (F-02 part F) |
| Parent plan | [`../beta-launch-plan.md`](../beta-launch-plan.md). §3.1–3.2 and §10 there are superseded by founder decision D1 below |
| Files | [`engineer.md`](engineer.md) (ENG-01…28, about 38 days) · [`designer.md`](designer.md) (DES-01…12, about 9 days) · [`security.md`](security.md) (SEC-01…12) · [`founder.md`](founder.md) (F-01…F-17) · [`legal/`](legal/) ([privacy notice](legal/privacy-notice.md), [terms](legal/terms.md), [DPIA](legal/dpia.md): AI drafts with placeholders, not legal advice) |
| Founder decisions folded in (9 Nov) | **D1:** real people only, London + Lagos, 11 Nov. **Email:** buy a sending domain; `vercel.app` can't be verified with Resend (F-01 done: `peabudy.com`; F-02). **Name:** Peabudy. **Legal:** Claude drafts the notice, terms and DPIA (`legal/`), with an AI-draft banner and placeholders; counsel reviews them. **Back office MVP:** ENG-07, 11, 13, 16, 21–24 · DES-11 · SEC-12 |
| Visual source | [`../../design/design-system.md`](../../design/design-system.md) (being written in parallel), plus the designer's Peabudy rebrand (in progress). No fast-track ticket depends on adopting either |

---

## Live launch plan (10 Nov)

**In one line (updated 10 Nov, late):** the live beta opens in **Lagos** on **Wed 18 Nov 2026** (go/no-go Tue 17 Nov 18:00), with approval-first sign-up, using the staff video identity check, with Didit-automated checks from about Fri 27 Nov and London later.

**Founder direction (10 Nov 2026):** research mode isn't coming back. Production goes straight to `beta` (real people) with the features we have. It must be fully tested and ready for live sign-up. The link goes to a few people; feedback comes through the Feedback button; and we keep every user's email so we can send a follow-up survey.

**This supersedes:** the Option A/B/C framing, the 11 Nov fast-track and its go/no-go, the Tally waitlist as the public entry point, the public announcement (DES-08), and anything that assumes a rollback to research mode.

### Approval-first sign-up (10 Nov, late): **approved, build started**

Sign-up is now an **application** that staff approve before anyone can sign in. The spec is in [`approval-first-signup.md`](approval-first-signup.md).
- **Tickets:** ENG-39–45, DES-20–23, SEC-15. They replace ENG-37/38's request-access and invite-gated sign-up, and DES-17.
- **The founder approved F1–F4 on 10 Nov ("Approve all, start"):**
  - **F1:** launch in **Lagos on Wed 18 Nov**, with **go/no-go on Tue 17 Nov 18:00**. Thu 12 Nov is a build checkpoint, not a go/no-go.
  - **F2:** the video ID call is part of approval.
  - **F3:** declined applicants get a kind, generic email and can reapply after 30 days.
  - **F4:** London applications are waitlisted.
- **This supersedes** every "Fri 13 Nov" launch date, "Thu 12 Nov 18:00" go/no-go and "Mon 16 Nov" fallback elsewhere in this file. It also replaces go/no-go criterion 3 (below).

**Revised timeline:**

| When | Step | Owner |
|---|---|---|
| Wed 11 – Fri 13 Nov | Build ENG-39–45 and DES-20–23. The other launch tickets continue (ENG-25, 29, 31, 33, HM-26, DES-19) | E, D |
| **Thu 12 Nov** | **Build checkpoint:** `/join` steps 1–2 and `requireMember` on staging; the founder's F-03/F-04 done; Lagos outreach list started | E, F, PM |
| Fri 13 Nov | Code complete for ENG-39–43; SEC-15 review starts | E, S |
| Sat 14 – Sun 15 Nov | Buffer; the founder rehearses a full application → video call → approve on staging | F |
| **Mon 16 Nov** | **Code freeze 12:00**; T1 + T2 (with spec §6 cases 1–16) on staging; T3 real-inbox test (E0–E3 emails); T4b responsive; T4c data-light | E, D, F |
| Tue 17 Nov | T4 real devices (a 360 px Android first) 10:00–14:00; fix only P0/P1; SEC-15 + T5 sign-off by 17:00; **go/no-go 18:00** | F + helper, S |
| **Wed 18 Nov** | 09:00 `switch-to-beta.sh` + smoke test → about 09:30 **domain cut-over** (founder.md F-24: attach `peabudy.com` + `www`, redirect `gethousemate.vercel.app`, check HTTPS, email links and the OG preview; update links in Tally, socials and the invite message) → 12:00 UK / 13:00 Lagos: share `https://peabudy.com/join` with the Lagos list; review applications from the afternoon. **Never attach the domain before the switch** | F |
| From Wed 18 Nov | Daily: applications (contact within 24 h, decide within 72 h), reports, feedback, 429 counts, bounces | F |
| After launch | ENG-36 survey sender + F-21 (first send 7 days after the first activations); Didit (ENG-35) by about 27 Nov; research database deletion only on the founder's explicit go-ahead | E, F |

**Performance criterion (T4c) now includes the DES-24 photo city cards:**
- each card ≤ 60 KB at 360 px (*proposed*);
- lazy-loaded with a placeholder;
- the city step usable on Slow 3G before the photos load.

**F-23 (photo rights) must be confirmed** before the photos ship.

**Go/no-go criterion 3 (replaced):** spec §6 cases 1–16 pass on staging-as-beta, **plus the ENG-46 cases (back office only):**
- staff land on `/staff` with no user nav or Feedback pill;
- staff get 404 from user APIs and are redirected from user pages;
- staff never appear in matching;
- the founder's separate user account has no `/staff` access.

SEC-15 must also be signed off. All other criteria in L6 stand, with these changes:
- criterion 9 now reads "at least 8 Lagos people lined up to apply in one cluster";
- the D13 deadline moves to Tue 17 Nov 12:00.

### Founder decisions, 10 Nov evening (these override L2, L5's sending plan, L7 and L6 where they conflict)

**Correction:** earlier today I marked D15 and D17–D20 as "decided" on the strength of a general "I go with your recommendations". That was wrong. Only the table below is founder-approved.

| ID | Decision | Status |
|---|---|---|
| D4 | Staff video ID check, mandatory at launch | Approved |
| D11 | Publish the AI-drafted notice and terms **clearly marked "Draft, pending legal review"**. Reviewer: **[LEGAL REVIEWER NAME, founder to fill]** | **Accepted for launch** |
| D15 | **Invite-only** (below) | **Approved (changed from my recommendation)** |
| D16 | Survey opt-in (unticked, timestamp and version), unsubscribe link, Tally Free | Approved |
| D17 | **A branded survey email** (HTML + plain text) sent through Resend from a staff-only, audited "Send survey" action, to opted-in users only, with an unsubscribe link | **Approved (changed)**. Replaces the mailbox send and the CSV export |
| D18 | Launch Fri 13 Nov in Lagos; go/no-go Thu 12 Nov 18:00; fallback Mon 16 Nov | Approved |
| D19 | Research mode retired; staging on its own beta database branch | Approved. **Deleting the old research database needs the founder's explicit go-ahead later, as a separate step after launch** |
| D21 | Lagos first | Approved |
| D22 | Didit after launch (document + liveness + face match; no NIN/BVN; result only) | Approved |
| HM-26 | An honest, identical "busy" message for everyone above the site-wide cap; staff codes still sent. The waiting screen should be engaging (DES-18) | Approved |
| D13 | The name "Peabudy" vs Peabody (F-17) | **Open: by Thu 12:00** |
| D20 | Invite in clusters | **Open. Recommended as the default rule for staff choosing whom to invite** (below) |

**D15, invite-only: how it works**
1. **Request access.** Anyone can visit `peabudy.com` and submit a short "Request access" form (`POST /api/v1/access-requests`):
   - first name, email, city, areas, move-in month, journey;
   - optional: "how did you hear about us", and a note of up to 300 characters;
   - the privacy notice is linked.
   - Every submission gets the same "Thanks, we'll be in touch" reply, so it never reveals whether an email already has an account.
2. **Staff pre-check** in a new "Access requests" tab (approve / decline / send invite). Approve if the request looks like a real person looking for a home in an open city and launch cluster, and not an agent or landlord advertising. **D20 default:** invite people whose city, areas and move-in month cluster with others (L8, L10). London requests are kept for later.
3. **Invite.** "Send invite" emails a personal link, `https://peabudy.com/invite/[code]`:
   - the code is **single-use, tied to that email**, and expires in 14 days;
   - "Copy link" is there too, for WhatsApp.
4. **Sign-up.** `request-code` checks the invite for any email without an account:
   - no invite → **403 `INVITE_REQUIRED`**;
   - an invalid, expired, used or other-email code → **422 `INVITE_INVALID`**.
   - **Existing accounts don't need an invite** (they still get a sign-in code).
   - Staff (`ADMIN_EMAILS`) are exempt.
5. **Emergency stop.** `SIGNUPS_PAUSED` is kept as an emergency stop: it pauses access requests and invite redemption. `OPEN_CITIES` is dropped, because staff choose whom to invite.

**D17, survey sending: recommendation**
- Send from a **separate sending subdomain, `updates.peabudy.com`**: `Peabudy <hello@updates.peabudy.com>`, with Reply-To `hello@peabudy.com`, and a separate Resend API key restricted to that subdomain.
- A batch send must never hurt the reputation of the sign-in codes from `peabudy.com`.
- Include the `List-Unsubscribe` and `List-Unsubscribe-Post` (one-click) headers. That's a founder DNS task (F-21).
- The survey isn't needed until Fri 20 Nov, so this ships **after launch**.

**Is Fri 13 Nov at risk? Yes.**
- Invite-only adds two launch-critical builds: access requests with a staff tab (ENG-37), and invite codes with the `/invite` landing (ENG-38). That's about 2.5 engineer-days on top of about 4 already planned, in roughly 2 working days.
- **To keep Friday possible:**
  - the automated "Send invite" email may fall back to staff copying the link and sending it personally;
  - the survey sender (ENG-36) and the playful busy screen (DES-18) are after launch. The honest busy message itself is launch-critical.
  - The go/no-go criteria don't change.
- My estimate: **Mon 16 Nov is now more likely than Fri 13 Nov.** Decide on the evidence at Thu 18:00.

**Responsive (founder request, 10 Nov):** the designer runs a full responsive pass (DES-19), with results in `docs/design/responsive-qa.md`. Widths:
- phones: 320, 360, 375, 390, 414 and 430 px;
- tablets: 768, 820 and 1024 px, portrait and landscape;
- desktops: 1280, 1440 and 1920 px.

### Recommended launch date: **Fri 13 Nov 2026**, with go/no-go on Thu 12 Nov 18:00 and Mon 16 Nov as the fallback

11 Nov isn't realistic for "fully tested":
- The legal placeholders (F-04) and the mailbox (F-03) are still open.
- ENG-04, HM-08, HM-23 and HM-25 are in progress.
- Staging isn't running in beta mode yet.
- The new requirements are new work: survey opt-in, feedback fixes, a sign-up pause switch, and a full beta test pass on real phones.

### L1. Mode

- **Decision (recommended): production goes to `beta` once, and stays there.**
  - Personas, sample worlds and demo bots stay in the code, dormant (`DEMO_MODE` is forced off in beta, `lib/env.ts`).
  - **Not needed any more:**
    - HM-22 (Clarity masks for research production)
    - HM-14 (research on-screen codes)
    - the research half of HM-18
    - DES-07's waitlist as the entry point
    - D6 (the separate demo deployment)
- **Rollback changes.** `scripts/switch-to-research.sh` is retired: the engineer deletes it or makes it refuse to run (ENG-33). Vercel "Instant Rollback" to a deployment from **before** the beta switch would bring research mode back. So:
  - roll back only to earlier **beta** deployments;
  - for an emergency, use the sign-up pause switch (ENG-32), plus suspensions (F-09).
- **Staging becomes the permanent beta rehearsal environment** (ENG-33).
  - Staging gets its own Neon branch, `beta-rehearsal`, with no seed data. The seeded demo people on `staging` would appear as real, verified users in beta.
  - It uses `APP_ENV=beta` and a staging-only Resend key.
  - The research and gender e2e suites keep running locally, because that code still exists.
- **The research database** (the old production, with real testers' sample worlds) stays as it is. No emailing those testers: they never opted in. Delete it only after launch, as a separate step, when the founder explicitly says to (D19), and in line with the research consent terms.

**Rollback for a live beta (HM-27; recommendation: retire `switch-to-research.sh`, don't fix it).** Research mode isn't coming back, so the script has no job. ENG-33 makes it refuse to run. The real rollback ladder, from least to most drastic:
1. **Vercel Instant Rollback to the previous beta deployment.** Never to one built before the beta switch.
2. **`SIGNUPS_PAUSED=true`** plus a redeploy. New people stop; users carry on.
3. **Suspend accounts** (F-09).
4. **Take the site offline:** turn on Vercel Deployment Protection (dashboard, no code) while you fix things.

No maintenance page is built for launch. With a handful of people, a personal message does the job better.

### L2. Sign-up control (**superseded by D15, invite-only**, at the top of this plan. Kept: the rate-limit notes, HM-26 and Lagos shared IPs)

**Recommendation: no invite allowlist.** Instead, use four layers:
1. **The identity gate (exists):** an unverified account sees nobody and can't be seen (HM-01).
2. **HM-08 rate limits:** per IP (/64 for IPv6) and site-wide; staff are exempt.
3. **A new sign-up pause switch** (ENG-32, XS): `SIGNUPS_PAUSED=true` stops new accounts with an honest message, while existing users carry on.
4. **Staff verify invited people first.**

Why not an allowlist:
- The identity gate already gives the safety an allowlist would.
- An allowlist adds per-invite admin.
- It blocks the friends-of-friends the founder wants.

**If the link spreads:**
- Strangers can sign up, but they wait, unseen, in the queue (copy: DES-04).
- **Pause sign-ups** when the queue has more than 20 people waiting, or anyone has waited more than 72 h. Redeploy to apply (about 2 minutes).
- Reports or scam messages trigger the F-09 runbook.

**HM-26 (founder decision; recommendation: yes).** Above the site-wide login-code cap, users are currently told "sent" while nothing is sent. That's a false statement at the worst moment.
- Return an **honest, generic 429 to everyone**: "We're getting a lot of sign-in requests right now. Try again in an hour." It's the same for every address, so it reveals nothing about who has an account.
- Staff codes are still sent behind it.
- Runbook line for staff: "If users report this message, check the `ip_limited` / site-wide 429 counts in the audit log and raise the cap or pause sign-ups."

**Lagos shared IPs.** Mobile carriers in Nigeria commonly put many people behind one IP (carrier-grade NAT; *Assumption*, widely reported, not measured here). The per-IP limits (HM-08) could therefore block real people.
- Check the `ip_limited` 429 count daily in week 1.
- If any appear on a day with fewer than 20 sign-up attempts, raise the per-IP limit rather than ask people to retry.

### L3. Identity check (D4)

**Recommendation: keep it mandatory for launch.**
- Peabudy introduces strangers who may end up living together. The check is the only thing between an anonymous sign-up and a real person's profile.
- It's also what makes "unverified people see nobody" work.
- `CLAUDE.md` §2.8 rules out any fake or automatic verification in beta.

**Workload for a few users:**
- About 15 minutes each, including booking: about 2.5 h for 10 people and 5 h for 20.
- Book calls from the real `hello@peabudy.com` mailbox (F-03).
- Check the queue at about 09:00, 13:00 and 19:00.
- Contact people within 24 h and decide within 72 h.

**What the person sees while waiting** (DES-04 pending state, ENG-02):
- They can finish and edit their profile, and use Feedback.
- They see no one.
- Copy: "We check everyone's ID on a short video call before they can see anyone. We'll email you from hello@peabudy.com within a day to book a 10-minute call."
- There's no automatic email yet (ENG-12), so the founder's personal email does this job.

**Automated identity check (Didit) comes after launch.** See L9. Launch day uses the staff video check: nothing new to build, and no biometric data leaves the call.

### L4. Feedback button in beta

I checked the code on 10 Nov.

**What works:**
- `POST /api/v1/feedback` has no mode gate, so it works in beta. When signed in, it stores `userId` through `getCurrentUser()`.
- With `NEXT_PUBLIC_FEEDBACK_URL` unset, the pill opens the built-in dialog (`components/ResearchTools.tsx`).
- Staff read the latest 100 items at `/staff`, through `GET /staff/research`, which needs `requireStaff()`.

**Gaps (ENG-31, DES-14):**
1. **The dialog is wrong for signed-in users.** It says "your anonymous tester ID" (`ResearchTools.tsx:138`), but signed-in feedback is linked to the account. That's dishonest, and it contradicts the privacy notice.
2. **Staff can't see who sent feedback.** The list shows the browser tester ID, page, rating and time, but not the user (`staff/page.tsx:93–103`). The founder can't follow up.
3. **Signed-out feedback is unlimited.** Without a tester ID there's no rate limit (HM-13). Once the site is public, it's a spam route into the console.
4. **The data rights don't cover it.** Feedback isn't in `/me/export`, and it isn't deleted or anonymised when an account is purged (HM-17).
5. **The labels are wrong for beta.** The staff section is called "User research", with "Testers", "Via demo persona" and "Moved in (demo)" counts. Only the latest 100 items show, with no paging.
6. The pill is hidden on chat threads and onboarding (the top bar has a Feedback button there). That's fine.

### L5. Follow-up survey emails

**Position (not legal advice; counsel confirms in F-05):**
- **UK, PECR reg. 22:** unsolicited *direct marketing* by email to individuals needs consent.
  - From memory, and not re-checked today: ICO guidance treats genuine research as outside direct marketing, but says a survey that also promotes the organisation, or collects data for marketing, falls inside it.
  - A survey from the service someone uses is arguable either way.
- **UK GDPR:** whichever way that goes, emailing people needs a lawful basis.
- **Nigeria, NDPA 2023:** requires consent to be freely given, specific, informed and unambiguous, and gives people a right to object to direct marketing.
- **The founder approved this plan on 10 Nov:**
  - an unticked opt-in, stored with a timestamp and version;
  - an unsubscribe link;
  - an audited, staff-only CSV export;
  - Tally Free for the survey.
- **Decision (founder-approved 10 Nov):** treat survey emails as **consent-only** in both countries. It removes the ambiguity, it's what the founder wants anyway, and it's cheap.
- **What "we keep every email" means:** we keep the account email for running the account, because sign-in needs it. We **only email a survey to people who opted in.** Everyone can still use Feedback, and see an in-app survey link later (ENG-15).

**The opt-in (ENG-29, DES-13):**
- **Where:** on `/signin`, below the required privacy box. It's optional and **unticked**:
  "☐ Email me a short survey about my experience (about once, maybe a reminder). Optional — you can stop any time in Settings."
- **Records:** `surveyConsentAt`, `surveyConsentVersion` (e.g. `survey-v1`) and `surveyConsentWithdrawnAt`, with an audit row (`consent.survey_granted` / `consent.survey_withdrawn`).
- **Withdrawal:** a Settings toggle shows and changes it.
- **Unsubscribe link (founder-required):**
  - Each person gets a personal link: `https://peabudy.com/unsubscribe/survey?t=<HMAC(userId|survey)>`, the token design from ENG-12.
  - `GET` shows a confirmation button; `POST` withdraws. That way, link scanners can't unsubscribe people.
  - It works without signing in.
  - The export includes each person's `unsubscribe_url`, so the founder's mail merge can put it in every email.
- **Why sign-in and not onboarding:** it captures the people who drop out of onboarding, and their feedback matters most.
- It's never pre-ticked, never bundled with the terms, and never required.

**The export (ENG-30):**
- What: a staff CSV of opted-in users, **admin role only**, at `/staff`.
- Columns:
  - email
  - first name
  - city
  - account created (date)
  - verified (yes/no)
  - furthest stage (signed up · published · verified · intro sent · chatting · household)
  - consent date and version
  - `survey_ref`: an HMAC of the account ID, so Tally answers can be linked without exposing internal IDs
  - `unsubscribe_url`
- Who's excluded: people who withdrew, `deletion_pending`, `suspended`, staff and demo bots.
- Audit: `staff.export_survey_optins`, with the row count only and no emails.
- Headers: `Cache-Control: no-store`.
- **Rules for using it:**
  - Only the founder (admin) uses it, only to send the survey and one reminder.
  - Download it just before sending and delete it afterwards.
  - Never put it in the repo, chat or a shared drive.
  - Check it against a private suppression list of people who replied "stop".

**Sending (D17):**
- **Recommendation for the first ≤ 50 people:** the founder sends from the real `hello@peabudy.com` mailbox (F-03, Google Workspace or Zoho), one person per email (mail merge or by hand). No BCC blasts.
  - It's the most personal approach, people's replies come straight back, there's nothing to build, and it keeps login-code traffic separate.
- **Above about 50**, move to Resend Broadcasts on a separate subdomain (`news.peabudy.com`), with one-click unsubscribe. *Not checked today:* how Broadcast unsubscribes would sync back to the app.
- **Each email says:**
  - why they're getting it ("you ticked 'email me a short survey' when you signed up");
  - that it takes about 4 minutes;
  - the link;
  - how to stop: reply "stop", or untick in Settings.
- **Timing:** day 7 after sign-up, at most one reminder on day 10, then stop. The first send is around **Fri 20 Nov**, which is why ENG-30 can ship after launch.

**The survey:**
- The 12 questions in [`../beta-launch-plan.md`](../beta-launch-plan.md) §7.2, hosted on **Tally (free plan:** hidden fields and unlimited responses; DPA still to confirm, F-06).
- Hidden fields: `ref` (= `survey_ref`), `city`, `stage`.
- Changes from the draft:
  - Q4 and Q11 say "Peabudy".
  - Q8 adds "I'm still waiting for my check".
  - Q12 becomes "Can we contact you for a 20-minute call? Yes / No", without asking for the email again; `ref` links it.
- Final wording is in DES-07.
- **The privacy notice draft is updated** (`legal/privacy-notice.md`): survey consent data, purpose and lawful basis, the mailbox provider as a recipient, and retention.

### L6. "Fully tested": the launch test plan

| # | Test | Who runs it | Where | Exit criterion |
|---|---|---|---|---|
| T1 | `npm run typecheck`, `npm run test:unit`, the research and gender e2e suites | Engineer | Local | All pass |
| T2 | **`tests/e2e_beta.py`, extended (ENG-10)**. Login codes are read from the database. Must cover: sign-up with consent and the survey opt-in on and off · onboarding to publish · pending account sees nobody, and is invisible · staff approves identity, then two verified users see each other · intro send, accept and decline · chat, plus the money-request caution · block (404 both ways, intros expired) · report · household agreement propose, accept, change and re-accept · homes, viewings and move-in return 404 · feedback signed in (linked) and signed out (rate-limited) · survey opt-in withdrawal · `/me/export` includes feedback and consent · deletion (`deletion_pending` can't sign in) · **access request (same reply for new and existing emails; rate-limited) → staff approve → invite → `/invite/[code]` → sign-up · new email with no invite gives 403 `INVITE_REQUIRED` · a used, expired or other-email code gives 422 `INVITE_INVALID` · an existing user signs in without an invite · HM-26 busy message identical for every email, with staff still getting codes** · `SIGNUPS_PAUSED` stops access requests and invite redemption but not users | Engineer | Local beta, **and staging-as-beta** | All pass on both |
| T3 | **Real-inbox test** (F-02 part H) | Founder | Staging-as-beta | Gmail inbox; SPF, DKIM and DMARC pass at Gmail, Outlook and Yahoo; Outlook or Yahoo junk acceptable only with the "check junk" copy |
| T4 | **Manual pass on real devices**, using the same scenario list as T2, as two real people talking to each other, plus the staff approval on a laptop. **Device priorities:** (1) a low- or mid-range **Android at 360 px** (e.g. Tecno or Infinix, Chrome), the most important one for Lagos; (2) an **iPhone** (Safari); (3) an **iPad or Android tablet**, if available | Founder + one helper (agents can't hold devices). The designer supplies the checklist and reviews screenshots | Staging-as-beta | No P0 (data exposure; can't sign in; can't finish a core step) and no P1 (trust or safety copy wrong; a step broken on one device). P2s are logged |
| T4b | **Responsive matrix** (DES-19): 320–430 px phones, 768/820/1024 tablets in both orientations, and 1280/1440/1920 desktops, recorded in `docs/design/responsive-qa.md` | Designer | Staging | No horizontal scroll, and nothing clipped or overlapping, at any listed width. Touch targets ≥ 44 px. Inputs ≥ 16 px (stops iOS zoom). Chat usable with the keyboard open |
| T4c | **Data-light check for Lagos:** the transfer size of the landing and sign-in pages, and a load on a Lighthouse or DevTools "Slow 3G" profile | Designer + engineer | Staging | *Proposed targets, no baseline:* the landing is usable (text and the main button visible) within 5 s on Slow 3G; the transferred size of each page is recorded; the mascot animation never blocks sign-in |
| T5 | Security sign-off: HM-08, 23, 25 and 26 closed; HM-13 closed; ENG-29/31/32/37/38 reviewed; no open Blocker or High | Security reviewer | Code + staging | Written sign-off |
| T6 | Launch-day smoke test (the ENG-08 list) | Founder | Production | All ticked |

**Go criteria for Thu 12 Nov 18:00 (revised 10 Nov evening; all must hold):**
1. T1–T5 pass (including T4b and T4c), with no open P0/P1 bug and no open Blocker/High security finding.
2. F-03 (a real mailbox) and F-04 (placeholders) are done. ENG-25 publishes the notice and terms **marked "Draft, pending legal review"**, with `privacy-v2` re-consent (D11).
3. **Invite-only works end to end on staging:**
   - access request (ENG-37);
   - staff approve and invite, by email or copied link (ENG-38);
   - `/invite/[code]` sign-up;
   - `INVITE_REQUIRED` and `INVITE_INVALID`;
   - existing users sign in without an invite.
4. The survey opt-in, the unsubscribe link and the Settings toggle work (ENG-29).
5. HM-26: the honest busy message is shipped (the playful DES-18 version can follow).
6. ENG-04: no score and no "Demo" wording in beta. Recommended: drop "phone" from the public checks list.
7. **`IP_HASH_SALT` is set in production.** HM-27 is handled by retiring the script (ENG-33). `SIGNUPS_PAUSED` has been tested.
8. The verification SOP (F-08) and the suspension runbook (F-09) have each been rehearsed once.
9. At least 8 approved Lagos access requests or invitees in one cluster (D20).
10. D13 decided in writing.

**No-go** if any of 1–7 fails. Fix it, re-test, and launch Mon 16 Nov. If 8–10 fail, launch only once they're done that day.

### L7. Timeline (owners: F founder · E engineer · D designer · S security · PM)

| When | Step | Owner | Est. | Critical path |
|---|---|---|---|---|
| **Tue 10 Nov**, by 12:00 | Remove the all-Preview `RESEND_API_KEY` | F | 2 min | Yes (safety) |
| Tue, by 15:00 | F-03: a real `hello@` / `privacy@` mailbox, not forwarding-only | F | 1 h | Yes |
| Tue, by 17:00 | F-04: fill the legal placeholders, including the survey rows | F | 1.5 h | **Yes** |
| By Thu 12:00 | Decide D11 and D13 in writing (the rest were decided 10 Nov) | F | 30 min | Yes |
| Tue | Finish ENG-04, HM-08, HM-23, HM-25 (in progress) | E | — | Yes |
| Tue, by 18:00 | ENG-33: staging on the `beta-rehearsal` branch in beta mode (the founder sets the dashboard variables) | E + F | 1 h | **Yes** |
| Tue, by 18:00 | DES-13 (opt-in and survey email copy), DES-14 (feedback copy), sign-offs (score removal, nav in chat, DES-04) | D | 2 h | Yes |
| Tue | F-17: name knock-out search; handles | F | 1 h | For D13 |
| Tue–Wed | Build the Lagos invite list in clusters (L10); draft the personal invite message (DES-08 replacement) | F + D | 1 h | Yes |
| Wed, by 13:00 | ENG-34 Nigerian money-request patterns; DES-03 Lagos scam wording | E + D | 2 h | Should (safety) |
| Wed | F-18: Didit account in sandbox; check the terms, region, retention, DPA and UK documents | F | 1 h | No (Didit is post-launch) |
| **Wed 11 Nov**, by 13:00 | ENG-29 opt-in · ENG-31 feedback fixes · ENG-32 pause switch · HM-26 honest busy message | E | about 1.5 d total, with Tue evening | **Yes** |
| Wed, by 18:00 | **ENG-37 access requests + staff tab · ENG-38 invite codes + `/invite` landing** (new) | E | about 2.5 d (**the main schedule risk**) | **Yes** |
| Wed | DES-17 invite landing, access-request form and invite email · DES-18 busy screen · DES-19 responsive pass (T4b) | D | — | DES-17 and DES-19 yes; DES-18 no |
| Wed, by 15:00 | ENG-25 interim legal pages + `privacy-v2` | E | 2 h | **Yes** |
| Wed, by 18:00 | T2 extended e2e_beta written and passing locally | E | 4 h | **Yes** |
| Wed | T3 real-inbox test on staging | F | 1 h | Yes |
| Wed | Build the Tally survey (DES-07); rehearse one verification call with a friend (F-08) | F | 2 h | No (survey needed by 20 Nov) |
| Wed–Thu | Review the new endpoints as they land | S | — | Yes |
| **Thu 12 Nov**, 09:00 | **Code freeze**; T2 on staging-as-beta | E | 2 h | **Yes** |
| Thu, 10:00–14:00 | T4 phone pass; fix only P0/P1 | F + helper, D, E | 4 h | **Yes** |
| Thu, by 17:00 | T5 security sign-off | S | — | **Yes** |
| Thu, 18:00 | **Go/no-go** (written) | F | 15 min | — |
| **Fri 13 Nov**, 09:00 | `switch-to-beta.sh` (with production `IP_HASH_SALT`, Resend key, contact address); T6 smoke test | F | 45 min | Yes |
| Fri, 10:00 | Founder and helper sign up for real, verify each other, see each other; then delete the test accounts | F | 30 min | Yes |
| Fri, 12:00 UK (13:00 Lagos) | **Live in Lagos:** approve and invite the first 10–20 Lagos access requests in a Mainland cluster (D20). Share the request-access link personally. Verification calls start in the afternoon | F | 1 h | — |
| After launch | **F-21 `updates.peabudy.com` in Resend** · ENG-36 "Send survey" action + DES-13 template by **Thu 19 Nov** · first survey **Fri 20 Nov** · DES-18 playful busy screen · ENG-12 email, ENG-11/21 moderation, ENG-07 queue by 27 Nov · **research database deletion only on the founder's explicit go-ahead** | E, D, F | — | Not for launch |
| Mon 16 – Fri 20 Nov | **ENG-35 Didit integration** (sandbox) · DES-15 consent and waiting states · F-19 counsel on biometrics and transfer | E, D, F | 2–3 d | Didit path |
| Mon 23 – Wed 25 Nov | SEC-13 Didit review; DPIA and privacy notice updated; Didit retention set; DPA signed | S, PM, F | — | Didit path |
| **Fri 27 Nov** | Didit go/no-go → live for new Lagos users; `CLAUDE.md` rule 8 updated in the same release | F | — | — |

**If the go/no-go fails** on anything fixable within a day: launch **Mon 16 Nov** (go/no-go Fri 13 Nov 17:00). Don't cut T2, T4 or T5 to hold the date.

**Code status (10 Nov):** ENG-04, HM-08, HM-23 and HM-25 are committed (8e6add6) and on staging. I haven't re-read the diff. The T2 and T5 tests confirm them.

**First week after launch (founder, daily):**
- the verification queue;
- reports;
- feedback;
- `ip_limited` and site-wide 429 counts (Lagos shared IPs);
- Resend bounces and complaints.

### L8. The risk that matters most after safety: empty results

*Fact:* matching has strict two-way hard constraints: same city, a common area, overlapping budget, dates and stay, accepted habits and gender (`lib/matching.ts`). *Hypothesis:* if 10–20 people spread across two cities and 12 areas, most verified people will see **nobody**. Their feedback will then be about an empty screen, not about Peabudy.

**Recommendation (D20):**
- Invite in **clusters**: at least 6–8 people per city who are looking in neighbouring areas within the same 2–3 months.
- Tell each person honestly that it's early and there are few people.
- Measure it: the share of verified users with at least one match (database query, ENG-16 later).
- **What would disprove the hypothesis:** at least half of the verified people in a cluster see a match.

### L9. Automated identity check: Didit, straight after launch (founder-approved 10 Nov)

**Decided:**
- **Scope:** document check + passive selfie liveness + 1:1 face match. **No NIN or BVN database lookups.** Explicit, separate biometric consent before the check starts.
- **What we store:** only the result (verified or not), Didit's session ID, the check date, a reason code on failure, and an "18 or over" yes/no. **Never** document images, selfies, document numbers or date of birth.
- **Retention at Didit:** set as short as its settings allow.
- **The rule changes when the integration ships, not before:** from "identity is granted only by staff approval" to "**staff or an approved verification provider (Didit)**". The engineer updates `CLAUDE.md` rule 8 in the same release as ENG-35. Until then, the staff video check is the only route.

**Facts checked** ([didit.me/pricing](https://didit.me/pricing), fetched 10 Nov 2026):
- The free plan is $0 a month, with no card, and "$10 of free credit every month" that doesn't roll over.
- List prices per check: ID verification $0.15, passive liveness $0.10, face match $0.05. Our bundle is **about $0.30 a person, so about 33 free checks a month.**
- The page lists NIN at $0.20 and BVN at $0.35 (not used).
- Data residency is listed as an Enterprise feature. Retention is "5 years" on Growth; nothing is stated for Free.

**Not verified, so F-18 checks on sign-up day:**
- the default storage region (the coordinator's research says EU/AWS);
- how short retention can be set on the Free plan;
- whether there's a DPA on the Free plan;
- support for UK documents;
- the 1 Nov 2026 terms change.

**Reported, not verified by me:** the NIMC Act 2026 and NIMC's NINAuth channel require the holder's consent before NIN data is shared. We avoid that risk entirely by not doing NIN or BVN lookups.

**How it works (ENG-35, about 2–3 days):**
1. On publish, a user sees a consent screen (DES-15).
2. We create a Didit session bound to their account.
3. Didit's hosted flow runs.
4. A signed webhook arrives.
5. The result is mapped to `VerificationCheck` (`category=identity`, `status=verified|rejected`, `method=provider:didit`).

Around that:
- Failures and "needs review" go to the staff queue. **Staff can override either way**, with an audit row.
- The video call stays as the fallback for anyone who can't or won't do the automated check.
- **Budget guard:** at more than 25 sessions in a calendar month, new sessions fall back to the video check unless the founder raises the cap.
- **Not a safety guarantee:** "Identity checked" means a document matched a live face. The fixed phrase "Checks completed — not a guarantee of safety" stays.

**Go-live target: Fri 27 Nov.** It needs ENG-35 built (16–20 Nov), SEC-13 sign-off, F-18 (account, DPA, retention), F-19 (counsel on biometric consent and Nigeria → EU transfer), the DPIA and privacy notice updated (`legal/`), and D22 (rule 8) confirmed with the release.

### L10. Lagos first (founder-approved 10 Nov)

**Why** (*Assumptions and hypotheses* unless marked):
- **Liquidity:** one city concentrates a few users (L8).
- **Documents:** Didit lists Nigerian documents (NIN card or slip, passport, driver's licence, voter card), per the coordinator's research. The staff video check works with any photo ID.
- **Fact:** NGN annual rent is already handled. Matching compares monthly equivalents (`lib/matching.ts`), and the new fonts render ₦ (rebrand commit 52d18a3).
- **Time zone (Fact):** Lagos is UK + 1 h in November, so calls between 08:00 and 22:00 UK work.

**What it costs us:**
- **The scam environment.** Fake agents, "inspection fees" and "agent fees" are common in Lagos rentals. *Assumption: widely reported, not quantified here.* So, before launch:
  - the safety card and caution copy get Lagos-specific wording (DES-03 update);
  - the money-request patterns gain Nigerian phrasing (ENG-34, XS);
  - HM-11 (showing the caution to the recipient) moves up to "should have for launch".
- **Legal:** NDPA 2023 applies from day 1. Hosting is outside Nigeria (Neon, Vercel, Resend's EU region), so counsel needs to cover cross-border transfer (F-05/F-19).

**Launch scope:**
- **Areas:** `lib/constants.ts` lists Yaba, Lekki, Ikeja, Surulere, Gbagada and Ikoyi.
  - **Recommendation (D12):** invite a Mainland cluster first (Yaba, Surulere, Gbagada). Add Lekki and Ikoyi only if the invite list clusters there.
  - Aim for at least 8 invitees with move-ins within the same three months.
- **London:** sign-up stays technically possible, but London accounts wait honestly.
  - ENG-32 adds `OPEN_CITIES=lagos`: London people finish their profile and see "We're starting in Lagos. We'll check your ID and open London later."
  - Staff don't verify London accounts until London opens.
- **Metrics (Lagos pilot, Fri 13 Nov – Fri 11 Dec; *proposed, no baseline*):**

| Metric | Target |
|---|---|
| Verified users | ≥ 10 |
| Median time from publish to identity decision | ≤ 24 h |
| Verified users with at least one match | ≥ 50% |
| Intros accepted / intros sent | ≥ 35% |
| Meaningful conversations (both sides ≥ 3 messages) | ≥ 3 |
| Survey opt-in rate at sign-in | report only |
| Survey completes / opted-in | ≥ 40% |
| Feedback items per verified user | report only |
| Unresolved safety-critical reports older than 24 h | 0 |
| Reports and blocks | report only |

### Decisions recorded (10 Nov)

| ID | Decision | Status |
|---|---|---|
| D4 | Identity check mandatory; staff video check at launch | **Decided (founder, 10 Nov)** |
| D16 | Survey: unticked opt-in at sign-in with timestamp and version, an unsubscribe link, an audited admin CSV export, Tally Free | **Decided (founder, 10 Nov)** |
| D21 | **Lagos first**, London later | **Decided (founder, 10 Nov)** |
| D22 | Didit after launch: document + liveness + face match, no NIN/BVN, explicit biometric consent, result-only storage, shortest Didit retention; rule 8 becomes "staff or an approved provider (Didit)" when ENG-35 ships | **Decided (founder, 10 Nov)** |
| D15, D17–D20, D11, D13, HM-26 | **Superseded:** see "Founder decisions, 10 Nov evening" at the top of this plan. My earlier "treated as decided" entries were wrong | — |

---

## Status (Mon 9 Nov, late evening; partly superseded by the live launch plan)

- **Done:**
  - F-01, and `peabudy.com` verified in Resend (EU region; DKIM, SPF, DMARC `p=none`).
  - Staging email variables are set.
  - On `main` and building on staging (52d18a3, 33f81c0): the rebrand, the new landing and onboarding, the mobile pass, ENG-01, ENG-02, most of ENG-06, ENG-08's script, HM-01–05 and HM-07, and the code email in Peabudy's name.
- **Code check (9 Nov):** two fast-track tickets are not done.
  - **ENG-04:** `members/[id]/page.tsx:72,107` and `profile/page.tsx:75` still show "Demo credibility X/100", in beta too.
  - **ENG-25 + privacy-v2:** `PRIVACY_VERSION` is still `privacy-v1`.
  - ENG-07 FT (areas in the staff queue) is also missing.
- **Before the production switch (security):**
  - HM-08: finish it.
  - HM-23: `IP_HASH_SALT`.
  - HM-25: switch-script ordering.
  - HM-22: Clarity masks, before any research production deploy, which includes a rollback.
- **Founder, open:** F-03 mailbox · F-04 placeholders · F-17 name check · D11 · D13. Remove the stray all-Preview `RESEND_API_KEY`.
- **Rehearsal database:** use a fresh Neon branch, `beta-rehearsal`, with no seeded people. Don't use `staging`.

## Who is doing what now (Mon 9 Nov, 21:30; superseded by L7 above where dates conflict)

| Who | Working on now | Must land before the go/no-go (Tue 10 Nov 18:00) | Deliberately **not** on the 11 Nov path |
|---|---|---|---|
| **Founder** | F-02 parts A–E tonight (Resend, DNS, env vars), then F-17 (name check, handles) | F-02 verified and part H passed · F-03 · F-04 placeholders by 12:00 · F-06 waitlist · F-08/F-09 rehearsals · D11 and D13 in writing | F-05 booking (by Wed), F-07, F-15 |
| **Designer** | Rebranding the UI to Peabudy; an interactive, mascot-led landing page and conversational onboarding (inspired by a conversational onboarding video); a mobile pass | The name styling and wordmark ENG-28 needs (tonight if possible) · DES-01 FT rows · DES-02 · DES-03 · DES-04 pending state · DES-07 waitlist · DES-08 announcement, all in Peabudy's name | **The mascot landing and the conversational onboarding.** The landing can ship after 11 Nov once it passes the honesty rules. Onboarding needs a PM review first (guardrails below) |
| **Engineer** | Repo clean-up; starting ENG-02, ENG-01, ENG-06, ENG-08 (the right order: ENG-02 closes the worst gap) | Those four, plus **ENG-28 (FT part)**, ENG-03 FT, ENG-04, ENG-07 FT, ENG-09, ENG-10 FT, ENG-25 interim | **Repo clean-up beyond what the FT tickets need.** It must not delay them; do the rest from Thu 12 Nov |
| **Security reviewer** | A full pre-launch loophole review | **SEC-11 fast-track sign-off by about 17:00 Tue**, with any blocker raised to PM and founder as soon as it's found, not at the end | High and Medium findings from the full review go into S1/S2 by severity (security.md) |
| **PM** | This update; F-08/F-09 rehearsals with the founder; reviewing the onboarding concept | Go/no-go pack for 18:00 | — |

**Guardrails for the mascot-led onboarding** (PM requirements for the designer; the full review follows when there's a concept):
1. It still collects every field matching needs (journey, city and areas, budget, move-in window, stay length, the six dealbreakers, gender and housemate preference) with the same meanings, or the engineer must change `lib/matching.ts` too. Any change to a question's options is a matching change, so bring it to PM.
2. The mascot never promises an outcome: no "I found your perfect match", "compatible", "safe" or percentage language. Gender and housemate preference stay private and are explained as private.
3. Every step works without the animation: reduced-motion respected, screen-reader labels, 44 px targets, 375 px first, and typing answers is never the only way to answer.
4. Consent, the privacy link and (later) the 18+ declaration stay explicit and separate. A chatty tone mustn't turn them into a pre-ticked or buried step.

## Timeline check after buying the domain (9 Nov, 21:30)

**Is the 10 Nov 16:00 email gate still realistic? The DNS part is. Inbox placement is uncertain. The bigger risk is now engineering capacity.**

| Step | Earliest realistic | Needed by | Verdict |
|---|---|---|---|
| F-02 A–E: Resend domain, records, keys, env | Tonight, about 45 min | Tonight | Realistic |
| Resend shows `peabudy.com` Verified | Tonight to 07:00 Tue. Resend says Auto Configure usually takes minutes, manual up to a few hours | **12:00 Tue (tripwire)** | Realistic |
| ENG-28 FT: the code email says Peabudy | Tue morning (S, but needs the name styling) | Before the rehearsal | Tight |
| ENG-08 + staging set up as beta | Tue around 13:00 | 14:00 Tue | Tight: the engineer is also doing ENG-02/01/06 and repo clean-up |
| F-11 / ENG-10 rehearsal with Gmail, Outlook, Yahoo | 14:00–16:00 Tue | **16:00 Tue** | At risk if anything above slips |
| Codes land in inboxes from a day-old domain | — | 16:00 Tue | **Uncertain.** *Assumption:* authenticated, low-volume, user-requested codes usually reach a Gmail inbox; Outlook and Yahoo may file a new domain's mail as junk. Warm-up takes weeks, so it can't be finished by 11 Nov |

**What changes:**
1. **Keep the 16:00 gate, with clearer pass rules** (founder.md F-02 part H): verified; SPF, DKIM and DMARC pass at all three providers; Gmail in the inbox; Outlook or Yahoo in junk is acceptable only with the "check junk" mitigation; any non-delivery or Gmail spam fails.
2. **Add a 12:00 Tue tripwire.** If Resend isn't verified, or ENG-02 and ENG-28 (FT) aren't on staging by 12:00, call Option C then, not at 18:00. The announcement still goes out on 11 Nov (pointing to the waitlist), and cohort 1 opens on Mon 16 Nov.
3. **Repo clean-up and the mascot work come off the critical path** (above).
4. **My honest read:** the email gate itself is achievable. The whole fast-track is now about 7 engineer-days (ENG-28 added) in about 1.5 calendar days with one engineer, while a rebrand is under way. The chance of Option B on 11 Nov is lower than it was this morning. Option C costs five days and buys the full rebrand, a warmer domain and counsel's first look at the name. I'm keeping B as the plan, with the go/no-go; if the 12:00 tripwire trips, take C without further debate.

---

## Read this first: what 11 November can and can't be (historical: superseded by the live launch plan, 10 Nov)

**Founder decision D1 (9 Nov 2026):** real people only, **London and Lagos**, launch on **Wed 11 Nov 2026**.

**Plainly: an open public sign-up, where anyone can register, browse and message real strangers, is not safe or honest to ship on 11 Nov.** The `CLAUDE.md` non-negotiables are:

- honest labels
- identity granted only by staff
- no fake verification in beta

Beta mode already meets the last two (*Fact:* `publish/route.ts` sets identity to `manual_review` and only `staff/verifications/[userId]` grants it). Honest labels can be met by 11 Nov **only if** the fast-track copy fixes ship (ENG-03, ENG-04).

These gaps can't be closed by 11 Nov:

| Can't be done by 11 Nov | Why | Risk if we open anyway | Safest stopgap |
|---|---|---|---|
| **Legal sign-off** on the privacy notice and terms (UK GDPR / DPA 2018 / PECR; Nigeria Data Protection Act 2023) | Needs counsel; it takes days to weeks. **Drafts are ready** in `legal/` (AI-written, placeholders, not legal advice) | Processing real people's data under unreviewed text. The current live notice also makes inaccurate statements: it says feedback is "anonymous, not your name" when signed-in feedback stores `userId`, and it names no controller or contact | The founder fills the placeholders (F-04). The engineer publishes the drafts as the **interim notice** (ENG-25). The founder accepts the risk in writing (D11). Invite-led cohort only. Counsel reviews by 4 Dec |
| **Transactional email** (ENG-12, 4 days) | Too big for 2 days | People won't know they've had an intro, so replies stall | The founder tells each cohort user personally (email or WhatsApp) when they're verified, and asks them to check the app daily. Cohort size is capped |
| **Domain + Resend verification** (*can* be done by 11 Nov; the domain is bought) | `vercel.app` can't carry the SPF/DKIM records Resend needs. Resend's test sender only reaches the account owner. On-screen codes would let anyone sign in as any address. **`peabudy.com` was bought on Vercel on 9 Nov (F-01 done)**; verification usually takes minutes to hours | **Hard blocker.** Beta login is email-only (`DEMO_MODE` is forced off in beta, `lib/env.ts`). If codes don't arrive, nobody can sign in. A day-old domain's deliverability is unproven | **F-02 tonight:** add `peabudy.com` in Resend, records on Vercel DNS (Auto Configure, or SPF/DKIM/MX plus DMARC), set `RESEND_API_KEY` and `EMAIL_FROM` (`Peabudy <hello@peabudy.com>`). Optionally serve the site from `peabudy.com`. If the 10 Nov rehearsal fails F-02 part H's pass rules, fall back to Option C |
| **Moderation UI** (suspend/restore, report resolution; ENG-11) | 2.5 days | Can't act quickly on abuse | A SQL suspension runbook (ENG-11 stopgap). The founder is on call. Cohort only |
| **Area-by-area opening** (ENG-13) | 4 days | 12 areas across 2 cities spreads liquidity thin | Staff approve verifications in **area cohorts** by hand (zero code). Invitations go only to people in 2–3 areas per city |
| **Clarity consent** (ENG-14) | Needs a banner | Breaks PECR and Microsoft's consent requirement (enforced for UK/EEA since 31 Oct 2025) | **Clarity off in beta** (leave `NEXT_PUBLIC_CLARITY_ID` unset in the switch script) |
| **IP rate limits and headers** (ENG-18) | 2 days | Abuse of the auth endpoints | Invite-led traffic. Per-email limits already exist (`request-code`: 5 an hour) |
| **Survey prompts** (ENG-15) | 2 days | Fewer survey responses | The founder emails the Tally survey link on day 7 |
| **Data export parity** (ENG-17) | 1 day | The "everything we hold" claim is untrue | Change the copy (DES-01 #27) and fulfil wider requests by hand |

### Options for 11 Nov

| | A. Open public beta, both cities, 11 Nov | **B. Public announcement + waitlist on 11 Nov; invite-only early access opens the same day (recommended)** | C. Waitlist only on 11 Nov; product opens 30 Nov |
|---|---|---|---|
| What the public gets on 11 Nov | Sign up and use the product | The announcement links to the **Tally waitlist** (both cities). A founder-invited **first cohort of up to 20 per city** gets the app link | The waitlist only |
| Who can use the product | Anyone | Invited people. Anyone else who finds the URL can sign up, but stays **pending and sees nobody** (ENG-02) until staff verify them | Nobody until 30 Nov |
| Meets the non-negotiables? | Only with the fast-track copy fixes | Yes, with the fast-track tickets | Yes |
| Safety and legal posture | **Not acceptable.** Unreviewed notice, no moderation UI, verification queue unbounded | Accepted by the founder, explicitly: small known cohort, live ID checks, interim accurate notice, founder on call | Best |
| Learning | Noisy (liquidity spread thin) | Real-to-real behaviour from day 1, in controlled areas | Two weeks of waitlist demand data only |
| Dependency | Everything | **Fast-track scope below, plus Resend working by 10 Nov 16:00 UK** | Full scope |

**Recommendation: B, with an explicit go/no-go at 18:00 UK on Tue 10 Nov.** If any fast-track exit criterion fails, run **C** for 11 Nov (the announcement still goes out, pointing to the waitlist) and open the product to cohort 1 on **Mon 16 Nov**.

**Full-scope date for comparison:** everything in §5 of the parent plan, adjusted for two cities:

- go/no-go **Fri 27 Nov**
- area-by-area opening from the waitlist starts **Mon 30 Nov**
- **open sign-up in both cities: Mon 7 Dec 2026**

The fast-track is roughly **5.75 engineer-days of work in about 1.5 calendar days**. That's feasible only with parallel work streams and the founder accepting a narrower QA pass (the 10 Nov rehearsal). That's the main schedule risk, and it's why Option C is the named fallback.

---

## Both cities: what changes from the single-city plan

| Topic | Change |
|---|---|
| Liquidity | Each city opens on its own schedule, **2–3 launch areas per city** at first. Opening is by verification cohorts until ENG-13 ships, then by the `AreaOpening` switch in the ops console. The density threshold is set per city and area: at least 10 published profiles with overlapping move-in months before an area opens (*Assumption*, to tune with the L1 analysis in the parent plan) |
| Money | *Fact:* matching compares **monthly-equivalent** budgets (`lib/matching.ts` `rentMinMonthly`), so London's GBP monthly and Lagos's NGN annual figures already compare correctly. Waitlist and survey questions ask each city in its own period (DES-07). Metrics report budgets in each city's own currency and period; currencies are never combined |
| Metrics | Every funnel number is **split by city** (ENG-16). Targets are per city (below). The readout decides continue or iterate **for each city separately** |
| Verification and moderation load | *Fact (time zones):* London is UTC+0 until late March and Lagos is UTC+1 (WAT) all year, so they're one hour apart in Nov–Mar. One cover window, 08:00–22:00 UK (09:00–23:00 Lagos), works for both. Load: cohort 1 is up to 40 people at about 15 minutes each, roughly 10 hours in week 1. **D9 (a second verifier) is urgent** |
| Legal scope | UK: UK GDPR, DPA 2018, PECR (cookies), and whether the ICO data protection fee applies. Nigeria: **NDPA 2023** and any NDPC registration or implementation requirements. Cross-border transfers (Neon and Vercel hosting regions vs Nigerian residents' data). The gender preference under the Equality Act 2010 and Nigerian law. Letting-agent status in both. *All for counsel; I haven't verified the specific thresholds* |

### Proposed targets (no baseline exists; the founder confirms them)

| Metric | Cohort 1 (11 Nov – 4 Dec), per city | Full scope (4 weeks after 7 Dec), per city |
|---|---|---|
| Verified users | ≥ 15 | ≥ 50 |
| Liquidity (verified with ≥ 1 match) | ≥ 50% | ≥ 60% |
| Intro accepted / intros sent | ≥ 35% | ≥ 35% |
| Meaningful conversations (both sides ≥ 3 messages) | ≥ 5 | ≥ 15 |
| Survey completes / verified | ≥ 40% (founder-invited) | ≥ 30% |
| Unresolved safety-critical reports older than 24 h | 0 | 0 |

---

## Fast-track scope (ships by 11 Nov, Option B)

| Ticket | What | Size | Owner |
|---|---|---|---|
| ENG-01 | Hide homes, viewings, application and move-in in beta (UI + server 404) | S | E |
| ENG-02 | **Beta: unverified viewers see nobody, and unverified targets are invisible** (new finding: today a pending account can call `/recommendations` and `/users/[id]` and see real verified people) | S | E |
| ENG-03 (FT part) | Beta copy wiring for DES-01's "FT" rows, plus a static safety note in every conversation | S of M | E + D |
| ENG-04 | Replace the 0–100 score with a list of completed checks in beta | S | E + D |
| ENG-06 | Auth fixes: `crypto.randomInt` codes, block sign-in for `deletion_pending`, re-consent when the privacy version changes | S | E |
| ENG-07 | Staff verification queue shows areas, move-in window and journey | XS | E |
| ENG-08 | `scripts/switch-to-beta.sh` and the env checklist (the founder runs it) | S | E → F |
| ENG-09 | Read-only checks of the beta database and staff sign-in | XS | E + F |
| ENG-10 (FT part) | Staging rehearsal with real inboxes | S | E + F |
| ENG-25 (FT part) | Publish the interim privacy notice and terms (`legal/` drafts, placeholders filled) in beta, plus the `privacy-v2` re-consent | S | E (after F-04) |
| ENG-28 (FT part) | **Peabudy rename** of the code email, sign-in, metadata/link previews, banner and legal pages (code identifiers unchanged) | S | E + D (name styling) |
| SEC-11 | Fast-track security review (10 Nov) | — | SR |
| DES-01 (FT rows), DES-02, DES-03 (text), DES-04 (pending state), DES-07 (waitlist), DES-08 (announcement) | Copy and content, in Peabudy's name | — | D |
| founder.md F-01 (done) … F-09, F-17 | Domain (bought), Resend, interim notice, Tally, runbooks, name check | — | F |

The 18+ declaration (ENG-05) moves to Sprint 1. Its stopgap is that the verification call confirms the person is 18+ from their photo ID, and staff approval already sets `adultEligible` (*Fact:* `staff/verifications/[userId]/route.ts`).

---

## Sprints to the 27 Nov go/no-go

| Sprint | Dates | Engineer | Designer | Security | Founder |
|---|---|---|---|---|---|
| **0 — fast-track** | Mon 9 – Tue 10 Nov | ENG-01, 02, 03 (FT), 04, 06, 07 (FT), 08, 09, 10 (FT), 25 (interim), 28 (FT) | Name styling for ENG-28; DES-01 (FT rows), 02, 03, 04 (pending state), 07 (waitlist), 08. Rebrand, mascot landing and mobile pass in progress, off the critical path | SEC-11 (gate), SEC-02; full loophole review under way | F-01 ✓, F-02…F-04, F-06, F-08, F-09, F-11, F-12, F-16 (D11, D13), F-17 |
| Launch | Wed 11 Nov | Switch support and smoke test | — | Watch | F-13 switch, F-14 announcement and cohort 1 invites, verification calls |
| **1** | Thu 12 – Fri 20 Nov | Back office first: ENG-24, 11, 21, 07 (SLA), 22, 16. Then ENG-12, 05, 10 (e2e_beta), 26, 27, 28 (rest); the rest of the repo clean-up | Mascot landing (after the honesty check); onboarding concept to PM review; DES-11, 05, 04 (rest), 09, 10, 12, 01 (rest), 07 (survey) | SEC-01, 03, 04, 05, 06, 07, 12 | Cohort 1 ops, F-05 counsel, F-07 registrations, F-10 purge SOP, F-15 second verifier |
| **2** | Mon 23 – Fri 27 Nov | ENG-13, 14, 15, 17, 18, 20, 23, 03 (rest), 19 (optional) | DES-06, 08 (open sign-up copy) | SEC-08, 09, 10, 12 (close), and the full go/no-go | Counsel's mark-up, runbooks v2 |
| | | **Capacity warning:** S1 + S2 hold about 30 engineer-days in 12 working days. That needs parallel streams or a second engineer; otherwise apply the cut line | | | |
| Go/no-go | **Fri 27 Nov** | All exit criteria in security.md met | | | Decides 30 Nov area opening and 7 Dec open sign-up |

---

## Dependency graph

```
F-01 domain (peabudy.com, done 9 Nov) ─► F-02 Resend DNS verified ─► ENG-08 switch script env ─► ENG-10 rehearsal ─► GO (10 Nov 18:00) ─► 11 Nov launch
designer name styling ─► ENG-28 rename (code email says Peabudy) ─► ENG-10 rehearsal
F-17 name knock-out search ─► D13 (announce as Peabudy, or cohort only) ─► GO
                                   └────► ENG-12 transactional email ─► ENG-13 area-opened emails
ENG-01 hide homes ─┐
ENG-02 verified-only browsing ─┼─► SEC-11 fast-track review ─► GO
ENG-03/04 copy + checks list ◄── DES-01/02/03/04
ENG-06 auth fixes ─┘
legal/ drafts ─► F-04 founder fills placeholders ─► ENG-25 interim notice + ENG-06 privacy-v2 re-consent ─► GO
F-05 counsel ─► final text ─► ENG-25 (S2, privacy-v3 if material) ─► 7 Dec
ENG-07 queue shows areas ─► manual area cohorts (stopgap) ─► ENG-13 AreaOpening (replaces stopgap)
DES-11 ─► ENG-24 back office shell + role matrix ─► ENG-11 suspend · ENG-21 reports · ENG-22 users · ENG-23 audit · ENG-16 metrics ─► SEC-12 ─► 27 Nov GO
DES-12 ─► ENG-26 fonts (₦, Ṣ) · ENG-27 contrast
ENG-16 metrics ◄── ENG-13 (area dimension), ENG-02 (gate field)
ENG-15 survey link ◄── F-06 Tally survey built (DES-07)
ENG-14 consent banner ◄── DES-06 ─► Clarity back on (founder sets env)
F-05 legal advice ─► final notice + terms (ENG-25 S2) ─► 7 Dec open sign-up
```

## Critical path

**Fast-track:**
- The main chain: ~~F-01 buy the domain~~ (done 9 Nov: `peabudy.com`) → **F-02 Resend verified tonight, with `RESEND_API_KEY` and `EMAIL_FROM` set** (12:00 Tue tripwire) → ENG-28 FT + ENG-08 env → **ENG-10 rehearsal meeting F-02 part H's pass rules by 16:00 UK on 10 Nov** → SEC-11 sign-off → go at 18:00.
- In parallel on the critical path:
  - ENG-02 and ENG-01. Without them, B isn't safe.
  - F-04 (placeholders filled by 12:00 on 10 Nov) → ENG-25 interim notice.
  - F-17 knock-out search (by 12:00) → D13.

**Full scope:**
- F-05 counsel → final notice and terms by 4 Dec.
- In parallel:
  - the back office, ENG-24 → ENG-11/21 (needed for a real moderation response at volume)
  - ENG-12 email → ENG-13 area opening
- Then the 27 Nov go/no-go → 7 Dec.

## Cut line

- **Fast-track, never cut:** ENG-01, ENG-02, ENG-03 (FT rows), ENG-04, ENG-06, ENG-08, ENG-09, ENG-10 rehearsal, ENG-25 (interim), ENG-28 (FT: at least the code email), SEC-11, F-02…F-04, D11 written, D13 decided.
- **Fast-track, cut first:** repo clean-up, the mascot landing and onboarding, the full (non-FT) security review findings below High.
  - If any of these misses 10 Nov 18:00, go with Option C.
- **Full scope, never cut (needed for 7 Dec):** ENG-24 + ENG-21 (back office shell and report queue), ENG-11, ENG-12 (the identity, intro and message events only), ENG-13 (or keep the manual cohort stopgap, but that caps growth at the founder's verification capacity), ENG-14 (or keep Clarity off), legal sign-off.
- **Cuttable for 7 Dec:**
  - ENG-12's area-opened and weekly-matches emails
  - ENG-15 prompts (keep the emailed survey)
  - ENG-16 UI (keep the endpoint)
  - ENG-17 (keep the copy-change option)
  - ENG-18 hashing (if SR agrees)
  - ENG-19
  - ENG-20 widen actions (keep the existing "Adjust my search" link)

## Dropped after checking the code (already exists, or not needed)

| Plan item | Why dropped | Evidence |
|---|---|---|
| Turn off personas and sample worlds in beta | Already off | `lib/env.ts`: `DEMO_MODE` is forced false in beta and `SANDBOX_ON_SIGNUP = IS_RESEARCH`; `auth/demo-persona` returns 404 when `!DEMO_MODE` |
| Require both people verified before an intro | Already enforced | `introductions/route.ts:113–118` |
| Add a report status column | Already in the schema | `Report.status` (open/triaged/resolved). ENG-11 only adds resolution fields |
| Build a "leave household" action | Already exists | `households/[id]` action `leave` |
| Money-request caution in chat | Already exists | `conversations/[id]/messages/route.ts:82` |
| In-app notifications for intro, accept, message and check result | Already exist | `notify(...)` calls; ENG-12 builds email on top of them |
| Discover empty state naming the narrowest filters | Partly exists | `discover/page.tsx:100–104`, so ENG-20 is smaller |
| Seed guard for the beta database | Already exists | The seed refuses `APP_ENV=beta` without `FORCE_SEED` (`CLAUDE.md` §4) |

## Changes from the parent plan

1. **D1:** both cities, 11 Nov, Option B fast-track (was single city, 7 Dec soft launch, 11 Jan announcement).
2. **New must-have, ENG-02:** in beta, unverified accounts can currently see verified real people. This wasn't in the plan.
3. **New must-have in ENG-06:** `verify-code` only checks *whether* consent exists, not which version (`if (!prior?.privacyConsentAt)`). A new notice wouldn't trigger re-consent.
4. **New copy defects:**
   - Discover's subtitle says the chip is "match strength" while the chip shows credibility.
   - The landing "Room host" scenario describes features that don't exist: room authority review, and an address that unlocks at viewing.
   - The feedback dialog and privacy notice claim feedback is anonymous, but signed-in feedback stores `userId`.
5. **Clarity is off in beta** until ENG-14 ships (was: consent banner before launch).
6. The 18+ declaration moves to Sprint 1; the staff check covers it in the meantime.
7. **Email domain:** a bought domain is required. This is now founder tickets F-01/F-02 and sits on the critical path.
8. **Legal:** AI drafts of the privacy notice, terms and DPIA are in `legal/`. ENG-25 publishes the interim version; counsel reviews by 4 Dec.
9. **Back office MVP** added: ENG-21 (report queue with open, investigating, actioned and dismissed, plus an action log), ENG-22 (user search and detail), ENG-23 (audit viewer), ENG-24 (shell, role matrix, staff reads audited), plus SLA in ENG-07, DES-11 and SEC-12. Already existing: the identity queue with approve/reject, the feedback list, the reports list (read-only) and the latest-100 audit list.
10. **Design findings** added:
    - ₦ and Ṣ are missing from the current fonts, and only the latin subset is loaded (ENG-26, DES-12).
    - Placeholder and faint landing text fail contrast (ENG-27).
    - The Discover score chip should go. The designer read the chip as the 0–60 match score; the code shows it's the credibility score (`lib/matching.ts:271,289`). It's mislabelled either way, so remove it (ENG-04, DES-01 #18).
11. **Rename and domain (9 Nov, evening):** the product is now **Peabudy**, on `peabudy.com` (F-01 done). New: ENG-28 (user-facing rename), F-17 (name check and handles), D13 and D14. F-02 is now a click-by-click checklist. The 16:00 email gate stays, with clearer pass rules and a 12:00 tripwire.

## Open decisions (D2 moot; D3 onward still open, my recommendation in brackets; D13 and D14 added 9 Nov evening)

- **D3** Timing of the open-sign-up announcement: [7 Dec open sign-up; 11 Nov is the waitlist announcement and invite-only cohort]
- **D4** Identity check: [mandatory]
- **D5** Real people from the 6 Oct pilot in the beta database: [find out in ENG-09; email them before relaunch]
- **D6** Separate demo deployment: [yes, Sprint 2, optional]
- **D7** Keep the household agreement: [yes, the agreement only]
- **D8** Clarity: [off until consent ships]
- **D9** Second verifier and moderator: [needed this week, given two cities]
- **D10** Survey incentive: [optional]
- **New, D11:** Accept Option B's residual risk in writing (interim notice, SQL-only moderation, cohort only)? [Yes, or choose C]
- **New, D12:** Launch areas per city, 2–3 each: [London: two or three adjacent areas from the waitlist; Lagos: Yaba plus one or two neighbours. Decide from waitlist data by 13 Nov]
- **New, D13 (by Tue 10 Nov 18:00):** Announce publicly as Peabudy on 11 Nov, given the one-letter closeness to "Peabody", a large London housing association? [Run F-17's knock-out search first. If there's no conflicting live mark in classes 36 or 45, announce as Peabudy and get counsel's view within two weeks. If there is one, run the invite-only cohort without a public announcement until counsel advises]
- **New, D14 (by Fri 13 Nov):** When does the mascot-led landing and conversational onboarding ship? [Landing: after 11 Nov, once it passes the honesty rules. Onboarding: after a PM review against the guardrails above, and an A/B or before/after comparison of onboarding completion, so we learn whether it helps rather than assume it does]
