import { prisma } from "./db";

// Private read state (ENG-51, SEC-16). One place decides what's unread, so the inbox, the nav
// badge, the notifications and Discover always agree. Nothing here is ever shown to the other
// person: no read receipts.

// Mark a thread read for this user, and their notifications about it. Cheap when nothing changed.
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const now = new Date();
  const read = await prisma.conversationRead.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
  const since = read?.lastReadAt ?? new Date(0);
  const newer = await prisma.message.count({ where: { conversationId, senderId: { not: userId }, sentAt: { gt: since } } });
  if (read && newer === 0) return;
  await prisma.conversationRead.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    create: { conversationId, userId, lastReadAt: now },
    update: { lastReadAt: now },
  });
  await prisma.notification.updateMany({
    where: { recipientId: userId, targetType: "conversation", targetId: conversationId, readAt: null },
    data: { readAt: now },
  });
}

export type ThreadState = { unread: number; waitingForYou: boolean; lastAt: Date };

// Unread counts for a user's conversations: messages from the other person since they last read.
export async function threadStates(
  userId: string,
  convos: { id: string; createdAt: Date }[]
): Promise<Map<string, ThreadState>> {
  const ids = convos.map((c) => c.id);
  const [latest] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: { in: ids } },
      orderBy: { serverSequence: "desc" },
      distinct: ["conversationId"],
      select: { conversationId: true, senderId: true, sentAt: true },
    }),
  ]);
  const last = new Map(latest.map((m) => [m.conversationId, m]));
  // One grouped query for every thread's unread count (the inbox polls).
  const counts = ids.length
    ? await prisma.$queryRaw<{ conversation_id: string; n: number }[]>`
        SELECT m."conversationId" AS conversation_id, count(*)::int AS n
        FROM "Message" m
        LEFT JOIN "ConversationRead" r ON r."conversationId" = m."conversationId" AND r."userId" = ${userId}
        WHERE m."conversationId" = ANY(${ids}) AND m."senderId" <> ${userId}
          AND m."sentAt" > COALESCE(r."lastReadAt", to_timestamp(0))
        GROUP BY m."conversationId"`
    : [];
  const unreadBy = new Map(counts.map((c) => [c.conversation_id, c.n]));
  const out = new Map<string, ThreadState>();
  for (const c of convos) {
    const unread = unreadBy.get(c.id) ?? 0;
    const m = last.get(c.id);
    out.set(c.id, { unread, waitingForYou: !!m && m.senderId !== userId, lastAt: m?.sentAt ?? c.createdAt });
  }
  return out;
}

// Inbox order (Hinge "Your Turn"): threads waiting on you first, then the newest activity.
export function inboxOrder<T extends { waiting_for_you: boolean; last_at: Date | string; status?: string }>(list: T[]): T[] {
  const t = (x: T) => new Date(x.last_at).getTime();
  return [...list].sort((a, b) => {
    const wa = a.waiting_for_you && a.status !== "closed" ? 1 : 0;
    const wb = b.waiting_for_you && b.status !== "closed" ? 1 : 0;
    return wb - wa || t(b) - t(a);
  });
}
