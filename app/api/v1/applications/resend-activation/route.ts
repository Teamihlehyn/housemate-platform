import { NextRequest } from "next/server";
import { handler, ok, fail, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";
import { createInvite, inviteUrl } from "@/lib/invites";
import { lockKey } from "@/lib/rateLimit";
import { firstName } from "@/lib/emails/render";
import { approvedEmail } from "@/lib/emails";
import { dateLabel, hashStatusToken, plausibleStatusToken } from "@/lib/applications";
import { SELF_RESENDS_PER_DAY, applicationStatusFor, sendApplicationEmail } from "@/lib/applicationService";

// POST /api/v1/applications/resend-activation {t?}   (ENG-54, SEC-18)
// An approved applicant who missed the invitation gets a new one, without staff. Needs the
// application session, or the magic-link token from the confirmation email (so nobody can
// trigger it for an address they don't control). Revokes the old code; emails E2 to the
// address on the application only; at most 3 in 24 hours; never creates an application.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const body = await req.json().catch(() => ({}));
  let userId: string | null = null;
  let viaLink = false;
  if (body?.t != null) {
    if (!plausibleStatusToken(body.t)) return fail("NOT_FOUND", "This link isn't valid any more.", 404, rid);
    const a = await prisma.application.findUnique({ where: { statusTokenHash: hashStatusToken(body.t) }, select: { userId: true } });
    if (!a) return fail("NOT_FOUND", "This link isn't valid any more.", 404, rid);
    userId = a.userId;
    viaLink = true;
  } else {
    const u = await getCurrentUser();
    if (!u) return fail("UNAUTHENTICATED", "Open the link in your confirmation email, or start again at /join.", 401, rid);
    userId = u.id;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const app = await prisma.application.findUnique({ where: { userId } });
  if (!user || !app) return fail("NOT_FOUND", "Not found.", 404, rid);

  const invite = await prisma.$transaction(async (tx) => {
    await lockKey(tx, `application:${app.id}`);
    const cur = await tx.application.findUniqueOrThrow({ where: { id: app.id } });
    const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { accountStatus: true } });
    if (cur.status !== "approved" || fresh.accountStatus !== "applicant") {
      throw new ApiError("STATE_CONFLICT", "There's no invitation to resend for this application.", 409);
    }
    const used = await tx.auditEvent.count({
      where: { eventType: "application.activation_resent_self", resourceId: app.id, occurredAt: { gt: new Date(Date.now() - 86_400_000) } },
    });
    if (used >= SELF_RESENDS_PER_DAY) {
      throw new ApiError("RATE_LIMITED", "You've asked for 3 invitations today. Try again tomorrow, or email hello@peabudy.com.", 429, undefined, 86400);
    }
    const now = new Date();
    await tx.invite.updateMany({ where: { applicationId: app.id, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
    const inv = await createInvite(tx, { email: user.email, applicationId: app.id, createdBy: user.id });
    await tx.application.update({ where: { id: app.id }, data: { activationInviteId: inv.id, version: { increment: 1 } } });
    await writeAudit(tx, {
      eventType: "application.activation_resent_self",
      actorId: user.id,
      subjectId: user.id,
      resourceType: "application",
      resourceId: app.id,
      action: "resend_activation",
      reasonCode: viaLink ? "magic_link" : "session",
      versionBefore: cur.version,
      versionAfter: cur.version + 1,
    }, rid);
    await writeOutbox(tx, "application_activation_resent", { applicationId: app.id });
    return inv;
  });

  const email_status = await sendApplicationEmail(
    {
      to: user.email,
      userId: user.id,
      emailId: "E2",
      built: approvedEmail({
        first_name: firstName(user.displayName),
        activation_url: inviteUrl(invite.code),
        code: invite.code,
        expires_on: dateLabel(invite.expiresAt),
      }),
    },
    rid
  );
  return ok({ application: await applicationStatusFor(user.id, viaLink), email_status }, rid);
});
