# Approval-first sign-up: spec

| | |
|---|---|
| Status | **Approved by the founder on 10 Nov 2026 ("Approve all, start"): F1–F4 as recommended.** Build started (ENG-39–45, DES-20–23). Replaces the "request access → invite → sign up" flow from D15 / ENG-37 / ENG-38 |
| Trigger | Founder, after testing staging (commit 192068c): "Invite code is not stopping the regular sign in button. The flow should be a sign up flow that ends with getting an invite code, and you should only be allowed to sign in after your profile is approved on a back office page." |
| Owners | Engineer: ENG-39…44 · Designer: DES-20…23 · Security: SEC-15 · Founder: decisions F1–F4 |

## 1. Problem

*Fact (code, 192068c):*
- `/signin` is one page for everyone: email + optional invite code → OTP.
- The server refuses new emails without an invite (`request-code`: 403 `INVITE_REQUIRED`). But the landing shows "Sign in" next to "Request an invite", so to a visitor sign-in looks like an open door.
- The 5-field request form feels separate from joining.
- After an invite, the person creates an account, onboards inside the app, and only then waits for the ID check.
- The 403/"sent" split also tells anyone whether an email has an account (HM-28).

**What the founder wants:**
1. Joining is an **application**.
2. Staff approve the whole profile in the back office.
3. Approval produces an invite code.
4. **Only approved people can sign in.**

**Why it matters:**
- It's the trust promise made visible: everyone you see was reviewed by a person.
- It removes the "open door" confusion.
- It closes the enumeration leak.

## 2. The flow (confirms the coordinator's reading, with three improvements)

```
Landing ── "Apply to join" ─► /join ─► 1 email + 6-digit code (proves ownership)
                                       2 conversational application (today's onboarding questions)
                                       3 consent + optional survey opt-in ─► Submit
                                       └► "Application received" + status page
Staff  ── Applications queue ─► review profile ─► book + run video ID call ─► Approve | Decline
Approve ─► email "You're approved" with activation link /invite/[code] (code also shown)
User   ─► /invite/[code] ─► email code ─► account active, profile goes live ─► Discover
Later  ── "Sign in" (users) ─► email ─► code only if the account is active
```

**Improvements on the suggested reading:**
1. **Prove the email at the start, not the end.** It stops strangers drafting applications in someone else's name, and lets the draft save as they go (so a phone drop doesn't lose 10 minutes of answers).
2. **The profile goes live at activation, not at approval.** Otherwise users could send intros to someone whose approval email is sitting in junk. Intros expire after 7 days, so the new person could miss them.
3. **The status page is reached through the application session on the same device, or a magic link from the confirmation email.** Never through sign-in.

## 3. Founder decisions (all **approved 10 Nov 2026**, as recommended)

| # | Decision | Decided |
|---|---|---|
| **F1** | **Launch date.** This is about 3.5 engineer-days plus design. It can't pass Thursday's go/no-go | **Move the launch to Wed 18 Nov** (go/no-go Tue 17 Nov 18:00). Don't launch Friday on the old flow: real people would join through a flow we're about to replace, and we'd have to migrate them |
| **F2** | **Is the video ID call part of the approval?** One review = profile check + ID call, then Approve | **Yes, one gate.** "Approved" then means "a person checked the profile and saw their ID". There's no second waiting state after sign-in |
| **F3** | **Declined applicants:** reason shown? Reapply? | A kind, generic email, with no reason given ("we can't offer a place right now"). They can reapply after 30 days. One exception: "not open in your city yet" is said plainly, and those applications are **held** rather than declined |
| **F5** | **Who may reveal an applicant's gender and housemate preference** | **Decided by the founder, 11 Nov: all staff roles (admin, verifier, moderator).** This is the current behaviour, so no code change. Every reveal stays audited |
| **F4** | **London applications during the Lagos pilot** | **Accept and hold** (status `waitlisted`). Same application, with a clear "London opens later" message. No ID call until London opens |

Everything else below is decided by PM as routine and reversible, and recorded as such.

### Designer's open questions: PM answers (10 Nov; routine, reversible)

| Question | Answer |
|---|---|
| (a) City change after activation | **Yes: through hello@peabudy.com, not in-app.** Changing city moves someone into a different market, and during the Lagos pilot it would waitlist them (F4). **Areas within the same city stay editable in-app.** Profile shows "Moving city? Email hello@peabudy.com" |
| (b) Bio and habit edits after approval aren't re-reviewed | **OK for the pilot.** Habits only affect matching; edits write a `SearchVersion`. Bio edits are audited. **Display name stays locked** (R5, HM-12). Re-review any profile that's reported for its bio. Revisit when Didit or volume removes the human touchpoint |
| (c) "About 10 minutes" for the ID call | **Yes.** It matches the 10-minute slots in the verification SOP (founder.md F-08). Staff budget about 15 minutes, including booking |

## 4. Data model (recommendation: reuse the real tables, add an `Application`)

**Options considered:**
- **A.** An `Application` row holding the whole profile draft as JSON, copied into `User`/`Profile`/`Search` on approval.
- **B (chosen).** Create the `User` at step 1 with a new `accountStatus = "applicant"`. Write the answers into the existing `Profile`/`Search`/`SearchArea`/`PreferenceAnswer` tables through the existing `PATCH /me/profile` and `/me/search` routes, with an `Application` row for review state.

**Why B:**
- It reuses the validation, `SearchVersion`, the monthly-equivalent money handling and the gender-preference logic.
- There's no JSON-to-table copy to get wrong.
- The approved profile is exactly what matching reads.

**What it costs:** applicants are real `User` rows, so every user-facing query must exclude them. They're already invisible because their identity isn't verified (ENG-02, HM-01). ENG-39 adds an explicit status check as a second layer.

**Schema (additive migration `approval_first_signup`):**
- `User.accountStatus` gains `applicant`. Lifecycle: `applicant` → `active` (at activation), or stays `applicant` with a declined application. Existing values are unchanged.
- **New `Application`:**
  - `id`, `userId` (unique), `status`, `submittedAt?`, `reviewedBy?`, `reviewedAt?`, `idCheckMethod?` (`video` | `provider:didit`), `idCheckAt?`, `declineReason?`, `reapplyAfter?`, `activationInviteId?`, `statusToken` (hashed, for the magic link), `createdAt`, `updatedAt`.
  - `status`: `draft` | `submitted` | `in_review` | `call_booked` | `approved` | `declined` | `waitlisted` | `withdrawn`.
  - `declineReason` comes from an allow-list: `not_genuine`, `agent_or_landlord`, `id_failed`, `no_show`, `duplicate`, `other`.
- **`Invite` is reused as the activation code:** bound to the email, `applicationId`, single-use, 14-day expiry, hashed. Re-sending one revokes the previous one.
- **`AccessRequest` is retired.** Read-only until the data is migrated or deleted (§9); no new writes.
- `Search.status` stays `draft` until activation, then becomes `active`. `Profile.publicationStatus` becomes `published` at activation.

## 5. Requirements

### R1. `/join`: the application (replaces `/request-access` and the invite-gated sign-up)
1. **Step 1, email:** `POST /api/v1/applications/start {email, consent_privacy}`.
   - The response is always 200, "We've sent a 6-digit code", for every address. Codes always go to the address itself, so only its owner sees what happens next.
   - Rate limits: the existing per-email (5/h) and per-IP limits, plus the HM-26 site-wide cap.
2. **Step 2, code:** `POST /api/v1/applications/verify {email, code}`. What happens depends on who the address belongs to:
   - **New email:** create `User(accountStatus=applicant, emailVerified=true)`, a draft `Application`, and an **application session** (cookie `hm_session`, flagged `scope=application`, 7 days).
   - **Existing applicant:** resume their draft, or show their status.
   - **Active user:** sign them in normally. They proved ownership, so this isn't a bypass.
   - **Declined before `reapplyAfter`:** show the status page with the reapply date.
   - **Suspended or `deletion_pending`:** the same neutral status page, "We can't take an application from this address. Contact hello@peabudy.com".
3. **Step 3, questions:** the conversational flow asks today's onboarding questions in the same order and with the same meanings:
   - journey, city, areas, budget, move-in window, stay length;
   - the six habits with their accepted answers;
   - gender and housemate preference (private, explained as private);
   - first name and bio.
   - Each step autosaves through `PATCH /me/profile` and `PATCH /me/search` (allowed for the application scope).
   - The questions and options are unchanged (matching depends on them; README guardrails).
4. **Step 4, submit:** optional, unticked survey opt-in (ENG-29), then "Submit application".
   - `POST /api/v1/applications/submit` validates completeness with the publish route's checks (`INCOMPLETE` 422 with the missing fields), then sets `status=submitted` and `submittedAt`.
   - It **doesn't** publish. Audit `application.submitted`.
   - It sends email E1.
5. **The status page** (`/join/status`) shows one of:
   - Submitted: "We'll email you within a day to book a 10-minute video ID call."
   - Call booked: date and time, if staff entered it.
   - Approved: "Check your email for your invite".
   - Declined, with the reapply date.
   - Waitlisted: "London opens later".
   - It's reachable from the application session or from the E1 magic link (`/join/status?t=…`, a hashed token, no expiry while the application is open, read-only).
   - It offers "Edit my answers" while the status is `draft` or `submitted`, and "Withdraw".
6. **London (F4):** the city choice is allowed. On submit, `OPEN_CITIES` (re-added, server env, default `lagos`) sets `status=waitlisted` for other cities, and sends E1 with waitlist wording.

### R2. Sign-in: approved users only
1. `POST /auth/request-code {email}` returns the **identical 200** "If you have an approved Peabudy account, we've sent a code. New here? Apply to join." for every address. A code is emailed **only if** `accountStatus = active` and the user isn't suspended or `deletion_pending`, or the address is in `ADMIN_EMAILS`.
2. `INVITE_REQUIRED` and `INVITE_INVALID` are removed from `request-code`. Invite codes are now only used at `/invite/[code]` (R4) and by the "Have an activation code?" link on `/signin`, which goes to R4.
3. `verify-code` refuses `applicant` accounts with the same generic error as a wrong code. This is belt and braces; normally they never get a code.
4. The HM-26 busy message and the per-IP and site-wide caps stay. The response timing must not differ in a way that reveals the branch: send the email asynchronously after the response, or pad the time.
5. Landing: "Apply to join" (primary) and "Sign in" (secondary, for approved users). `/request-access` redirects to `/join`.

### R3. Back office: the Applications queue (replaces "Access requests" and "Identity checks")
1. A tab with these filters: `submitted`, `in_review`, `call_booked`, `waitlisted`, `declined` (30 days), and city and area. Sorted oldest first, with waiting hours (amber after 24 h, red after 72 h, text labels too) and the cluster hint (D20).
2. **Detail view:** the full profile as users would see it, plus the private matching fields needed to sanity-check it: city, areas, dates, budget, habits.
   - **Gender and preference are hidden** unless the reviewer clicks "Show private fields", which is audited.
   - The email is shown (needed to book the call).
   - Opening the detail is audited (`staff.application_viewed`).
3. **Actions:**
   - "Start review" (`in_review`).
   - "Call booked" with a date and time (`call_booked`; optional E4 email).
   - **Approve** (requires an ID-check confirmation: "I saw a photo ID matching this person, and they're 18 or over", plus the method `video`).
   - **Decline** with a reason from the allow-list.
   - "Waitlist".
   - "Resend activation".
4. **Approve, in one transaction:**
   - `VerificationCheck identity → verified` (`checkedAt`, method);
   - `adultEligible = true`;
   - `Application.status = approved`, `reviewedBy`, `reviewedAt`;
   - create the activation `Invite`;
   - audit `application.approved`;
   - send email E2.
   - **Not published yet** (R4).
   - **Fix:** don't set `phoneVerified` or a `phone` check. Today's approve route sets both (`staff/verifications/[userId]/route.ts:26,33`) without anyone checking a phone. That's a dishonest label.
5. **Decline:** `status = declined`, `reapplyAfter = now + 30 days`, audit, email E3. The user row stays `applicant`. Its draft data is deleted on the retention schedule (§8).
6. **Roles:** approve, decline and waitlist are allowed for `verifier` and `admin`; `moderator` can only view. **Nobody can act on their own application** (HM-10), and staff accounts can't apply. Every action and every detail view is audited.
7. **Didit later (ENG-35):** a provider "verified" result moves the application to a "Ready to approve" state. Staff still click Approve for the profile check. Fully automatic approval is a later decision.

### R4. Activation: `/invite/[code]` → first sign-in
1. `/invite/[code]` validates the code without consuming it. If valid, it shows "You're approved" with the masked email and "Continue"; a code is sent to that email.
2. `verify-code` with a valid activation code, in one transaction:
   - consume the invite;
   - `accountStatus = active`;
   - `Profile.publicationStatus = published`, `publishedAt`;
   - `Search.status = active` with a version bump;
   - session scope becomes `user`;
   - audit `application.activated`.
   - Then redirect to `/discover`.
3. An invalid, expired, used or revoked code gives one friendly page: "This activation link isn't valid any more. Sign in if you've already activated, or contact hello@peabudy.com".
4. Expiry is 14 days. Staff can "Resend activation" (a new code; the old one is revoked).

### R5. The in-app onboarding page
- `/onboarding` stops being an entry point. Users are redirected to `/profile`, which already edits every field. The conversational components move to `/join` (the designer's current flow is reused, not rebuilt).
- **Display name and city are locked after approval.** The name is locked because of HM-12 (impersonation after the ID check); the city because of answer (a) above. Changes go through hello@ until a staff tool exists. Bio and matching fields stay editable; a matching change still writes a `SearchVersion`.

### R6. Emails (sent from `peabudy.com`, the login stream; HTML + plain text; DES-22)
| ID | When | Subject | Must say |
|---|---|---|---|
| E0 | Steps 1–2, and sign-in | "Your Peabudy code: …" | The code. For sign-in, no hint whether the address has an account |
| E1 | Submit | "We've got your Peabudy application" | What happens next (a video ID call within a day); the status link; "We'll never ask you for money" |
| E2 | Approve | "You're approved: activate your Peabudy account" | The activation link and the code typed out; 14-day expiry; "Never share this link" |
| E3 | Decline | "About your Peabudy application" | Kind and generic; reapply after {date}; no reason codes |
| E4 (optional) | Call booked | "Your Peabudy ID call: {date}" | Time, how it works, what ID to bring, "We don't record or keep a copy of your ID" |
| E5 | Waitlisted | Part of E1 | London opens later; we'll email you |

Every email carries an audit `email.sent` with no address.

### R7. Privacy
- **Application data** is the same data as the profile, plus the review fields. **New retention** (privacy notice updated):
  - **unsubmitted drafts:** 30 days after the last change;
  - **declined or withdrawn:** 30 days after the decision. After that, keep only a hashed email and `reapplyAfter` until the reapply date;
  - **waitlisted:** until the city opens or 12 months, whichever is sooner.
- **Lawful basis:** steps at the person's request before entering a contract (the application), plus legitimate interests for the review.
- Gender is still consent-based and optional (unchanged).
- `/me/export` and deletion work for applicants too, from the status page: "Download my data" and "Delete my application".

## 6. Acceptance criteria (the e2e journeys; ENG-44)

**Happy path:**
1. New email → `/join` → code → full application → submit → E1 sent → status "Submitted".
2. Staff: queue → detail → Approve, with the ID confirmation → E2 sent. Application `approved`, identity `verified`, profile **not** yet visible to users.
3. `/invite/[code]` → code → lands on `/discover`. Profile published, search active. Two activated users see each other.
4. Later: `/signin` with the same email sends a code and signs them in.

**Negative cases. Each must return the identical response body and status, send no email, and have the same timing within normal noise:**
5. `/signin` with an unknown email.
6. `/signin` with an applicant who's in draft, submitted or approved but not activated.
7. `/signin` with a declined applicant.
8. `/signin` with a suspended account (unchanged existing behaviour, but now the same body).

**Other negatives:**
9. An applicant session calling `/recommendations`, `/users/[id]`, `/introductions`, `/conversations` or `/households` gets 404.
10. An activation code for A, used after signing in as B, gets the invalid page. A used, expired or revoked code gets the invalid page.
11. A declined applicant reapplying before `reapplyAfter` sees the status page with the date, and no new application is created.
12. Staff approving their own application gets 404. A moderator approving gets 404.
13. Approve doesn't create a `phone` check or set `phoneVerified`.
14. A London application is `waitlisted` and doesn't appear in the "submitted" filter.
15. Submitting an incomplete application gives 422 `INCOMPLETE` listing the missing fields, with the draft kept.
16. `SIGNUPS_PAUSED`: `/join` step 1 refuses with the pause message; existing users sign in normally.

**Plus:** the responsive rules (DES-19) on `/join` at 320 and 360 px, and the data-light check (T4c) for `/join` step 1.

## 7. Tickets

### Engineer (about 3.5 days)
| ID | Ticket | Size | Acceptance (§6) |
|---|---|---|---|
| ENG-39 | Schema: `applicant` status, `Application` table, application-scoped session. `requireMember()` guard (active only) on every user route, applicant-scope allow-list (`/me`, `/me/profile`, `/me/search`, `/applications/*`, `/me/export`, `/me/delete`, `/feedback`) | M | 9 |
| ENG-40 | `/join` API: start, verify, submit, status magic link, withdraw. `OPEN_CITIES` → waitlisted. Reuse the publish completeness checks | M | 1, 11, 14, 15, 16 |
| ENG-41 | Sign-in gating: identical response; email only for active users; remove `INVITE_REQUIRED`/`INVITE_INVALID` from `request-code`; async send or timing padding; landing CTAs; `/request-access` → `/join` | S | 4–8 |
| ENG-42 | Applications queue + detail + actions (approve, decline, waitlist, call booked, resend) with roles, self-action ban, audits, the private-fields reveal; **remove the phone grant from approve**; retire the "Access requests" tab and the separate "Identity checks" list | M | 2, 12, 13 |
| ENG-43 | Activation: `/invite/[code]` → code → activate and publish in one transaction; emails E1–E4 (templates from DES-22); `/onboarding` → `/profile` redirect for users; display name locked after approval | S–M | 3, 10 |
| ENG-44 | Tests: extend `tests/e2e_beta.py` with §6 cases 1–16; unit tests for the status machine; update the research/gender suites if shared code changes | M | all |
| ENG-45 | Data: migration notes and a one-off script (§9); `CLAUDE.md` §8 auth section updated | XS | §9 |

### Designer
| ID | Ticket | Acceptance |
|---|---|---|
| DES-20 | `/join`: the email and code steps, then the existing conversational onboarding moved in, then consent, opt-in and submit. A progress indicator; autosave reassurance ("Saved"); works at 320 px; respects reduced motion | Usability: a first-time person finishes on a 360 px Android without help in the T4 pass |
| DES-21 | Status page (all six states), the activation landing and its invalid page, the sign-in copy and user/apply CTAs on the landing | Every state has one clear next step; no state implies the person is "safe" or "matched" |
| DES-22 | Emails E0–E5, HTML + plain text, branded and light (no heavy images; Lagos data) | Renders in Gmail, Outlook and Yahoo (T3); plain text readable alone |
| DES-23 | Back office Applications queue and detail (replaces the DES-17 staff tab) | A reviewer can approve or decline from a phone at 375 px; private fields hidden by default |

### Security
- **SEC-15:**
  - identical sign-in responses and timing (HM-28 closed);
  - applicant scope can't reach user data;
  - activation code binding;
  - the self-approval ban;
  - the private-field reveal is audited;
  - the magic-link token;
  - the phone-grant removal.
- Sign-off is required before the new go/no-go.

## 8. Privacy notice changes
Made in [`legal/privacy-notice.md`](legal/privacy-notice.md) (10 Nov):
- an "Application" row;
- the lawful basis;
- application retention (§R7).

## 9. Migration (staging and production)
- **Staging (`beta-rehearsal`) is test data:** reset the branch, with no migration of `AccessRequest`/`Invite` rows. *Assumption: nobody real is on staging.* The founder confirms.
- **Production:** not yet launched in beta. Before the switch, ENG-45 counts `AccessRequest`, `Invite` and `User` rows on the production beta database (counts only). If any real people requested access, the founder emails them personally with the `/join` link. Their old requests are deleted after 30 days, as the notice says.

## 10. Estimate and the launch

| | |
|---|---|
| Engineer | about 3.5 days (ENG-39–45) |
| Designer | about 2 days, mostly moving the existing onboarding UI into `/join` |
| Security | about half a day (SEC-15) |

**Dates (F1, approved 10 Nov):**

| Step | Date |
|---|---|
| Build | Wed 11 – Mon 16 Nov |
| Full test pass (T1–T5, with the new §6 cases), phones on Tue 17 Nov | Mon 16 – Tue 17 Nov |
| Go/no-go | **Tue 17 Nov, 18:00** |
| Launch in Lagos | **Wed 18 Nov** |

**Thu 12 Nov is no longer a go/no-go for launch:** use it as a checkpoint on build progress. The go/no-go criteria in README L6 stay, with criterion 3 replaced by: "§6 cases 1–16 pass on staging, and SEC-15 is signed off".

**Not changed:** Didit (ENG-35) after launch; the survey sender (ENG-36) after launch, with the first send 7 days after the first activations.
