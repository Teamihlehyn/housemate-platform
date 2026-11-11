---
name: feedback-terminology-users
description: Founder rule (2026-11-10): call the people who use Peabudy "users" (or "customers" in business context), never "members"; lifecycle visitor → applicant → user; staff = back office
metadata:
  type: feedback
---

Write "user" or "users" (or "customers" in a business context) for the people who use Peabudy. Never write "member" or "members".

Lifecycle words:
- **visitor** → **applicant** (has applied, not yet approved) → **user** (approved and active)
- **staff** are the back office

Code identifiers stay exactly as they are, in backticks:
- the stored role value `member` (explain it as "the user role")
- `requireMember()`
- `Membership`
- `members/[id]` page paths
- `member_unavailable`

**Why:** the founder said "Let's stick to using users or customers so I don't mix them up."

**How to apply:**
- Use these words in every doc, ticket, report and piece of copy.
- When renaming, use case-sensitive replacement, then restore the code identifiers above.
- Related: [[project-beta-launch]].
