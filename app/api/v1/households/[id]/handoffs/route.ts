import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";

// POST /api/v1/households/[id]/handoffs {property_id?, plan_version?}
// Starts a rental application handoff to the mock partner, awaiting both consents.
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const hh = await prisma.household.findUnique({
    where: { id: params.id },
    include: { memberships: true, plans: { orderBy: { versionNo: "desc" } }, viewings: true },
  });
  if (!hh || !hh.memberships.some((m) => m.userId === user.id))
    return fail("NOT_FOUND", "Household not found.", 404, rid);
  if (hh.state !== "active")
    return fail("STATE_CONFLICT", "Household must be active.", 409, rid);

  // Require a completed viewing OR explicit remote-review acknowledgement.
  const hasCompletedViewing = hh.viewings.some((v) => v.state === "completed");
  if (!hasCompletedViewing && !body.remote_review_ack)
    return fail("STATE_CONFLICT", "Complete a viewing or acknowledge remote review first.", 409, rid);

  const existing = await prisma.handoff.findFirst({
    where: { householdId: hh.id, state: { in: ["draft", "awaiting_member_consent", "submitted"] } },
  });
  if (existing) return ok({ id: existing.id, state: existing.state }, rid);

  const plan = hh.plans[0];
  const otherId = hh.memberships.find((m) => m.userId !== user.id)!.userId;
  const currency = plan?.currency ?? "GBP";
  const partnerId = currency === "NGN" ? "mock_partner_ng" : "mock_partner_gb";

  const handoff = await prisma.$transaction(async (tx) => {
    const h = await tx.handoff.create({
      data: {
        householdId: hh.id,
        propertyId: body.property_id ?? plan?.propertyId ?? null,
        planVersion: plan?.versionNo ?? 1,
        partnerId,
        state: "awaiting_member_consent",
      },
    });
    await tx.household.update({ where: { id: hh.id }, data: { derivedStage: "application" } });
    await writeAudit(tx, { eventType: "handoff.started", actorId: user.id, subjectId: otherId, resourceType: "handoff", resourceId: h.id, action: "start" }, rid);
    await writeOutbox(tx, "handoff_started", { handoffId: h.id });
    await notify(tx, otherId, "handoff_update", "Application started", `${user.displayName} started a rental application. Review and consent to share your details.`);
    return h;
  });

  return ok({ id: handoff.id, state: handoff.state }, rid);
});
