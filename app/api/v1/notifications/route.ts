import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { notificationHref } from "@/lib/notificationTargets";

// GET /api/v1/notifications — in-app inbox. Each item carries `href` (ENG-50): the exact thread,
// introduction, household or application it's about, or null. The page it opens re-checks access.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  const rows = await prisma.notification.findMany({
    where: { recipientId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const notifications = rows.map((n) => ({
    id: n.id,
    eventName: n.eventName,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt,
    readAt: n.readAt,
    target_type: n.targetType,
    href: notificationHref(n.targetType, n.targetId),
  }));
  const unread = rows.filter((n) => !n.readAt).length;
  return ok({ notifications, unread }, rid);
});

// POST /api/v1/notifications — mark all read.
export const POST = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return ok({ status: "read" }, rid);
});
