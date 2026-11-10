import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

const PENDING_DAYS = 30;

// POST /api/v1/staff/access-requests/purge {dry_run?}   (admin only; 404 otherwise) — HM-30.
// Deletes access requests that were declined, or have been pending for more than 30 days,
// with their unused invites. Invited requests stay (their invite says who asked). Audited
// with counts only. dry_run → the counts, nothing deleted.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const staff = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const cutoff = new Date(Date.now() - PENDING_DAYS * 24 * 60 * 60 * 1000);
  const where = { OR: [{ status: "declined" }, { status: "pending", createdAt: { lt: cutoff } }] };
  const ids = (await prisma.accessRequest.findMany({ where, select: { id: true, status: true } }));
  const declined = ids.filter((r) => r.status === "declined").length;
  const counts = { declined, stale_pending: ids.length - declined };
  if (body.dry_run === true) return ok({ dry_run: true, ...counts }, rid);

  const result = await prisma.$transaction(async (tx) => {
    const reqIds = ids.map((r) => r.id);
    const invites = await tx.invite.deleteMany({ where: { accessRequestId: { in: reqIds }, usedAt: null } });
    const requests = await tx.accessRequest.deleteMany({ where: { id: { in: reqIds }, ...where } });
    await writeAudit(tx, {
      eventType: "access.purged",
      actorType: "staff",
      actorId: staff.id,
      resourceType: "access_request",
      resourceId: "purge",
      action: "purge",
      safeAfter: { requests: requests.count, invites: invites.count, ...counts },
    }, rid);
    return { requests: requests.count, invites: invites.count };
  });
  return ok({ dry_run: false, ...counts, deleted_requests: result.requests, deleted_invites: result.invites }, rid);
});
