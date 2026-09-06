import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";

// POST /api/v1/households/[id]/move-in {actual_date, response}
// Household completes only after BOTH confirm moved_in. Disagreement never marks success.
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const hh = await prisma.household.findUnique({
    where: { id: params.id },
    include: { memberships: true, handoffs: { orderBy: { createdAt: "desc" } } },
  });
  if (!hh || !hh.memberships.some((m) => m.userId === user.id))
    return fail("NOT_FOUND", "Household not found.", 404, rid);
  if (hh.state !== "active")
    return fail("STATE_CONFLICT", "Household must be active.", 409, rid);
  if (hh.handoffs[0]?.state !== "accepted")
    return fail("STATE_CONFLICT", "Confirm an accepted application before recording move-in.", 409, rid);

  const response = body.response;
  if (!["moved_in", "not_moved", "disputed"].includes(response))
    return fail("VALIDATION", "Invalid response.", 422, rid);
  const actualDate = body.actual_date;
  if (response === "moved_in" && !actualDate)
    return fail("VALIDATION", "Provide your move-in date.", 422, rid);

  const otherId = hh.memberships.find((m) => m.userId !== user.id)!.userId;

  const result = await prisma.$transaction(async (tx) => {
    await tx.moveInConfirmation.upsert({
      where: { householdId_userId: { householdId: hh.id, userId: user.id } },
      create: { householdId: hh.id, userId: user.id, actualDate: actualDate ?? "", response, source: "self_report_demo" },
      update: { response, actualDate: actualDate ?? "" },
    });
    const confs = await tx.moveInConfirmation.findMany({ where: { householdId: hh.id } });
    let state = hh.state;
    if (confs.length >= 2 && confs.every((c) => c.response === "moved_in")) {
      state = "completed";
      await tx.household.update({
        where: { id: hh.id },
        data: { state: "completed", closedAt: new Date(), version: hh.version + 1 },
      });
      await notify(tx, otherId, "move_in", "Move-in confirmed", "You've both confirmed your move-in. 🎉");
      await notify(tx, user.id, "move_in", "Move-in confirmed", "You've both confirmed your move-in. 🎉");
    } else {
      await notify(tx, otherId, "move_in", "Move-in update", `${user.displayName} recorded their move-in status.`);
    }
    await writeAudit(tx, { eventType: "move_in.confirmed", actorId: user.id, subjectId: otherId, resourceType: "household", resourceId: hh.id, action: "move_in_confirm", safeAfter: { response } }, rid);
    await writeOutbox(tx, "move_in_confirmed", { householdId: hh.id, response });
    return state;
  });

  return ok({ householdState: result }, rid);
});
