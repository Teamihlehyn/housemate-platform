import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { destroySession } from "@/lib/session";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";
import { OPEN_INTRO_STATES } from "@/lib/blocks";

// POST /api/v1/me/delete — account deletion request.
// Immediately hides the profile, stops interactions and revokes sessions; a purge
// job finalises removal under the retention policy.
export const POST = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireAccount();

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
    // Feedback is deleted with the account (privacy notice), and survey emails stop at once.
    await tx.testerFeedback.deleteMany({ where: { userId: user.id } });
    await tx.user.update({ where: { id: user.id }, data: { surveyOptIn: false } });
    // Access request and invite data go too (HM-30): the request is deleted, and invites keep
    // only the account link (usedByUserId), not the address.
    await tx.accessRequest.deleteMany({ where: { email: user.email } });
    // An open application is withdrawn ("Delete my application"), and its activation code
    // stops working before the address is removed from it.
    const app = await tx.application.findUnique({ where: { userId: user.id } });
    if (app && !["withdrawn", "declined"].includes(app.status) && user.accountStatus === "applicant") {
      await tx.application.update({ where: { id: app.id }, data: { status: "withdrawn", version: { increment: 1 } } });
      await writeAudit(tx, {
        eventType: "application.withdrawn",
        actorId: user.id,
        subjectId: user.id,
        resourceType: "application",
        resourceId: app.id,
        action: "withdraw",
        reasonCode: "account_deleted",
        safeBefore: { status: app.status },
        safeAfter: { status: "withdrawn" },
      }, rid);
    }
    await tx.invite.updateMany({ where: { email: user.email, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.invite.updateMany({ where: { email: user.email }, data: { email: null } });

    // Stop everything in flight with other people (HM-07): pending intros end, chats
    // close, and an open household closes as if they had left it.
    await tx.introduction.updateMany({
      where: { state: { in: OPEN_INTRO_STATES }, OR: [{ lowUserId: user.id }, { highUserId: user.id }] },
      data: { state: "expired", reasonCode: "account_deleted", version: { increment: 1 } },
    });
    await tx.conversation.updateMany({
      where: { status: "open", OR: [{ userAId: user.id }, { userBId: user.id }] },
      data: { status: "closed" },
    });
    const households = await tx.household.findMany({
      where: { state: { in: ["proposed", "active"] }, memberships: { some: { userId: user.id, state: "active" } } },
      include: { memberships: true },
    });
    for (const hh of households) {
      await tx.membership.updateMany({
        where: { householdId: hh.id, userId: user.id },
        data: { state: "left", leftAt: new Date() },
      });
      await tx.household.update({
        where: { id: hh.id },
        data: { state: "closed", closedAt: new Date(), version: hh.version + 1 },
      });
      await tx.viewing.updateMany({
        where: { householdId: hh.id, state: { in: ["proposed", "awaiting_partner", "confirmed"] } },
        data: { state: "cancelled" },
      });
      await tx.handoff.updateMany({
        where: { householdId: hh.id, state: { in: ["draft", "awaiting_member_consent", "submitted"] } },
        data: { state: "withdrawn" },
      });
      await writeAudit(tx, { eventType: "household.closed", actorId: user.id, resourceType: "household", resourceId: hh.id, action: "leave", reasonCode: "member_deleted", versionBefore: hh.version, versionAfter: hh.version + 1 }, rid);
      await writeOutbox(tx, "household_closed", { householdId: hh.id });
      for (const m of hh.memberships) {
        if (m.userId !== user.id && m.state === "active")
          await notify(tx, m.userId, "household_closed", "Household closed", "Your housemate left the household. You can return to search anytime.");
      }
    }
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
