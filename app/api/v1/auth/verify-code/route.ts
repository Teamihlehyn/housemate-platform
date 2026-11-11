import { NextRequest } from "next/server";
import { handler, ok, fail, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createSession, getCurrentUser, replaceSessions } from "@/lib/session";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";
import { APPROVAL_FIRST, CONSENT_REQUIRED, SANDBOX_ON_SIGNUP, SIGNUPS_PAUSED } from "@/lib/env";
import { listedRole } from "@/lib/staff";
import { isStaffRole } from "@/lib/guard";
import { syncRoleAtSignIn } from "@/lib/staffSync";
import { PRIVACY_VERSION } from "@/lib/constants";
import { contactHint, isReconsent, needsConsent } from "@/lib/auth";
import { claimCode, invalidCode } from "@/lib/codes";
import { snapshotScore } from "@/lib/credibility";
import { ensureSandboxWorld } from "@/lib/sandbox";
import { activationTarget, missingFor } from "@/lib/applicationService";

const ACTIVATION_INVALID =
  "This activation link isn't valid any more. Sign in if you've already activated, or contact hello@peabudy.com.";

function activationInvalid(): ApiError {
  return new ApiError("INVITE_INVALID", ACTIVATION_INVALID, 422);
}

type ConsentUser = { id: string; privacyConsentAt: Date | null; privacyConsentVersion: string | null } | null;

function consentError(prior: ConsentUser) {
  const message = isReconsent(prior, PRIVACY_VERSION)
    ? "We've updated our privacy notice. Please read it and accept it to continue."
    : "Please accept the privacy notice to continue.";
  return new ApiError("CONSENT_REQUIRED", message, 422, { accept_privacy: "Required." });
}

async function recordConsent(userId: string, before: string | null, rid: string) {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { privacyConsentAt: new Date(), privacyConsentVersion: PRIVACY_VERSION } });
    await writeAudit(tx, {
      eventType: "auth.consent_recorded",
      actorType: "user",
      actorId: userId,
      subjectId: userId,
      resourceType: "user",
      resourceId: userId,
      action: "accept_privacy",
      safeBefore: before ? { version: before } : undefined,
      safeAfter: { version: PRIVACY_VERSION },
    }, rid);
  });
}

// POST /api/v1/auth/verify-code
//   {email, code, accept_privacy?}            sign in (members)
//   {activation_code, code, accept_privacy?}  activate an approved application (ENG-43)
//
// Sign-in: an applicant, unknown, declined or suspended address gets the same INVALID_CODE as
// a wrong code (R2.3). In demo modes an unknown address still creates an account.
// Activation, in one transaction: consume the invite, the account goes active, the profile is
// published and the search goes active; every earlier session is replaced by one member session.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const body = await req.json().catch(() => ({}));
  const { code, accept_privacy } = body ?? {};
  if (body?.activation_code != null) return activate(String(body.activation_code), code, accept_privacy === true, rid);

  const clean = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!clean || !code) return fail("VALIDATION", "Email and code are required.", 422, rid);

  await claimCode(clean, code);

  const prior = await prisma.user.findUnique({
    where: { email: clean },
    select: { id: true, accountStatus: true, privacyConsentAt: true, privacyConsentVersion: true },
  });
  // Listed staff (ADMIN_EMAILS / STAFF_EMAILS) may sign in before their account exists.
  const bootstrapAdmin = listedRole(clean) !== null;

  // Accounts being deleted (or deleted) can't quietly sign back in. The code is kept,
  // so nothing about the request changes until a person on the team acts.
  if (prior?.accountStatus === "deleted") {
    return fail("ACCOUNT_DELETED", "This account no longer exists.", 403, rid);
  }
  if (prior?.accountStatus === "deletion_pending") {
    await prisma.$transaction(async (tx) => {
      await writeAudit(tx, {
        eventType: "auth.session_denied",
        actorType: "user",
        actorId: prior.id,
        subjectId: prior.id,
        resourceType: "session",
        resourceId: prior.id,
        action: "login",
        outcome: "denied",
        reasonCode: "deletion_pending",
      }, rid);
    });
    return fail("FORBIDDEN", `Your account is being deleted. If you want to keep it, ${contactHint()}.`, 403, rid);
  }
  // Only members sign in here. Applicants use /join; everyone else looks like a wrong code.
  if (prior?.accountStatus === "applicant") throw invalidCode();
  if (APPROVAL_FIRST && !bootstrapAdmin && (!prior || prior.accountStatus === "suspended")) throw invalidCode();

  // Privacy consent (current version) is required before anything is created; the
  // code stays valid until then.
  if (accept_privacy !== true && needsConsent(prior, PRIVACY_VERSION, CONSENT_REQUIRED)) throw consentError(prior);

  let isNew = false;
  const user = await prisma.$transaction(async (tx) => {
    await tx.authCode.deleteMany({ where: { email: clean } });
    const found = await tx.user.findUnique({ where: { email: clean } });
    if (found) {
      if (!found.emailVerified) return tx.user.update({ where: { id: found.id }, data: { emailVerified: true } });
      return found;
    }
    if (SIGNUPS_PAUSED && !bootstrapAdmin) {
      throw new ApiError("FORBIDDEN", "We're not taking new sign-ups for a few days. Please try again later.", 403);
    }
    isNew = true;
    const created = await tx.user.create({
      data: {
        email: clean,
        emailVerified: true,
        displayName: clean.split("@")[0].slice(0, 40),
        accountStatus: "active",
        profile: { create: { publicationStatus: "draft" } },
        search: { create: { status: "draft" } },
      },
    });
    // Email control check → 10 points baseline once contact verified.
    await tx.verificationCheck.create({
      data: { userId: created.id, category: "email", status: "verified", points: 10 },
    });
    return created;
  });
  // The stored role follows the staff allowlist: listed addresses get their role, a staff
  // role that is no longer listed is removed (HM-10). Audited either way.
  user.role = await syncRoleAtSignIn(user, rid);
  if (accept_privacy === true && user.privacyConsentVersion !== PRIVACY_VERSION) {
    await recordConsent(user.id, user.privacyConsentVersion, rid);
  }

  await createSession(user.id, "member");
  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, {
      eventType: "auth.session_created",
      actorType: "user",
      actorId: user.id,
      subjectId: user.id,
      resourceType: "session",
      resourceId: user.id,
      action: isNew ? "register" : "login",
    }, rid);
  });

  return ok(
    {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      is_new: isNew,
      // Staff are back-office only: they land on /staff, members on /discover.
      redirect: isStaffRole(user.role) ? "/staff" : "/discover",
    },
    rid
  );
});

// Activation with the code from E2 (/invite/[code]) and the emailed sign-in code.
async function activate(activationCode: string, code: unknown, acceptPrivacy: boolean, rid: string) {
  if (!code) return fail("VALIDATION", "Enter the 6-digit code from your email.", 422, rid, { field_errors: { code: "Required." } });
  const target = await activationTarget(activationCode);
  if (!target) throw activationInvalid();
  const { invite, app, person } = target;
  // Signed in as someone else? The link isn't theirs (R4, case 10).
  const current = await getCurrentUser();
  if (current && current.id !== person.id) throw activationInvalid();

  await claimCode(person.email, code);
  if (!acceptPrivacy && needsConsent(person, PRIVACY_VERSION, CONSENT_REQUIRED)) throw consentError(person);
  const { missing } = await missingFor(prisma, person.id);
  if (missing.length) {
    // Shouldn't happen (approval checks completeness), but never publish a half profile.
    throw new ApiError("INCOMPLETE", "Your profile isn't complete. Contact hello@peabudy.com.", 422);
  }

  await prisma.$transaction(async (tx) => {
    const used = await tx.invite.updateMany({
      where: { id: invite.id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date(), usedByUserId: person.id },
    });
    const moved = await tx.user.updateMany({ where: { id: person.id, accountStatus: "applicant" }, data: { accountStatus: "active" } });
    if (used.count !== 1 || moved.count !== 1) throw activationInvalid();
    await tx.authCode.deleteMany({ where: { email: person.email } });
    await tx.profile.update({ where: { userId: person.id }, data: { publicationStatus: "published", publishedAt: new Date() } });
    await tx.search.update({ where: { userId: person.id }, data: { status: "active", version: { increment: 1 } } });
    const score = await snapshotScore(tx, person.id);
    await writeAudit(tx, {
      eventType: "application.activated",
      actorId: person.id,
      subjectId: person.id,
      resourceType: "application",
      resourceId: app.id,
      action: "activate",
      safeAfter: { accountStatus: "active", published: true, score: score.score },
    }, rid);
    await writeAudit(tx, {
      eventType: "invite.used",
      actorId: person.id,
      subjectId: person.id,
      resourceType: "invite",
      resourceId: invite.id,
      action: "use",
    }, rid);
    await writeOutbox(tx, "member_activated", { userId: person.id, applicationId: app.id });
    await writeOutbox(tx, "profile_published", { userId: person.id });
    await notify(tx, person.id, "profile_published", "You're live", "Your profile is published and discovery is on.");
    if (SANDBOX_ON_SIGNUP) await ensureSandboxWorld(tx, person.id);
  }, { timeout: 20000 });
  if (acceptPrivacy && person.privacyConsentVersion !== PRIVACY_VERSION) await recordConsent(person.id, person.privacyConsentVersion, rid);

  await replaceSessions(person.id, "member");
  await prisma.$transaction((tx) =>
    writeAudit(tx, {
      eventType: "auth.session_created",
      actorId: person.id,
      subjectId: person.id,
      resourceType: "session",
      resourceId: person.id,
      action: "activate",
    }, rid)
  );
  return ok(
    {
      user: { id: person.id, email: person.email, displayName: person.displayName, role: person.role },
      is_new: false,
      activated: true,
      redirect: "/discover",
    },
    rid
  );
}
