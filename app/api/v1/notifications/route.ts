import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";

// GET /api/v1/notifications — in-app inbox.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { recipientId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = notifications.filter((n) => !n.readAt).length;
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
