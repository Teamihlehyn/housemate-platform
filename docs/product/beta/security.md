# Security review pack: Peabudy beta

> **Name:** the product is now **Peabudy** (founder, 9 Nov 2026; domain `peabudy.com`, bought on Vercel). New review surface: the domain's DNS (SPF, DKIM, DMARC on Vercel DNS), the Resend API key scope, and a lookalike risk: "Peabudy" is one letter from "Peabody", a large London housing association, which makes impersonation and phishing lookalikes easier in both directions (founder.md F-17).
>
> Status: **draft** (9 Nov 2026). For the `security-reviewer` agent, which works read-only and assesses risk independently. Index: [`README.md`](README.md). Engineer tickets: [`engineer.md`](engineer.md).
>
> **Assumes D1:** real people in London and Lagos from 11 Nov, invite-led (Option B). Also assumes D4 (mandatory staff ID check) and D11 (the founder accepts the interim posture in writing).
>
> **Severity:** Blocker = no-go · High = fix before 27 Nov · Medium = fix before 7 Dec open sign-up · Low = backlog.
>
> **Non-negotiables to hold the line on (`CLAUDE.md` §2):**
> - server-side authorisation on every route
> - inaccessible = 404
> - audit in the same transaction
> - no private data in public DTOs
> - identity granted only by staff in beta
> - no stored ID documents
> - no on-screen codes for staff

| ID | Review | When | Gate |
|---|---|---|---|
| SEC-11 | **Fast-track go/no-go** (the subset needed for 11 Nov) | Tue 10 Nov, by 17:00 UK | 11 Nov |
| SEC-01 | Auth / OTP and staff accounts in beta | S1 | 27 Nov |
| SEC-02 | Isolation of research data from beta; environment configuration | FT + S1 | 11 Nov (config part) |
| SEC-03 | Authorisation on new and changed routes (verified-only browsing, suspend, reports, areas, metrics) | S1 | 27 Nov |
| SEC-04 | Email: SPF/DKIM/DMARC, link tokens, enumeration | S1 | 27 Nov |
| SEC-05 | PII in audit, outbox, Clarity, Tally hidden fields, feedback, logs | S1 | 27 Nov |
| SEC-06 | Rate limits and abuse: spam intros, scams, money requests, account creation | S1–S2 | 7 Dec |
| SEC-07 | Block and report flows | S1 | 27 Nov |
| SEC-08 | Chat rendering, headers and CSP | S2 | 7 Dec |
| SEC-09 | Data export and deletion | S2 | 7 Dec |
| SEC-10 | DPIA inputs (UK GDPR + NDPA 2023) | S1–S2 | 7 Dec |
| SEC-12 | Back office MVP (roles, staff audit, PII exposure) | S1–S2 | 27 Nov |
| **SEC-14** | **Live-launch sign-off** (replaces SEC-11): beta in production, Lagos first, open sign-up | Wed 11 – Thu 12 Nov, by 17:00 | **Fri 13 Nov launch** |
| **SEC-13** | **Didit integration review** (ENG-35): webhook, data minimisation, biometric consent, provider settings | Mon 23 – Wed 25 Nov | Didit go-live, about 27 Nov |

> **Live launch re-plan (10 Nov):** research mode is retired, and production goes to beta once. Open sign-up, with the link shared with a few people; **Lagos first**; launch **Fri 13 Nov** (README "Live launch plan").
> - **Not needed any more:** HM-22 (Clarity masks for research production), HM-14, and the research parts of HM-18 and SEC-02.
> - **Raised for open sign-up:**
>   - HM-13 (unauthenticated feedback with no limit) → before launch (ENG-31).
>   - HM-11 (the scam caution shown only to the sender; Nigerian wording) → "should" before launch (ENG-34).
>   - HM-17 (export and deletion mismatch) → feedback and consent are added to the export (ENG-29, ENG-31). The purge is still the F-10 manual SOP.

## SEC-14: Live-launch sign-off (Thu 12 Nov, by 17:00)

**Exit criteria (all needed):**
- HM-08 closed: per-IP with IPv6 grouped by /64, site-wide caps, staff exempt.
- HM-23 closed: `IP_HASH_SALT` set in production and staging.
- HM-25 closed: switch-script ordering and confirmations.
- HM-13 closed (ENG-31).
- Review of the new surfaces:
  - **ENG-29:** the unsubscribe token (HMAC, constant-time, no enumeration, POST-only change); consent records and audit.
  - **ENG-30** (even though it ships later; review the design now): admin-only, 404 for others, CSV formula injection, no-store, audit with no emails.
  - **ENG-32:** pause switch and `OPEN_CITIES`. The pause must not reveal whether an email has an account. Recommended: the same message for new and unknown emails, and normal behaviour for existing ones. Assess the enumeration risk.
  - **ENG-33:** staging is beta on its own branch; no all-Preview `RESEND_API_KEY`; `switch-to-research.sh` refuses to run; the rollback rule is documented.
- **Invite-only (D15, founder 10 Nov evening), review ENG-37 and ENG-38:**
  - access requests return an identical response whatever the email, are rate-limited and honeypotted, and audits contain no emails;
  - invite codes are random, stored only as hashes, single-use, tied to one email, expire and can be revoked; they're consumed in the account-creation transaction;
  - approve, decline and invite need the `admin` role;
  - `INVITE_REQUIRED` vs "sent" reveals whether an email has an account. Judge whether that's acceptable for launch (PM's view: yes, given the caps).
- **ENG-36** (survey sender, after launch): admin only; opted-in recipients only; dedupe; one-click unsubscribe headers; a restricted key on `updates.peabudy.com`.
- HM-26 (**approved by the founder**): an honest generic 429 above the site-wide cap, with staff codes still sent. HM-27: retire `switch-to-research.sh` (ENG-33). The rollback ladder is in README L1.
- `IP_HASH_SALT` is set in production. After launch, watch the `ip_limited` 429s from Lagos (carrier NAT).
- The e2e_beta suite (README L6, T2) passes on staging-as-beta.
- No open Blocker or High findings.
- **Rollback hazard:** confirm that Vercel Instant Rollback to a research-era deployment is understood and documented as forbidden.

## SEC-13: Didit integration review (ENG-35)

**Check:**
- **Webhook:** signature verification against Didit's documented scheme, timestamp/replay window, idempotency, lookup only by our stored session ID, and no trust in payload user identifiers.
- **Session binding:** a member can't attach another member's session or result. Budget and attempt caps can't be bypassed.
- **Minimisation:** a test proves that nothing beyond status, session ID, `checkedAt`, the reason code and the adult flag is persisted or logged (including error logs and audit). No NIN or BVN calls in code or configuration.
- **Consent:** explicit biometric consent is recorded with a version before any session is created; the video fallback is always available.
- **Staff override:** audited; staff can't approve their own identity (HM-10).
- **Provider settings (with the founder, F-18):** the shortest retention available, the data region, a signed DPA, and whether a delete-session API exists. Record what the Free plan allows.
- **Fraud residuals:** deepfake or injection attacks are Didit's responsibility. Record the residual risk, and that "checked" isn't "safe".
- **Legal inputs for counsel (F-19):** UK GDPR Art. 9 explicit consent; NDPA 2023 sensitive data; Nigeria → EU transfer; the DPIA updated (`legal/dpia.md`).

---

## SEC-11: Fast-track go/no-go (10 Nov)

- **Scope:** ENG-01, ENG-02, ENG-06, the ENG-08 script, ENG-10 rehearsal evidence, the SQL suspension runbook (founder.md F-09), and the beta environment variables.
- **Threats to check:**
  - **A pending (unverified) account sees real people.** Today it can, via `/recommendations` and `/users/[id]`. ENG-02 must close this.
  - Homes, viewings and handoff routes are reachable in beta (ENG-01).
  - Any path that grants identity other than `staff/verifications/[userId]` approve, especially the `else` branch in `publish/route.ts:60–76`. It must be unreachable when `IS_BETA`.
  - The production variables still have `DEMO_MODE` effectively on, or `NEXT_PUBLIC_APP_ENV` doesn't match `APP_ENV`. A mismatch would show research UI on top of beta server behaviour.
  - `demo-persona` is reachable in beta. It should return 404 (`!DEMO_MODE`).
  - Login codes come from `Math.random` (ENG-06).
  - A `deletion_pending` account can sign back in (ENG-06).
  - The SQL suspension runbook revokes sessions and is run against the right branch.
- **Exit criteria (all must hold):**
  1. ENG-02 acceptance tests pass on staging-as-beta.
  2. ENG-01 routes return 404 on staging-as-beta.
  3. No code path in beta sets an identity check to `verified` except staff approval (confirmed by code read and grep).
  4. The rehearsal shows codes delivered to real inboxes, and no code in any API response (`sink_code` absent).
  5. The switch script never echoes a secret, and refuses an unverified sending domain.
  6. The founder has a written suspension runbook and has rehearsed it once on `beta-rehearsal`.
- **Output:** go / no-go with a list of blockers, written as a short note in the hand-back. Don't commit secrets or personal data.

## SEC-01: Auth / OTP and staff accounts in beta

- **Scope:** `request-code`, `verify-code`, `lib/session.ts`, `lib/guard.ts`, `lib/email.ts` (including the `EMAIL_SINK` guard from ENG-10), `ADMIN_EMAILS` bootstrap.
- **Threats to check:**
  - OTP brute force. There are 5 attempts per code (`verify-code`) and 5 codes per hour per email. Is there still a feasible attack across many emails? (IP limits come in ENG-18.)
  - Code entropy (`crypto.randomInt` after ENG-06).
  - Codes and session tokens are stored in plain text (`AuthCode.code`, `Session.token`). Decide whether hashing (ENG-18) is a High or a Medium.
  - Session fixation; 7-day absolute expiry; whether logout clears the session server-side (`destroySession`).
  - Suspended users: a new session can still be created (`verify-code` doesn't check `suspended`). Every request then returns 403, so confirm that's acceptable.
  - Staff accounts:
    - Every `ADMIN_EMAILS` address becomes admin on sign-in (`verify-code`). Check how the variable is managed.
    - Staff must never get an on-screen code. In beta that's moot, because nobody does.
    - Is there any way to escalate a role through an API?
  - The `EMAIL_SINK=log` guard can't activate on Vercel.
  - Consent and 18+ are checked before the code is consumed (ENG-05, ENG-06).
- **Exit criteria:** no Blocker or High open; the decision on token hashing is recorded; a staff account can't be created through any member API.

## SEC-02: Isolation of research data from beta; environment configuration

- **Scope:** the production variables after ENG-08, the Neon branches (`beta`, `research`, `beta-rehearsal`), `lib/sandbox.ts`, `lib/demoBots.ts` and the seed.
- **Threats to check:**
  - The production `DATABASE_URL` points at anything other than `beta`.
  - The rehearsal runs on the production beta branch.
  - Sandbox or demo-bot code paths run in beta. `SANDBOX_ON_SIGNUP` is research-only and `topUpWorld` runs only when `sandboxWorldId === user.id`, so confirm that no beta user can have a `sandboxWorldId`.
  - The seed runs against beta or research (`FORCE_SEED`).
  - Research testers' data is copied into beta, or the reverse. The L1 liquidity analysis must run read-only on research and report aggregates only.
  - Leftover pilot accounts in beta (ENG-09, D5).
  - The demo deployment (ENG-19) shares a database or cookie domain with beta. It must use a different hostname, so `hm_session` cookies aren't shared.
- **Exit criteria:** the configuration is confirmed by reading `vercel env ls` names (not values); `prisma migrate status` is clean on beta; a written statement that no research data is in beta.

## SEC-03: Authorisation on new and changed routes

- **Scope:**
  - ENG-02: `recommendations`, `users/[id]`
  - ENG-11: `staff/users/[userId]/status`
  - ENG-13: `staff/areas`, matching and intro area checks
  - ENG-16: `staff/metrics`
  - ENG-21: `staff/reports*`
  - ENG-22: `staff/users*`
  - ENG-23: `staff/audit`
  - ENG-24: role matrix; `/staff` page returns 404
- **Threats to check:**
  - Insecure direct object references on `[id]` routes.
  - Role checks done only in the UI.
  - A verifier suspending people, or a moderator approving identities.
  - Staff suspending themselves or an admin.
  - The two-way enforcement of the area gate (`CLAUDE.md` rule 7): it must apply at matching **and** at intro time, and return 404, not 403.
  - Whether the existence of blocked or filtered people leaks through counts. `exclusions.excludedCount` already reveals a nearby count; is that acceptable in beta, where the people are real?
- **Exit criteria:** every route in scope has a negative e2e test (member 403/404, wrong role 403); no route trusts a client-supplied role or user ID.

## SEC-04: Email: SPF/DKIM/DMARC, link tokens, enumeration

- **Scope:** founder.md F-01/F-02 DNS records, `lib/email.ts`, ENG-12 (notification emails, unsubscribe).
- **Threats to check:**
  - **SPF and DKIM** records match Resend's values, and the sending subdomain is used. **DMARC** is published (start with `p=none` plus a reporting address, and move to `quarantine` after 2 weeks of clean reports).
  - Spoofing of the new domain.
  - **Link tokens:** unsubscribe HMAC is keyed with `EMAIL_LINK_SECRET`; the `userId|category` binding; no sign-in power; GET is safe (it doesn't change anything); one-click POST.
  - No "magic login" links anywhere.
  - **Enumeration:** `request-code` must return the same response whether or not an account exists. Today it does, but check the timing difference from the user lookup and the email send.
  - Email bodies must contain no private content (DES-05).
  - Phishing look-alikes: the emails should tell people we never ask for codes or money.
- **Exit criteria:** an SPF/DKIM pass on a test email (check the received headers); DMARC published; unsubscribe token tests pass; no PII beyond the first name in any template.

## SEC-05: PII in audit, outbox, Clarity, Tally hidden fields, feedback and logs

- **Scope:** `lib/audit.ts` callers (new events in ENG-05/06/07/11/12/13/15/16/21/22/23), `OutboxEvent` payloads, Clarity masking (`data-clarity-mask`), Tally hidden fields (ENG-15), `TesterFeedback`, `console.error` in `lib/email.ts` (it logs Resend's response text, which may echo the address).
- **Threats to check:**
  - Report notes, message text or emails written to audit or outbox.
  - `discover.viewed` including candidate IDs.
  - The survey `ref` can be reversed to a user ID. It must be HMAC-based, not a plain hash of a cuid.
  - Clarity recording unmasked fields once it's back on (ENG-14). The new back office pages must be masked or excluded.
  - Vercel logs keeping email addresses.
- **Exit criteria:** grep the new code for `writeAudit`/`writeOutbox` calls carrying free text; a sample `safeAfter` review; Clarity off in beta until ENG-14, then a masking check on every page that holds PII.

## SEC-06: Rate limits and abuse

- **Scope:**
  - Intros: 10 a day, 20 pending, 30-day cooldown (`introductions/route.ts`).
  - Messages: no limit seen. Check this.
  - Money-request caution: a regular expression at `messages/route.ts:82`.
  - Reports, feedback, account creation (no IP limit).
- **Threats to check:**
  - A verified member spamming intros or messages.
  - Rent, deposit and holding-fee scams, and romance scams. The caution pattern misses many phrasings (e.g. "send it to my Opay", "transfer the caution fee"). Should it be extended, or remain non-blocking guidance plus a report path?
  - Account farming. Every account needs a staff ID check before it can see anyone, which limits impact, but it adds verification-queue load. Consider a per-IP signup limit.
  - Report flooding against one target.
- **Exit criteria:** a written risk acceptance or a fix for each item; a message rate limit decision (e.g. 60 an hour per sender); the caution pattern list reviewed with Nigerian and UK scam phrasing.

## SEC-07: Block and report flows

- **Scope:** `blocks/route.ts`, `reports/route.ts`, ENG-21, ENG-11 cascade.
- **Threats to check:**
  - Block must be immediate and two-way across recommendations, profile, intros, messages and households, with a generic 404 afterwards.
  - Reports never change scores, and never tell the target who reported them.
  - The reporter's identity isn't visible to the target through any staff-to-member notification.
  - Suspension cascades fully (sessions, intros, conversations, households).
  - Restore doesn't reopen anything.
  - Evidence: staff can't read chats, so check that the "paste an excerpt" approach doesn't push people to share third parties' data unnecessarily.
- **Exit criteria:** e2e tests for block in every surface; the suspension cascade test passes; a reporter-anonymity review signed off.

## SEC-08: Chat rendering, headers and CSP

- **Scope:** `messages/[id]/page.tsx:105` (`dangerouslySetInnerHTML` over the server-escaped body), `escapeBody` in the messages route, `next.config.ts` (no headers today), ENG-18.
- **Threats to check:** stored XSS through escaping gaps; clickjacking; missing CSP; referrer leakage of conversation IDs.
- **Exit criteria:** chat renders as plain text (ENG-18 item 3), or there's a written justification; headers present in production.

## SEC-09: Data export and deletion

- **Scope:** `me/export` (ENG-17), `me/delete` (soft: `deletion_pending`, no purge job), ENG-06 (sign-in block), and the manual purge SOP (founder.md F-10).
- **Threats to check:**
  - The export leaks third-party data (other people's emails or checks).
  - The export includes reports about the user (which could tip off a subject under investigation).
  - Deletion never completes. There's no purge job, so a manual SOP is needed within the period the notice promises.
  - Plain-string FKs (`Introduction.lowUserId`, `Membership.userId`, `Notification.recipientId`, audit IDs) aren't cascaded (`CLAUDE.md` §7). The SOP must handle them.
  - The audit retention policy vs deletion requests.
- **Exit criteria:** export field review; a written purge SOP with SQL that's been rehearsed on `beta-rehearsal`; the retention periods in the privacy notice match the SOP.

## SEC-10: DPIA inputs (UK GDPR + NDPA 2023)

- **Scope:** [`legal/dpia.md`](legal/dpia.md). Provide the risk ratings and mitigations, and confirm the facts:
  - which processors (Vercel, Neon, Resend, Tally, Microsoft Clarity) and their regions (ENG-09 records Neon and Vercel)
  - which data categories, including gender (private, used for matching) and verification outcomes
  - access by staff
  - retention
  - transfers out of Nigeria and the UK
- **Exit criteria:** the DPIA risk table is complete, with the security reviewer's ratings; open items are handed to the founder and counsel.

## SEC-12: Back office MVP

- **Scope:** ENG-07, 11, 13, 16, 21, 22, 23, 24 and DES-11.
- **Threats to check:**
  - **Role matrix enforced on the server** (ENG-24), with no client-only hiding.
  - **Every staff mutation audited** with `actorType = "staff"` in the same transaction.
  - **Staff reads of individuals audited** (`staff.user_viewed`, `staff.contact_revealed`, `staff.audit_viewed`).
  - User search can't be used to enumerate emails (exact match only).
  - The report "staff note" never reaches audit, outbox, export or member-facing surfaces.
  - The CSV export (ENG-16) contains counts only.
  - CSRF on staff POST routes. Cookies are `SameSite=Lax`; confirm there are no state-changing GETs.
  - Concurrent moderator actions (409s).
  - Back office pages masked from Clarity.
  - `/staff` returns 404 to members.
  - An admin can't be suspended by a moderator.
- **Exit criteria:** a negative test per route and role; an audit row asserted for every staff action in e2e_beta; no Blocker or High open at 27 Nov.
