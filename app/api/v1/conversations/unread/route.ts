import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { threadStates } from "@/lib/reads";

// GET /api/v1/conversations/unread — the nav badge (ENG-51): your unread messages and threads,
// introductions waiting for your answer, unread notifications. Yours only.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  const convos = await prisma.conversation.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    select: { id: true, createdAt: true },
  });
  const states = await threadStates(user.id, convos);
  const unreadThreads = [...states.values()].filter((s) => s.unread > 0).length;
  const [pending, notes] = await Promise.all([
    prisma.introduction.count({
      where: { state: "pending", senderId: { not: user.id }, OR: [{ lowUserId: user.id }, { highUserId: user.id }] },
    }),
    prisma.notification.count({ where: { recipientId: user.id, readAt: null } }),
  ]);
  return ok(
    {
      unread_messages: [...states.values()].reduce((n, s) => n + s.unread, 0),
      unread_threads: unreadThreads,
      pending_introductions: pending,
      unread_notifications: notes,
    },
    rid
  );
});
