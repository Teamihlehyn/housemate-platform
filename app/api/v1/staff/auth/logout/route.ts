import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { destroyStaffSession } from "@/lib/staffAuth";

// POST /api/v1/staff/auth/logout — ends this back-office session (the user session, if any,
// is a different cookie and is left alone). Always 200.
export const POST = handler(async (_req: NextRequest, { rid }) => {
  const userId = await destroyStaffSession();
  if (userId) {
    await prisma.$transaction((tx) =>
      writeAudit(tx, { eventType: "staff.session_ended", actorType: "staff", actorId: userId, subjectId: userId, resourceType: "session", resourceId: userId, action: "logout" }, rid)
    );
  }
  return ok({ status: "signed_out", redirect: "/staff/signin" }, rid);
});
