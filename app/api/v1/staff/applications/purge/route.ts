import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/guard";
import { purgeApplications } from "@/lib/applicationPurge";

// POST /api/v1/staff/applications/purge {dry_run?}   (admin only; 404 otherwise) — R7.
// Deletes stale drafts (30 days untouched), and declined or withdrawn applications 30 days
// after the decision: the answers and the applicant account. A declined person's hashed email
// and reapply date are kept until that date. Audited with counts only. dry_run → counts only.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const staff = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  return ok(await purgeApplications({ dryRun: body?.dry_run === true, staffId: staff.id, rid }), rid);
});
