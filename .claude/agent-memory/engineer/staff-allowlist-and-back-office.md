---
name: staff-allowlist-and-back-office
description: Founder decisions (10 Nov 2026) on staff roles and the back office, which every guard or staff feature must respect
metadata:
  type: project
---

Staff roles come only from env allowlists (ADMIN_EMAILS, STAFF_EMAILS "email:role"); a stored
role alone is never trusted. Staff are back-office only: own /staff shell, 404 on every member
API, never in matching/profiles/intros; the founder uses a separate member account to try the
product (approving it needs a declared own-account note).

**Why:** HM-10 incident (a stored admin not in ADMIN_EMAILS could open /staff on staging), and
the founder's "back office should strictly be back office activity".

**How to apply:** new staff routes use requireStaff/requireAdmin (404 for everyone else); new
product routes use requireUser (404 for staff and applicants); any new "who can appear" query
uses productAccountWhere()/isStaffAccount from lib/staff.ts. See [[testing-other-modes]].
