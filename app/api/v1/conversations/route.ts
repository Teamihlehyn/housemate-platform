import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";

// GET /api/v1/conversations — accepted-pair conversations for the current user.
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

  return ok(
    {
      conversations: convos.map((c) => {
        const otherId = c.userAId === user.id ? c.userBId : c.userAId;
        const o = map.get(otherId);
        return {
          id: c.id,
          status: c.status,
          otherUserId: otherId,
          otherName: o?.displayName ?? "Member",
          otherInitials: o?.profile?.avatarInitials ?? "?",
          lastMessage: c.messages[0]?.body ?? null,
          lastAt: c.messages[0]?.sentAt ?? c.createdAt,
        };
      }),
    },
    rid
  );
});
