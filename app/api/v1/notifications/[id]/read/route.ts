import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";

// POST /api/v1/notifications/{id}/read — mark one of your notifications read (ENG-50).
// Someone else's, or an unknown id, is 404.
export const POST = handler(async (_req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  const r = await prisma.notification.updateMany({
    where: { id: params.id, recipientId: user.id },
    data: { readAt: new Date() },
  });
  if (r.count === 0) return fail("NOT_FOUND", "Not found.", 404, rid);
  return ok({ status: "read" }, rid);
});
