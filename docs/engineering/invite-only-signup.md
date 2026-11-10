# Invite-only sign-up (D15) — design record

Status: built 10 Nov 2026, awaiting security review. Owner: engineer.

## Flow

1. `POST /api/v1/access-requests` (public) stores an `AccessRequest` and always answers
   `202 {status: "received"}` for valid input — new, duplicate-pending, or already a member.
2. Staff review at `/staff` → Access requests. `invite` creates an `Invite` (14 days, single
   use, bound to the request's email) and emails `<site>/invite/<CODE>` through Resend. The
   response also returns the link so staff can send it by hand if email fails.
3. `/invite/[code]` calls `GET /api/v1/invites/[code]` → `{valid, email_hint?}`.
4. `request-code {email, invite_code}`: for an address with no account in beta, the invite
   must be usable by that address. Its id is stored on the `AuthCode` row.
5. `verify-code` consumes the code and the invite in one transaction with the user insert
   (`updateMany … where usedAt is null and expiresAt > now`); if the invite was used in the
   meantime the transaction rolls back, the code survives, and the answer is 422 `INVITE_INVALID`.

Only `sha256(code)` is stored. Codes are 8 characters from a 29-character alphabet with no
look-alikes (≈ 5 × 10^11). Existing accounts (any status) and `ADMIN_EMAILS` never need an
invite; `invite_code` is ignored for them. Demo modes (`development`, `staging`, `research`)
are not invite-only (`INVITE_ONLY = IS_BETA`). `SIGNUPS_PAUSED=true` refuses every new
account, invite or not (403 `FORBIDDEN`), in both request-code and verify-code.

## Enumeration decision

An inline "you need an invite" error necessarily tells someone who already knows an address
that it has no account: an existing member gets "sent", an unknown address gets
`403 INVITE_REQUIRED`. Options considered:

| Option | Leak | UX |
|---|---|---|
| A. Inline `INVITE_REQUIRED` (chosen) | Account existence, for an address you already know | Clear, immediate |
| B. Always "sent"; unknown addresses get an email "you need an invite" | None at the API | Confusing: a stranger waits for a code that never comes |

We chose A because the founder's flow (and the designer's sign-in page) depends on the inline
error, and the information is low-value for a small Lagos pilot. Mitigations:

- The answer is identical for every unknown address, with or without a code that looks valid,
  and whether or not the address is staff.
- Refusals (`invite_required`, `invite_invalid`, `signups_paused`) write the same
  `auth.code_requested` audit row keyed by the salted IP bucket, so they count towards the
  per-IP cap (10 an hour per IP / IPv6 /64). Bulk probing is capped like code requests.
- `invite_code` is ignored for existing accounts, so a code can't be used as a second oracle.
- `POST /access-requests` never reveals membership (always 202).
- `GET /invites/[code]` returns the same `{valid: false}` for unknown, expired and used codes,
  a masked hint only (`ad•••@gmail.com`), and is capped at 30 checks an hour per IP bucket.

Residual: someone who already knows an email can learn whether it has an account, at up to
10 checks an hour per IP. If the security review wants B instead, the change is contained in
`request-code` (return `sent` and send an "ask for an invite" email) plus the sign-in copy.

## HM-26

Over the site-wide cap (300 emailed codes an hour) everyone, staff included, gets
`429 RATE_LIMITED` "We're getting a lot of sign-in requests right now. Try again in an hour."
with `Retry-After: 3600`. Members wait 150–500 ms of jitter; staff codes are still created and
emailed (the send stands in for the jitter, and a send failure doesn't change the answer).

## After the security review (SEC-14, 10 Nov)

- **HM-29:**
  - Site-wide caps: 300 `GET /invites/[code]` checks an hour, and 300 wrong invite codes an hour at `request-code`.
  - Over the second cap, every invite sign-up attempt gets 429, valid or not, so the cap can't be used as an oracle.
  - Both counts are shown to staff above the Access requests queue.
  - Unbound codes last 72 h.
  - Invites can be revoked (`POST /staff/invites/[id] {action:"revoke"}`, any staff role); resend and decline also revoke the earlier invite.
- **HM-31:** direct invites (`GET`/`POST /staff/invites`) are admin-only (404 otherwise). The access-request queue stays open to every staff role. PM to decide whether to restrict it.
- **HM-30:**
  - `POST /staff/access-requests/purge` (admin) deletes declined requests and those pending more than 30 days, with their unused invites. It's audited with counts only.
  - Account deletion removes the person's access request and nulls `Invite.email`.
  - `/me/export` includes the access request, invites and survey sends.
