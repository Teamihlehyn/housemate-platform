import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox } from "@/lib/audit";
import { OPEN_INTRO_STATES } from "@/lib/blocks";

// POST /api/v1/blocks {target_user_id} — immediate, bilateral, no notification to the blocked.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const targetId = body.target_user_id;
  if (!targetId || targetId === user.id) return fail("VALIDATION", "Invalid target.", 422, rid);

  await prisma.$transaction(async (tx) => {
    await tx.block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetId } },
      create: { blockerId: user.id, blockedId: targetId },
      update: {},
    });
    // Close any conversation and end an active household with this person.
    const [a, b] = user.id < targetId ? [user.id, targetId] : [targetId, user.id];
    await tx.conversation.updateMany({
      where: { userAId: a, userBId: b },
      data: { status: "closed" },
    });
    // End every open intro for the pair (HM-02), so neither side can accept one later.
    // "expired" rather than "declined": a block is silent.
    await tx.introduction.updateMany({
      where: { lowUserId: a, highUserId: b, state: { in: OPEN_INTRO_STATES } },
      data: { state: "expired", reasonCode: "blocked", version: { increment: 1 } },
    });
    const hh = await tx.household.findFirst({
      where: {
        state: { in: ["proposed", "active"] },
        memberships: { some: { userId: user.id } },
        AND: { memberships: { some: { userId: targetId } } },
      },
    });
    if (hh) {
      await tx.household.update({
        where: { id: hh.id },
        data: { state: "closed", closedAt: new Date(), version: hh.version + 1 },
      });
    }
    await writeAudit(tx, { eventType: "block.created", actorId: user.id, subjectId: targetId, resourceType: "block", resourceId: targetId, action: "block", reasonCode: "user_block" }, rid);
    await writeOutbox(tx, "block_created", { blockerId: user.id });
  });

  return ok({ status: "blocked" }, rid);
});
