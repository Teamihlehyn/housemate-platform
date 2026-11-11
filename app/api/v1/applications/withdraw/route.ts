import { NextRequest } from "next/server";
import { handler, ok, fail, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/guard";
import { writeAudit, writeOutbox } from "@/lib/audit";
import { canWithdraw } from "@/lib/applications";
import { applicationStatusFor, clearApprovalClaims } from "@/lib/applicationService";
import { lockKey } from "@/lib/rateLimit";

// POST /api/v1/applications/withdraw {}   (ENG-40)
// Any open application → withdrawn. An unused activation code stops working. The person can
// apply again at /join straight away (the same application reopens as a draft).
export const POST = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireAccount();
  const app = await prisma.application.findUnique({ where: { userId: user.id } });
  if (!app) return fail("NOT_FOUND", "Not found.", 404, rid);
  await prisma.$transaction(async (tx) => {
    await lockKey(tx, `application:${app.id}`);
    const cur = await tx.application.findUniqueOrThrow({ where: { id: app.id } });
    if (!canWithdraw(cur.status)) throw new ApiError("STATE_CONFLICT", "This application is already closed.", 409);
    // Only an applicant withdraws; a member's approved application is history.
    if (user.accountStatus !== "applicant") throw new ApiError("STATE_CONFLICT", "This application is already closed.", 409);
    await tx.application.update({ where: { id: app.id }, data: { status: "withdrawn", version: { increment: 1 } } });
    await tx.invite.updateMany({ where: { applicationId: app.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    if (cur.status === "approved") await clearApprovalClaims(tx, user.id);
    await writeAudit(tx, {
      eventType: "application.withdrawn",
      actorId: user.id,
      subjectId: user.id,
      resourceType: "application",
      resourceId: app.id,
      action: "withdraw",
      safeBefore: { status: cur.status },
      safeAfter: { status: "withdrawn" },
      versionBefore: cur.version,
      versionAfter: cur.version + 1,
    }, rid);
    await writeOutbox(tx, "application_withdrawn", { applicationId: app.id });
  });
  return ok({ application: await applicationStatusFor(user.id) }, rid);
});
