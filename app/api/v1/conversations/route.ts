import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { inboxOrder, threadStates } from "@/lib/reads";

// GET /api/v1/conversations — accepted-pair conversations for the current user, with your own
// unread count per thread and in total (ENG-51), waiting-for-your-reply first. Read state is
// private: nothing here says whether the other person has read anything.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  const convos = await prisma.conversation.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: { serverSequence: "desc" }, take: 1 } },
  });
  const otherIds = convos.map((c) => (c.userAId === user.id ? c.userBId : c.userAId));
  const others = await prisma.user.findMany({
    where: { id: { in: otherIds } },
    include: { profile: true },
  });
  const map = new Map(others.map((o) => [o.id, o]));
  const states = await threadStates(user.id, convos);

  const list = inboxOrder(
      convos.map((c) => {
        const otherId = c.userAId === user.id ? c.userBId : c.userAId;
        const o = map.get(otherId);
        return {
          id: c.id,
          status: c.status,
          otherUserId: otherId,
          otherName: o?.displayName ?? "User",
          otherInitials: o?.profile?.avatarInitials ?? "?",
          lastMessage: c.messages[0]?.body ?? null,
          lastAt: c.messages[0]?.sentAt ?? c.createdAt,
          unread: states.get(c.id)?.unread ?? 0,
          waiting_for_you: states.get(c.id)?.waitingForYou ?? false,
          last_at: states.get(c.id)?.lastAt ?? c.createdAt,
        };
      })
  );
  return ok({ conversations: list, unread_total: list.reduce((n, c) => n + c.unread, 0) }, rid);
});
