import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser, requireHomesEnabled } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";
import { recordViewingOutcome } from "@/lib/household";
import { afterViewingOutcome } from "@/lib/demoBots";

// POST /api/v1/viewings/[id] {action: accept|cancel|outcome, response?, expected_version?}
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  requireHomesEnabled();
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const v = await prisma.viewing.findUnique({
    where: { id: params.id },
    include: { household: { include: { memberships: true } } },
  });
  if (!v || !v.household.memberships.some((m) => m.userId === user.id))
    return fail("NOT_FOUND", "Viewing not found.", 404, rid);
  const otherId = v.household.memberships.find((m) => m.userId !== user.id)!.userId;

  if (body.expected_version != null && body.expected_version !== v.version)
    return fail("VERSION_CONFLICT", "This viewing changed. Refresh and retry.", 409, rid);

  if (action === "accept") {
    if (v.proposedBy === user.id)
      return fail("FORBIDDEN", "Wait for your housemate to confirm the slot.", 403, rid);
    if (v.state !== "awaiting_partner")
      return fail("STATE_CONFLICT", "This viewing can't be confirmed now.", 409, rid);
    await prisma.$transaction(async (tx) => {
      await tx.viewing.update({ where: { id: v.id }, data: { state: "confirmed", version: v.version + 1 } });
      await writeAudit(tx, { eventType: "viewing.confirmed", actorId: user.id, subjectId: otherId, resourceType: "viewing", resourceId: v.id, action: "confirm" }, rid);
      await writeOutbox(tx, "viewing_confirmed", { viewingId: v.id });
      await notify(tx, otherId, "viewing_change", "Viewing confirmed", "Your viewing is confirmed.");
    });
    return ok({ state: "confirmed" }, rid);
  }

  if (action === "cancel") {
    if (!["awaiting_partner", "confirmed", "proposed"].includes(v.state))
      return fail("STATE_CONFLICT", "This viewing can't be cancelled.", 409, rid);
    await prisma.$transaction(async (tx) => {
      await tx.viewing.update({ where: { id: v.id }, data: { state: "cancelled", version: v.version + 1 } });
      await writeAudit(tx, { eventType: "viewing.cancelled", actorId: user.id, resourceType: "viewing", resourceId: v.id, action: "cancel" }, rid);
      await writeOutbox(tx, "viewing_cancelled", { viewingId: v.id });
      await notify(tx, otherId, "viewing_change", "Viewing cancelled", "A viewing was cancelled.");
    });
    return ok({ state: "cancelled" }, rid);
  }

  if (action === "outcome") {
    const response = body.response;
    if (!["completed", "no_show"].includes(response))
      return fail("VALIDATION", "Invalid outcome.", 422, rid);
    await recordViewingOutcome({ viewingId: v.id, userId: user.id, response, rid });
    await afterViewingOutcome(v.id, response);
    const fresh = await prisma.viewing.findUnique({ where: { id: v.id } });
    return ok({ state: fresh?.state }, rid);
  }

  return fail("VALIDATION", "Unknown action.", 422, rid);
});
