# Applications queue: design and requests for the engineer (DES-23)

Replaces the DES-17 "Access requests" tab and the separate "Identity checks" list. The engineer
owns `app/(app)/staff/Applications.tsx` (working version exists); this file is the layout and copy
to apply. Contract: [approval-first-api.md §5](../engineering/approval-first-api.md).

Acceptance (spec): a reviewer can approve or decline from a phone at 375 px; private fields are
hidden by default; every state has one obvious next action.

## 1. Queue (list)

**Phone (≤ 767 px)**

```
Applications                                   [↻]
[New 4] [In review 1] [Call booked 2] [Waitlisted 3] [Approved] [Declined (30 days)]   ← wraps, never scrolls hidden
City [All cities ▾]
──────────────────────────────────────────────
│ Ada · Lagos                     ⚠ Over 24 h · 31 h │
│ Yaba, Surulere                                       │
│ New · sent 10 Nov, 14:02 · 3 people in these areas   │
──────────────────────────────────────────────
```

**Desktop (≥ 768 px):** the same filter row, then a table: Name · City · Areas · Status · Sent ·
Waiting · Call · Area cluster. The whole row is the button (≥ 44 px tall). Oldest first.

Requests:
1. **Filters wrap** (`flex-wrap`) instead of scrolling sideways: the hidden "Declined" filter had
   no visual cue at 360 px (same issue as DES-19's tab row).
2. **Counts on every filter** including zero: "New (0)" tells a reviewer the queue is clear.
3. **Waiting chip carries words and an icon, not only colour**: "On time · 6 h" (neutral),
   "Over 24 h · 31 h" (caution-100/caution-800 with a clock icon), "Over 72 h · 80 h"
   (danger-50/danger-700). Use the design tokens (`caution-*`, `danger-*`), not `amber-*`/`red-*`.
4. **Dates as "10 Nov, 14:02"** (`{ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }`),
   with the city's time zone for `call_at` ("Thu 19 Nov, 14:30 Lagos time").
5. **Cluster wording**: "3 users want these areas" is ambiguous before activation; use "3 people
   in these areas" only if it counts active users, otherwise "3 other applicants in these areas".
   Say which in the copy (engineer to confirm what `area_matches` counts).
6. **Empty states:** New → "No new applications. You're up to date." Call booked → "No calls
   booked." Declined → "Nobody declined in the last 30 days."
7. **"City not open"** chip → "London: opens later" (sky-100/sky-800), matching the applicant's
   own wording.

## 2. Detail

**Order (phone, one column; desktop: two columns, profile left 60 %, actions right 40 % sticky):**

1. Back to applications (top left, ghost, 44 px).
2. Header: name (h1), status chip, "Sent 10 Nov, 14:02 · waiting 31 h", email with a Copy
   button (needed to book the call). Mask the email with `data-clarity-mask`.
3. **Profile as other users will see it** (a card styled like `/members/[id]`): name, areas, budget
   range (with monthly equivalent for NGN), move-in window, stay, journey, bio.
4. **Matching answers**: six habits with "own answer" and "dealbreakers" (only the ruled-out values,
   e.g. "Won't live with: smokers"). Then a `missing` list in danger text if incomplete:
   "Missing: bio, stay" (approve will refuse).
5. **Private fields** (collapsed card): "Gender and housemate preference are hidden. Open them
   only if you need them for this review. Opening them is logged." Button **Show private fields**.
   After reveal: the two values and "Shown to you at 14:10. Logged."
6. **Actions card** (sticky bottom on desktop; at the end on phones), by status:

| Status | Primary | Secondary |
|---|---|---|
| submitted | Start review | Book call · Decline · Waitlist |
| in_review | Book call | Approve · Decline · Waitlist |
| call_booked | **Approve** (after the confirmation) | Change call time · Decline · Waitlist |
| waitlisted | Start review (when the city opens) | Decline |
| approved | Resend activation | Decline |
| declined | — ("Declined 10 Nov. They can reapply from 10 Dec.") | — |

   - **Book call:** `datetime-local` labelled "Call date and time (Lagos time)", checkbox
     "Email them the time (E4)" ticked by default, button "Save call time". Show the E4 subject
     under it so the reviewer knows what goes out.
   - **Approve** is a two-step block, never one tap: a required checkbox "I saw a photo ID that
     matches this person on a video call, and they're 18 or over" (method fixed to video, shown as
     text "Method: video call"), then **Approve** (`btn-confirm`, the green agreement colour).
     Keep the button enabled; if unticked, explain under it ("Tick the ID confirmation first.").
   - **Decline:** a radio list of the six reasons (not a select: 44 px rows, readable on phones),
     a note "The applicant won't see the reason. They get a kind, generic email and can reapply
     in 30 days.", then **Decline** (`btn-danger`) with an inline confirm "Decline Ada? Yes, decline · Cancel".
   - **Waitlist:** ghost button with helper "For cities that aren't open yet."
   - **Resend activation:** "Resend activation" + "The old link stops working."
7. **After an action:** a `role="status"` line at the top of the actions card, e.g.
   "Approved. Activation email sent." If `email_status` is `failed` or `not_configured`, show the
   activation link and code in a copyable box with "The email didn't send. Copy the link and send
   it to them yourself, from hello@peabudy.com." and a **Copy link** button. Never show the code
   anywhere else.
8. **Conflicts:** `VERSION_CONFLICT` → "Someone else changed this application. Reload to see the
   latest." with a Reload button; keep the reviewer's unsaved inputs.

## 3. Roles and safety copy

- Moderators see the detail without the actions card, replaced by "You can view applications. A
  verifier or admin approves and declines."
- Own application → 404 (the server). No special UI.
- Nothing in the queue says "verified" or "safe". The approved chip is "Approved"; the identity
  check row on user profiles stays "Identity: checked by our team".

## 4. Copy table

| Key | Copy |
|---|---|
| Tab | Applications |
| Filters | New · In review · Call booked · Waitlisted · Approved · Declined (30 days) |
| Waiting | On time · Over 24 h · Over 72 h (+ hours) |
| Private | Show private fields · "Opening them is logged." |
| Approve check | I saw a photo ID that matches this person on a video call, and they're 18 or over |
| Decline reasons | Doesn't look genuine · Agent or landlord · ID check didn't pass · Didn't attend the call · Duplicate · Other |
| Decline note | The applicant won't see the reason. They get a kind, generic email and can reapply in 30 days. |
| Email failed | The email didn't send. Copy the link and send it to them yourself, from hello@peabudy.com. |

"ID check failed" → "ID check didn't pass" (plainer, less accusatory if it's ever read aloud).

Not verified in the browser by the designer: staff access in local beta needs `ADMIN_EMAILS`,
which wasn't set this round.
