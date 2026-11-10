import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireStaff } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { inviteState } from "@/lib/invites";

// POST /api/v1/staff/invites/[id] {action: "revoke"}   (any staff role — revoking only
// ever reduces access). The code then answers {valid:false} and can't create an account.
// 404 unknown id; 409 STATE_CONFLICT if it was already used or revoked. Idempotency is by
// state: revoking twice is a 409, not a second audit row.
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const staff = await requireStaff();
  const body = await req.json().catch(() => ({}));
  if (body.action !== "revoke") {
    return fail("VALIDATION", "Action must be revoke.", 422, rid, { field_errors: { action: "Unknown action." } });
  }
  const inv = await prisma.invite.findUnique({ where: { id: params.id } });
  if (!inv) return fail("NOT_FOUND", "This invite doesn't exist.", 404, rid);
  const done = await prisma.$transaction(async (tx) => {
    const n = await tx.invite.updateMany({ where: { id: inv.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    if (n.count !== 1) return false;
    await writeAudit(tx, {
      eventType: "invite.revoked",
      actorType: "staff",
      actorId: staff.id,
      resourceType: "invite",
      resourceId: inv.id,
      action: "revoke",
      safeBefore: { state: inviteState(inv) },
    }, rid);
    return true;
  });
  if (!done) return fail("STATE_CONFLICT", "This invite was already used or revoked.", 409, rid);
  return ok({ id: inv.id, state: "revoked" }, rid);
});
