import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireStaff } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";
import { snapshotScore } from "@/lib/credibility";
import { RUBRIC } from "@/lib/constants";

// POST /api/v1/staff/verifications/[userId] {action: approve|reject, reason}
// Records the outcome of a human, out-of-band identity check. No ID documents are stored.
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const staff = await requireStaff();
  const { action, reason } = await req.json().catch(() => ({}));
  const userId = params.userId;

  const check = await prisma.verificationCheck.findUnique({
    where: { userId_category: { userId, category: "identity" } },
  });
  if (!check) return fail("NOT_FOUND", "No identity case for this user.", 404, rid);
  if (check.status !== "manual_review")
    return fail("STATE_CONFLICT", "This case is not awaiting review.", 409, rid);

  if (action === "approve") {
    const bd = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { adultEligible: true, phoneVerified: true } });
      await tx.verificationCheck.update({
        where: { userId_category: { userId, category: "identity" } },
        data: { status: "verified", points: RUBRIC.identity },
      });
      // Phone confirmed during the same live check.
      await tx.verificationCheck.upsert({
        where: { userId_category: { userId, category: "phone" } },
        create: { userId, category: "phone", status: "verified", points: RUBRIC.phone },
        update: { status: "verified", points: RUBRIC.phone },
      });
      const score = await snapshotScore(tx, userId);
      await writeAudit(tx, {
        eventType: "verification.identity_approved",
        actorType: "staff",
        actorId: staff.id,
        subjectId: userId,
        resourceType: "verification_check",
        resourceId: check.id,
        action: "approve",
        reasonCode: reason ?? "manual_identity_confirmed",
        safeAfter: { score: score.score },
      }, rid);
      await writeOutbox(tx, "identity_verified", { userId });
      await notify(tx, userId, "check_result", "Identity verified", "Your identity has been verified. You're now live in discovery.");
      return score;
    });
    return ok({ status: "verified", credibility: bd }, rid);
  }

  if (action === "reject") {
    await prisma.$transaction(async (tx) => {
      await tx.verificationCheck.update({
        where: { userId_category: { userId, category: "identity" } },
        data: { status: "failed", points: 0 },
      });
      await writeAudit(tx, {
        eventType: "verification.identity_rejected",
        actorType: "staff",
        actorId: staff.id,
        subjectId: userId,
        resourceType: "verification_check",
        resourceId: check.id,
        action: "reject",
        reasonCode: reason ?? "manual_identity_failed",
      }, rid);
      await writeOutbox(tx, "identity_rejected", { userId });
      await notify(tx, userId, "check_result", "Verification needs attention", "We couldn't verify your identity yet. Please reply to our email to sort it out.");
    });
    return ok({ status: "failed" }, rid);
  }

  return fail("VALIDATION", "Unknown action.", 422, rid);
});
