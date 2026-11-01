import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";
import { acceptPlan } from "@/lib/household";

// POST /api/v1/households/[id] {action: accept|accept_plan|leave, expected_version?, plan_version_id?}
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

  // Accept the proposal (forms the household) or the latest changed agreement.
  if (action === "accept" || action === "accept_plan") {
    const result = await acceptPlan({
      householdId: hh.id,
      userId: user.id,
      planVersion: body.plan_version_id ?? null,
      rid,
    });
    const fresh = await prisma.household.findUnique({ where: { id: hh.id } });
    return ok({ state: fresh?.state, result }, rid);
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
