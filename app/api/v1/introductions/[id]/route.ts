import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";

// POST /api/v1/introductions/[id] {action: accept|decline|withdraw, expected_version?, reason_code?}
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const intro = await prisma.introduction.findUnique({ where: { id: params.id } });
  if (!intro || (intro.lowUserId !== user.id && intro.highUserId !== user.id))
    return fail("NOT_FOUND", "Introduction not found.", 404, rid);

  if (body.expected_version != null && body.expected_version !== intro.version)
    return fail("VERSION_CONFLICT", "This introduction changed. Refresh and retry.", 409, rid, {
      field_errors: { current_version: String(intro.version) },
    });

  const otherId = intro.lowUserId === user.id ? intro.highUserId : intro.lowUserId;

  if (action === "accept") {
    if (intro.senderId === user.id)
      return fail("FORBIDDEN", "You can't accept your own introduction.", 403, rid);
    if (intro.state !== "pending")
      return fail("STATE_CONFLICT", "This introduction is no longer pending.", 409, rid);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.introduction.update({
        where: { id: intro.id },
        data: { state: "accepted", version: intro.version + 1 },
      });
      const [a, b] = intro.lowUserId < intro.highUserId ? [intro.lowUserId, intro.highUserId] : [intro.highUserId, intro.lowUserId];
      const convo = await tx.conversation.create({
        data: { introductionId: intro.id, userAId: a, userBId: b },
      });
      await writeAudit(tx, { eventType: "introduction.accepted", actorId: user.id, subjectId: otherId, resourceType: "introduction", resourceId: intro.id, action: "accept", versionBefore: intro.version, versionAfter: updated.version }, rid);
      await writeOutbox(tx, "introduction_accepted", { id: intro.id, conversationId: convo.id });
      await notify(tx, intro.senderId, "introduction_accepted", "Introduction accepted", `${user.displayName} accepted your introduction.`);
      return { conversationId: convo.id };
    });
    return ok({ state: "accepted", conversationId: result.conversationId }, rid);
  }

  if (action === "decline") {
    if (intro.senderId === user.id)
      return fail("FORBIDDEN", "You can't decline your own introduction.", 403, rid);
    if (intro.state !== "pending")
      return fail("STATE_CONFLICT", "This introduction is no longer pending.", 409, rid);
    await prisma.$transaction(async (tx) => {
      await tx.introduction.update({
        where: { id: intro.id },
        data: { state: "declined", reasonCode: body.reason_code ?? null, version: intro.version + 1 },
      });
      await writeAudit(tx, { eventType: "introduction.declined", actorId: user.id, subjectId: otherId, resourceType: "introduction", resourceId: intro.id, action: "decline", reasonCode: body.reason_code ?? null }, rid);
      await writeOutbox(tx, "introduction_declined", { id: intro.id });
    });
    return ok({ state: "declined" }, rid);
  }

  if (action === "withdraw") {
    if (intro.senderId !== user.id)
      return fail("FORBIDDEN", "Only the sender can withdraw.", 403, rid);
    if (intro.state !== "pending")
      return fail("STATE_CONFLICT", "This introduction is no longer pending.", 409, rid);
    await prisma.$transaction(async (tx) => {
      await tx.introduction.update({
        where: { id: intro.id },
        data: { state: "withdrawn", version: intro.version + 1 },
      });
      await writeAudit(tx, { eventType: "introduction.withdrawn", actorId: user.id, resourceType: "introduction", resourceId: intro.id, action: "withdraw" }, rid);
      await writeOutbox(tx, "introduction_withdrawn", { id: intro.id });
    });
    return ok({ state: "withdrawn" }, rid);
  }

  return fail("VALIDATION", "Unknown action.", 422, rid);
});
