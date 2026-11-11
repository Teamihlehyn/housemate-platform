# Approval-first sign-up: API contract (ENG-39 to ENG-45)

Status: **final contract, 10 Nov 2026; updated 11 Nov** (engineer): staff back office only
(ENG-46), staff allowlist (HM-10), city lock (R5), own-account note on approve, E4 call link,
queue fields for DES-23. Spec:
[`docs/product/beta/approval-first-signup.md`](../product/beta/approval-first-signup.md). The
designer builds `/join`, `/join/status`, `/invite/[code]`, `/signin` and the landing CTAs against
this file. Anything not listed here is unchanged.

Every response uses the usual envelope: `{ data, meta }` or
`{ error: { code, message, field_errors, retryable }, meta }`. Show `error.message` to people;
it is written to be shown. Dates are ISO 8601 UTC strings; move-in dates stay `YYYY-MM-DD`.

## Where it applies

`APPROVAL_FIRST` is on in **beta** (staging and production). In the demo modes
(`development`, `staging`-as-demo, `research`) sign-in stays open (anyone gets a code, an
account is created on first sign-in), but every `/applications/*` route below works too, so the
`/join` UI can be built and clicked through locally in any mode. In demo modes codes come back
on screen as `sink_code` (never for staff); in beta they are only emailed.

## Sessions

One cookie, `hm_session` (HttpOnly, 7 days), now with a **scope**:

| Scope | Who | Can call |
|---|---|---|
| `application` | `accountStatus = "applicant"` | `GET /me`, `PATCH /me/profile`, `PATCH /me/search`, `GET/PATCH /me/preferences`, `GET /me/export`, `POST /me/delete`, `POST /feedback`, `/applications/*`, `POST /auth/logout` |
| `member` | `accountStatus = "active"` (or `restricted`), role `member` | everything, as today |
| staff | effective role verifier / moderator / admin (allowlist, below) | `/staff/*`, `GET /me`, `GET /me/export`, `POST /me/delete`, `POST /auth/logout`. Every user API is 404; user pages redirect to `/staff` |

An application session calling any other API route (`/recommendations`, `/users/[id]`,
`/introductions`, `/conversations`, `/households`, `/notifications`, `/staff/*`,
`/me/search/publish`, `/me/search/status` …) gets **404 `NOT_FOUND`**, the same body as a
missing resource. The signed-in pages under `app/(app)/` redirect an applicant: `draft` →
`/join`, any other status → `/join/status`. Activation replaces every session the person has
with one user session.

### Staff (ENG-46, HM-10)
Staff access comes only from the environment: `ADMIN_EMAILS` (admin) and
`STAFF_EMAILS="a@x.com:verifier,b@x.com:moderator"`. A stored role counts only while the address
is listed (beta and every Vercel deployment); sign-in sets the stored role to the listed one, or
back to `member`, audited (`staff.role_granted` / `staff.role_revoked`). Staff are back-office
only: never in matching, profiles or introductions. The founder tries the product with a
separate user account (applied through `/join` like anyone).

## 1. Applying: `/join`

### `POST /api/v1/applications/start`
Body `{ email: string, consent_privacy: true }`.

- **200** `{ status: "sent", message: "We've sent a 6-digit code to that address. It expires in 10 minutes.", sink_code?: "123456" }`
  for **every** valid address (new, applicant, user, declined, suspended). The code always
  goes to the address itself (E0), after the response.
- 422 `VALIDATION` (`field_errors.email`) · 422 `CONSENT_REQUIRED` (`field_errors.consent_privacy`)
- 403 `FORBIDDEN` while `SIGNUPS_PAUSED=true`: "We're not taking new applications for a few days. Please try again later."
- 429 `RATE_LIMITED` (+ `Retry-After`): per address (5 an hour, shared with sign-in), per
  connection (10 an hour), or the site-wide busy message (HM-26).

### `POST /api/v1/applications/verify`
Body `{ email, code }`. Sets the cookie when it returns a session.

**200** `{ outcome, application?, user? }`:

| `outcome` | When | Session | Next screen |
|---|---|---|---|
| `"application"` | new address (an applicant + draft application are created), or an existing applicant | `application` | `application.status === "draft"` → the questions; anything else → `/join/status` |
| `"member"` | the address is an active user (proved by the code; not a bypass) | `member` | `/discover` |
| `"unavailable"` | suspended, being deleted, or an allowlisted staff address with no account yet | none | neutral page: "We can't take an application from this address. Contact hello@peabudy.com." |

`user` (`outcome: "member"` only) = `{ id, displayName, role }`, plus `redirect`: `"/staff"`
for staff, `"/discover"` otherwise. **Staff at `/join`:** staff can't apply. An existing staff
account that proves its address is signed in to the back office (`outcome: "member"`,
`redirect: "/staff"`, codes always emailed, never on screen); an allowlisted address with no
account gets `"unavailable"` (staff sign in at `/signin`). A user whose privacy consent is out of
date is re-consented by the step-1 tick (or `accept_privacy: true`), else 422 `CONSENT_REQUIRED`. `application` is the status
object below.
A declined applicant before `reapply_after` gets `outcome: "application"` with
`status: "declined"` (no new application). After that date, or after a withdrawal, the same
application reopens as a `draft` with the earlier answers kept.

Errors, the same as sign-in: 422 `CODE_EXPIRED` · 422 `INVALID_CODE` (`field_errors.code`) ·
429 `TOO_MANY_ATTEMPTS` · 403 `FORBIDDEN` (signups paused, new address only).

### The application status object
```jsonc
{
  "status": "draft" | "submitted" | "in_review" | "call_booked" | "approved" | "declined" | "waitlisted" | "withdrawn",
  "city": "lagos" | "london" | null,
  "city_open": true,              // false → "London opens later" wording
  "submitted_at": "…" | null,
  "call_at": "…" | null,          // set by staff when the ID call is booked
  "reapply_after": "…" | null,    // declined only
  "can_edit": true,               // draft or submitted (session only)
  "can_withdraw": true,           // draft, submitted, in_review, call_booked, waitlisted, approved (session only)
  "read_only": false              // true when read through the magic link
}
```
Show `submitted` and `in_review` the same way ("We'll email you within a day to book a
10-minute video ID call"). `approved`: "Check your email for your invite".

### Answers (autosave)
`PATCH /api/v1/me/profile` and `PATCH /api/v1/me/search` work unchanged for applicants (same
fields, validation and `field_errors` as onboarding today), while the application is `draft`
or `submitted`. Other statuses: 409 `STATE_CONFLICT` "Your application is being reviewed, so
your answers are locked. Email hello@peabudy.com if something needs changing."
The questions and options must stay exactly as onboarding has them. Gender stays optional.
`displayName` is the first name.

### `POST /api/v1/applications/submit`
Body `{ survey_opt_in?: boolean }` (only an explicit `true` opts in; recorded as source
`onboarding`).

- **200** `{ application }` with status `submitted`, or `waitlisted` when the city isn't in
  `OPEN_CITIES` (default `lagos`). Sends E1 (E5 wording when waitlisted) with the status link.
- 422 `INCOMPLETE`: `message` lists what's missing, `field_errors` has one entry per missing
  field. Keys: `journey`, `displayName`, `bio`, `cityId`, `areaIds`, `budget`, `moveMode`,
  `dates`, `stay`, `preferences`, `email`. The draft is kept.
- 422 `UNDECIDED_DATES`: "Choose exact or ranged move-in dates before you submit."
- 409 `STATE_CONFLICT`: not a draft.

### `GET /api/v1/applications/status`
- With the application session: `{ application }`.
- Signed out with the magic link: `GET /api/v1/applications/status?t=<token>` →
  `{ application }` with `read_only: true`, `can_edit: false`, `can_withdraw: false`. The page
  is `/join/status?t=<token>`; the token comes from E1 and stays valid until the application
  is reopened.
- 404 `NOT_FOUND` for a bad token or no application. 401 `UNAUTHENTICATED` without either.

### `POST /api/v1/applications/withdraw`
Body `{}`. **200** `{ application }` (`withdrawn`; any activation code stops working).
409 `STATE_CONFLICT` when already declined or withdrawn.

### Data and deletion (status page)
`GET /api/v1/me/export` (now includes `application`) and `POST /api/v1/me/delete` work for
applicants ("Download my data", "Delete my application"). Deleting withdraws the application.

### `GET /api/v1/me`
Adds `application` (the status object, or `null` for users who never applied),
`nameLocked: boolean` and `sessionScope: "application" | "member"`.

## 2. Sign-in: `/signin` (users only)

### `POST /api/v1/auth/request-code`
Body `{ email }`. `invite_code` is gone (ignored if sent).

- **200** for every well-formed address, identical body:
  `{ status: "sent", message: "If you have an approved Peabudy account, we've sent a code. New here? Apply to join." }`
  (plus `sink_code` in demo modes only). A code is emailed only to active users and
  `ADMIN_EMAILS`; nobody else gets an email. The send happens after the response and every
  answer is padded to the same minimum time.
- 422 `VALIDATION` (malformed email only).
- 429 `RATE_LIMITED`: per address, per connection or site-wide; counted the same way whether
  or not the address has an account.
- `INVITE_REQUIRED` and `INVITE_INVALID` no longer exist here.

### `POST /api/v1/auth/verify-code`
Body `{ email, code, accept_privacy? }`. **200** `{ user, is_new, redirect }` where `redirect` is
`"/staff"` for staff and `"/discover"` for users: go there. An applicant, unknown, declined or
suspended address gets the same 422 `INVALID_CODE` as a wrong code.

## 3. Activation: `/invite/[code]`

### `GET /api/v1/invites/[code]`
→ `{ valid: true, email_hint: "ad•••@gmail.com" }` or `{ valid: false }` (unknown, expired,
used, revoked, withdrawn, or you're signed in as someone else). 30 checks an hour per
connection, 300 site-wide (429 `RATE_LIMITED`).

### `POST /api/v1/invites/[code]`
Body `{}`. Emails a sign-in code (E0) to the address the invite is bound to.
- **200** `{ status: "sent", email_hint, sink_code? }`
- 422 `INVITE_INVALID`: "This activation link isn't valid any more. Sign in if you've already activated, or contact hello@peabudy.com."
- 429 `RATE_LIMITED`.

### `POST /api/v1/auth/verify-code` with an activation code
Body `{ activation_code, code, accept_privacy? }` (`email` not needed). In one transaction:
consume the invite, `accountStatus = active`, publish the profile, activate the search, replace
the sessions with one user session, audit `application.activated`.
- **200** `{ user, is_new: false, activated: true, redirect: "/discover" }`
- 422 `INVITE_INVALID` (same message as above) · 422 `CODE_EXPIRED` / `INVALID_CODE` ·
  422 `CONSENT_REQUIRED` · 429 `TOO_MANY_ATTEMPTS`.

"Have an activation code?" on `/signin` should take the typed code to `/invite/<CODE>`
(any case, spaces or hyphens are fine).

## 4. Users after activation

- `PATCH /api/v1/me/profile` with a **changed** `displayName` once the application is approved
  → 409 `STATE_CONFLICT` "Your name was checked with your ID, so it can't be changed here. Email
  hello@peabudy.com if it's wrong." Sending the same name again is fine. `GET /me` has
  `nameLocked: true`: show the name read-only.
- **City lock (R5):** `PATCH /api/v1/me/search` with a **different** `cityId` once approved →
  422 `VALIDATION`, `field_errors.cityId`, message "Your city is fixed once you're approved.
  Email hello@peabudy.com if you're moving city." Areas in the same city stay editable.
- **`/onboarding` rule (designer):** if `GET /me` returns `accountStatus === "active"` and
  `profile.publicationStatus === "published"`, `redirect("/profile")`. Applicants never reach
  `/onboarding` (the layout sends them to `/join` or `/join/status`). A user whose profile is
  still a draft (only possible in demo modes) keeps the current onboarding.

## 5. Back office: Applications (`/staff`)

The console lives at `/staff` in its own shell (`app/(staff)/`), with no product UI. Any staff
role can view; `verifier` and `admin` act; `moderator` gets 404 on actions; the audit explorer
and survey tools are admin-only. Nobody can view or act on their own application (404).
Visitors, users and applicants get **404** on `/staff` and every `/staff/*` API.

- `GET /api/v1/staff/applications?status=submitted|in_review|call_booked|waitlisted|declined|approved|all&city=&area=`
  (default `submitted`; `declined` = last 30 days). Oldest first. Each row:
  `{ id, version, display_name, city, city_open, areas[{id,label}], status, submitted_at, call_at, waiting_hours, waiting_label: "On time" | "Over 24 h" | "Over 72 h", cluster: { area_matches, members, applicants } }`.
  `cluster` counts other people in the same city sharing at least one area: `members` = active,
  published users; `applicants` = other applications submitted, in review, call booked or
  approved-not-activated; `area_matches` = the sum. Counts per filter: `counts` (every status).
  plus `counts` per status.
- `GET /api/v1/staff/applications/[id]` → the full review view (audited
  `staff.application_viewed`): email, profile, city, areas, budget (with monthly equivalent),
  move-in window, stay, habits (`own`, `accepted[]`, `ruled_out[]` = "won't live with"),
  `missing[]`, `waiting_hours`, `private_hidden: true`, the activation state when approved.
- `POST /api/v1/staff/applications/[id]/reveal` → `{ gender, gender_preference }` (audited
  `staff.application_private_revealed`).
- `POST /api/v1/staff/applications/[id]` `{ action, expected_version, … }`. `expected_version`
  is **required** for `approve` and `decline` (422 without it, 409 `VERSION_CONFLICT` when
  stale). An applicant's own edits also bump the version (HM-36).

| `action` | From | Extra body | Result |
|---|---|---|---|
| `start_review` | submitted, waitlisted | | `in_review` |
| `call_booked` | submitted, in_review, call_booked | `call_at` (ISO, future), `send_email?: boolean` (E4), `call_link?` (https, ≤ 300, email only, not stored) | `call_booked` |
| `approve` | in_review, call_booked (both lock the applicant's answers) | `id_check_confirmed: true`, `id_check_method: "video"`, `own_account?: boolean`, `relationship_note?` (≤ 300; **required, 5+ characters, when `own_account` is true**) | `approved`; identity verified; E2 sent; note audited |
| `decline` | submitted, in_review, call_booked, waitlisted, approved | `reason`: `not_genuine` \| `agent_or_landlord` \| `id_failed` \| `no_show` \| `duplicate` \| `other` | `declined`, reapply after 30 days; E3 sent |
| `waitlist` | submitted, in_review, call_booked | | `waitlisted` |
| `resend_activation` | approved | | new code, old one revoked; E2 sent |

  Response `{ application, activation_url?, activation_code?, email_status? }` where
  `email_status` ∈ `sent | not_configured | failed | not_requested` (staff can copy the link if
  the email fails). Errors: 404 · 409 `STATE_CONFLICT` · 409 `VERSION_CONFLICT` · 422
  `VALIDATION` · 422 `INCOMPLETE` (approve on an incomplete profile) · 409 `STATE_CONFLICT`
  (approve while the city isn't open).

- `POST /api/v1/staff/applications/purge {dry_run?}` (admin only; 404 otherwise) → counts
  `{ stale_drafts, declined, withdrawn, expired_tombstones }` (+ `deleted_accounts`,
  `tombstones_kept` when not a dry run). Deletes, with the applicant account and answers: drafts
  untouched for 30 days, declined and withdrawn applications 30 days after the decision. Never
  touches users (active, restricted or suspended). A declined person keeps only a hashed email
  and their reapply date; if they come back to `/join` before it, verify shows the declined
  status again. Audited `application.purged`, counts only.

Retired: `POST /access-requests`, `/staff/access-requests/*` actions, `GET/POST /staff/invites`.
`GET /staff/access-requests` (read-only) and its purge stay until the old rows are gone.
`/request-access` redirects to `/join` (in `next.config.ts`), so the page file can be deleted.

## 6. Emails

Templates live in `docs/design/emails/<name>.html` + `.txt`; the subject is the HTML `<title>`.
Run `node scripts/sync-email-templates.mjs` after adding them. Until a template exists the app
sends a plain built-in version. Placeholders (all HTML-escaped by the app):

| Name | Email | Placeholders |
|---|---|---|
| `code` | E0 sign-in / application code | `{{code}}` |
| `application_received` | E1 submitted | `{{first_name}}`, `{{status_url}}` |
| `application_waitlisted` | E1 + E5 waitlisted | `{{first_name}}`, `{{status_url}}`, `{{city_name}}` |
| `approved` | E2 | `{{first_name}}`, `{{activation_url}}`, `{{code}}`, `{{expires_on}}` |
| `declined` | E3 | `{{first_name}}`, `{{reapply_on}}` |
| `call_booked` | E4 | `{{first_name}}`, `{{call_time}}` (e.g. "Thursday 19 November, 14:30 (Lagos time)"), `{{call_link}}` (the https video link, or "We'll send you the video link before the call.") |

Every send writes an `email.sent` audit row without the address.
