import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox } from "@/lib/audit";

// POST /api/v1/shortlist/[id]/vote {decision}
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const decision = body.decision;
  if (!["interested", "not_interested", "undecided"].includes(decision))
    return fail("VALIDATION", "Invalid vote.", 422, rid);

  const item = await prisma.shortlistItem.findUnique({
    where: { id: params.id },
    include: { household: { include: { memberships: true } } },
  });
  if (!item || !item.household.memberships.some((m) => m.userId === user.id))
    return fail("NOT_FOUND", "Shortlist item not found.", 404, rid);

  await prisma.$transaction(async (tx) => {
    await tx.shortlistVote.upsert({
      where: { itemId_userId: { itemId: item.id, userId: user.id } },
      create: { itemId: item.id, userId: user.id, decision },
      update: { decision },
    });
    await writeAudit(tx, { eventType: "shortlist.voted", actorId: user.id, resourceType: "shortlist_item", resourceId: item.id, action: "vote", safeAfter: { decision } }, rid);
    await writeOutbox(tx, "shortlist_voted", { itemId: item.id, decision });
  });

  return ok({ decision }, rid);
});
