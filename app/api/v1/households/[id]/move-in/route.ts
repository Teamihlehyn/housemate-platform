import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { recordMoveIn } from "@/lib/household";
import { afterMoveIn } from "@/lib/demoBots";

// POST /api/v1/households/[id]/move-in {actual_date, response}
// The household completes only after every member confirms moved_in.
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

  await recordMoveIn({ householdId: hh.id, userId: user.id, actualDate: actualDate ?? "", response, rid });
  if (response === "moved_in") await afterMoveIn(hh.id, actualDate);
  const fresh = await prisma.household.findUnique({ where: { id: hh.id } });
  return ok({ householdState: fresh?.state }, rid);
});
