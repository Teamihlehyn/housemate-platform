import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { handler, ok, fail, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { writeAudit, writeOutbox } from "@/lib/audit";
import { effectiveRole, listedRole } from "@/lib/staff";
import { syncRoleAtSignIn } from "@/lib/staffSync";
import { SIGNUPS_PAUSED } from "@/lib/env";
import { PRIVACY_VERSION, RUBRIC } from "@/lib/constants";
import { claimCode } from "@/lib/codes";
import { verifyOutcome } from "@/lib/applications";
import { applicationStatusFor } from "@/lib/applicationService";
import { tombstoneReapplyAfter } from "@/lib/applicationPurge";
import { hashEmailKey } from "@/lib/auth";

// POST /api/v1/applications/verify {email, code}   — /join step 2 (ENG-40)
// The code proves the person owns the inbox. Then, by who the address belongs to:
//   new → applicant + draft application + application session
//   applicant → their application (resume, or reopen after withdrawal / the reapply date)
//   declined before the reapply date → application session, status page only
//   active member → a normal member session (not a bypass: they proved ownership)
//   suspended, being deleted, staff → no session, a neutral answer
export const POST = handler(async (req: NextRequest, { rid }) => {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !body?.code) return fail("VALIDATION", "Email and code are required.", 422, rid);

  const record = await claimCode(email, body.code);

  const user = await prisma.user.findUnique({ where: { email } });
  const app = user ? await prisma.application.findUnique({ where: { userId: user.id } }) : null;
  // Roles from the allowlist, never the stored role alone (HM-10).
  // A purged declined application leaves only a hashed email and its reapply date (R7).
  const heldUntil = user ? null : await tombstoneReapplyAfter(email);
  const outcome = verifyOutcome(user ? { ...user, role: effectiveRole(user) } : null, app, { bootstrapAdmin: listedRole(email) !== null });

  if (outcome === "unavailable") {
    // The code stays usable for /signin where that's allowed (staff); nothing is created.
    return ok(
      { outcome: "unavailable", message: "We can't take an application from this address. Contact hello@peabudy.com." },
      rid
    );
  }

  if (outcome === "member") {
    await prisma.$transaction(async (tx) => {
      await tx.authCode.deleteMany({ where: { email } });
      await writeAudit(tx, {
        eventType: "auth.session_created",
        actorId: user!.id,
        subjectId: user!.id,
        resourceType: "session",
        resourceId: user!.id,
        action: "login_via_join",
      }, rid);
    });
    const role = await syncRoleAtSignIn(user!, rid);
    await createSession(user!.id, "member");
    return ok({ outcome: "member", user: { id: user!.id, displayName: user!.displayName, role }, redirect: ["verifier", "moderator", "admin"].includes(role) ? "/staff" : "/discover" }, rid);
  }

  if (outcome === "create" && SIGNUPS_PAUSED) {
    return fail("FORBIDDEN", "We're not taking new applications for a few days. Please try again later.", 403, rid);
  }
  // A new applicant must have agreed to the privacy notice at step 1 (recorded on the code).
  const consentVersion = record.consentVersion ?? (body.accept_privacy === true ? PRIVACY_VERSION : null);
  if (outcome === "create" && !consentVersion) {
    return fail("CONSENT_REQUIRED", "Please accept the privacy notice to continue.", 422, rid, {
      field_errors: { accept_privacy: "Required." },
    });
  }

  const userId = await prisma.$transaction(async (tx) => {
    await tx.authCode.deleteMany({ where: { email } });
    if (outcome === "create") {
      const created = await tx.user.create({
        data: {
          email,
          emailVerified: true,
          displayName: "",
          accountStatus: "applicant",
          privacyConsentAt: new Date(),
          privacyConsentVersion: consentVersion,
          profile: { create: { publicationStatus: "draft" } },
          search: { create: { status: "draft" } },
        },
      });
      // The code proved control of the inbox.
      await tx.verificationCheck.create({
        data: { userId: created.id, category: "email", status: "verified", points: RUBRIC.email },
      });
      // Before the reapply date a purged, declined person comes back to the declined status page
      // (no new application); the tombstone has served its purpose.
      const a = await tx.application.create({
        data: heldUntil
          ? { userId: created.id, status: "declined", reapplyAfter: heldUntil, reviewedAt: new Date() }
          : { userId: created.id },
      });
      if (heldUntil) await tx.applicantTombstone.deleteMany({ where: { emailHash: hashEmailKey(email) } });
      await writeAudit(tx, {
        eventType: "application.started",
        actorId: created.id,
        subjectId: created.id,
        resourceType: "application",
        resourceId: a.id,
        action: "start",
        safeAfter: { status: heldUntil ? "declined" : "draft", consentVersion, held: !!heldUntil },
      }, rid);
      await writeAudit(tx, {
        eventType: "auth.consent_recorded",
        actorId: created.id,
        subjectId: created.id,
        resourceType: "user",
        resourceId: created.id,
        action: "accept_privacy",
        safeAfter: { version: consentVersion },
      }, rid);
      await writeOutbox(tx, "application_started", { applicationId: a.id });
      await writeAudit(tx, {
        eventType: "auth.session_created",
        actorId: created.id,
        subjectId: created.id,
        resourceType: "session",
        resourceId: created.id,
        action: "application",
      }, rid);
      return created.id;
    }
    if (outcome === "reopen") {
      const before = app?.status ?? null;
      const a = app
        ? await tx.application.update({
            where: { id: app.id },
            data: {
              status: "draft",
              submittedAt: null,
              callAt: null,
              reviewedBy: null,
              reviewedAt: null,
              declineReason: null,
              reapplyAfter: null,
              statusTokenHash: null,
              activationInviteId: null,
              version: { increment: 1 },
            },
          })
        : await tx.application.create({ data: { userId: user!.id } });
      await writeAudit(tx, {
        eventType: "application.reopened",
        actorId: user!.id,
        subjectId: user!.id,
        resourceType: "application",
        resourceId: a.id,
        action: "reopen",
        safeBefore: before ? { status: before } : undefined,
        safeAfter: { status: "draft" },
      }, rid);
      await writeOutbox(tx, "application_reopened", { applicationId: a.id });
    }
    if (consentVersion && user && user.privacyConsentVersion !== PRIVACY_VERSION && consentVersion === PRIVACY_VERSION) {
      await tx.user.update({ where: { id: user.id }, data: { privacyConsentAt: new Date(), privacyConsentVersion: PRIVACY_VERSION } });
    }
    await writeAudit(tx, {
      eventType: "auth.session_created",
      actorId: user!.id,
      subjectId: user!.id,
      resourceType: "session",
      resourceId: user!.id,
      action: "application",
    }, rid);
    return user!.id;
  }).catch((e) => {
    // Two first verifications racing for one new address: the unique email wins once.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError("CODE_EXPIRED", "That code has expired. Request a new one.", 422);
    }
    throw e;
  });

  await createSession(userId, "application");
  return ok({ outcome: "application", application: await applicationStatusFor(userId) }, rid);
});
