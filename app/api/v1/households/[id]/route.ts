import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";

// POST /api/v1/households/[id] {action: accept|leave, expected_version?, plan_version_id?}
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  const hh = await prisma.household.findUnique({
    where: { id: params.id },
    include: { memberships: true, plans: { orderBy: { versionNo: "desc" }, include: { acceptances: true } } },
  });
  if (!hh || !hh.memberships.some((m) => m.userId === user.id))
    return fail("NOT_FOUND", "Household not found.", 404, rid);

  const otherId = hh.memberships.find((m) => m.userId !== user.id)!.userId;

  if (body.expected_version != null && body.expected_version !== hh.version)
    return fail("VERSION_CONFLICT", "This household changed. Refresh and retry.", 409, rid);

  if (action === "accept") {
    if (hh.state !== "proposed")
      return fail("STATE_CONFLICT", "This household is no longer a proposal.", 409, rid);
    const plan = hh.plans[0];
    if (body.plan_version_id != null && body.plan_version_id !== plan.versionNo)
      return fail("VERSION_CONFLICT", "The plan changed. Review and accept again.", 409, rid);
    if (plan.acceptances.some((a) => a.userId === user.id && !a.revokedAt))
      return ok({ state: hh.state }, rid); // idempotent

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Concurrency: neither member may already be in another active household.
        const busy = await tx.membership.findFirst({
          where: {
            userId: { in: [user.id, otherId] },
            householdId: { not: hh.id },
            state: "active",
            household: { state: "active" },
          },
        });
        if (busy) throw Object.assign(new Error("busy"), { _busy: true });

        await tx.planAcceptance.create({ data: { planId: plan.id, userId: user.id } });
        const accs = await tx.planAcceptance.count({
          where: { planId: plan.id, revokedAt: null },
        });
        let committed = false;
        if (accs >= 2) {
          await tx.household.update({
            where: { id: hh.id },
            data: { state: "active", formedAt: new Date(), version: hh.version + 1, derivedStage: "planning" },
          });
          // Pause both searches; expire pending intros with reason household_formed.
          await tx.search.updateMany({
            where: { userId: { in: [user.id, otherId] } },
            data: { status: "paused" },
          });
          await tx.introduction.updateMany({
            where: {
              state: "pending",
              OR: [
                { lowUserId: { in: [user.id, otherId] } },
                { highUserId: { in: [user.id, otherId] } },
              ],
            },
            data: { state: "expired", reasonCode: "household_formed" },
          });
          committed = true;
        }
        await writeAudit(tx, { eventType: "household.accepted", actorId: user.id, subjectId: otherId, resourceType: "household", resourceId: hh.id, action: "accept", versionBefore: hh.version }, rid);
        await writeOutbox(tx, committed ? "household_formed" : "household_acceptance", { householdId: hh.id });
        if (committed)
          await notify(tx, otherId, "household_formed", "Household formed", "Your household is active. Start planning together.");
        return { committed };
      });
      return ok({ state: result.committed ? "active" : "proposed" }, rid);
    } catch (e) {
      if ((e as { _busy?: boolean })._busy)
        return fail("STATE_CONFLICT", "One of you is already in an active household.", 409, rid);
      throw e;
    }
  }

  if (action === "leave") {
    if (!["proposed", "active"].includes(hh.state))
      return fail("STATE_CONFLICT", "This household is already closed.", 409, rid);
    await prisma.$transaction(async (tx) => {
      await tx.membership.updateMany({
        where: { householdId: hh.id, userId: user.id },
        data: { state: "left", leftAt: new Date() },
      });
      await tx.household.update({
        where: { id: hh.id },
        data: { state: "closed", closedAt: new Date(), version: hh.version + 1 },
      });
      // Cancel outstanding viewings/handoffs.
      await tx.viewing.updateMany({
        where: { householdId: hh.id, state: { in: ["proposed", "awaiting_partner", "confirmed"] } },
        data: { state: "cancelled" },
      });
      await tx.handoff.updateMany({
        where: { householdId: hh.id, state: { in: ["draft", "awaiting_member_consent", "submitted"] } },
        data: { state: "withdrawn" },
      });
      await writeAudit(tx, { eventType: "household.closed", actorId: user.id, subjectId: otherId, resourceType: "household", resourceId: hh.id, action: "leave", reasonCode: "member_left" }, rid);
      await writeOutbox(tx, "household_closed", { householdId: hh.id });
      await notify(tx, otherId, "household_closed", "Household closed", `${user.displayName} left the household. You can return to search anytime.`);
    });
    return ok({ state: "closed" }, rid);
  }

  return fail("VALIDATION", "Unknown action.", 422, rid);
});
