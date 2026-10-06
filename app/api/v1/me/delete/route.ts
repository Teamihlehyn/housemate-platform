import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { destroySession } from "@/lib/session";
import { writeAudit, writeOutbox } from "@/lib/audit";

// POST /api/v1/me/delete — account deletion request.
// Immediately hides the profile, stops interactions and revokes sessions; a purge
// job finalises removal under the retention policy.
export const POST = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { accountStatus: "deletion_pending" },
    });
    await tx.profile.updateMany({
      where: { userId: user.id },
      data: { publicationStatus: "draft" },
    });
    await tx.search.updateMany({
      where: { userId: user.id },
      data: { status: "archived" },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await writeAudit(tx, {
      eventType: "privacy.deletion_requested",
      actorId: user.id,
      subjectId: user.id,
      resourceType: "user",
      resourceId: user.id,
      action: "request_deletion",
    }, rid);
    await writeOutbox(tx, "deletion_requested", { userId: user.id });
  });

  await destroySession();
  return ok({ status: "deletion_pending" }, rid);
});
