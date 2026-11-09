import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { handler, ok, fail } from "@/lib/api";
import { requireUser, requireHomesEnabled } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";
import { recordHandoffConsent, requirePlanAgreed } from "@/lib/household";
import { afterHandoffActivity } from "@/lib/demoBots";

// POST /api/v1/handoffs/[id] {action: consent|withdraw, payload_hash?, expected_version?}
// Submission happens server-side only after every member consents.
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  requireHomesEnabled();
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const h = await prisma.handoff.findUnique({
    where: { id: params.id },
    include: { household: { include: { memberships: true } } },
  });
  if (!h || !h.household.memberships.some((m) => m.userId === user.id))
    return fail("NOT_FOUND", "Application not found.", 404, rid);
  const otherId = h.household.memberships.find((m) => m.userId !== user.id)!.userId;

  if (body.expected_version != null && body.expected_version !== h.version)
    return fail("VERSION_CONFLICT", "This application changed. Review and consent again.", 409, rid);

  if (action === "consent") {
    await requirePlanAgreed(h.householdId);
    const result = await recordHandoffConsent({
      handoffId: h.id,
      userId: user.id,
      payloadHash: body.payload_hash ?? createHash("sha256").update(`${h.id}:${user.id}:v${h.version}`).digest("hex"),
      rid,
    });
    await afterHandoffActivity(h.id);
    const fresh = await prisma.handoff.findUnique({ where: { id: h.id } });
    return ok({ state: fresh?.state ?? result.state, decision: fresh?.decision ?? result.decision }, rid);
  }

  if (action === "withdraw") {
    if (!["awaiting_member_consent", "submitted"].includes(h.state))
      return fail("STATE_CONFLICT", "This application can't be withdrawn.", 409, rid);
    await prisma.$transaction(async (tx) => {
      await tx.handoff.update({ where: { id: h.id }, data: { state: "withdrawn", version: h.version + 1 } });
      await tx.household.update({ where: { id: h.householdId }, data: { derivedStage: "planning" } });
      await writeAudit(tx, { eventType: "handoff.withdrawn", actorId: user.id, resourceType: "handoff", resourceId: h.id, action: "withdraw" }, rid);
      await writeOutbox(tx, "handoff_withdrawn", { handoffId: h.id });
      await notify(tx, otherId, "handoff_update", "Application withdrawn", "The rental application was withdrawn.");
    });
    return ok({ state: "withdrawn" }, rid);
  }

  return fail("VALIDATION", "Unknown action.", 422, rid);
});
