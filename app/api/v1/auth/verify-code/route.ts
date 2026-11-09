import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { CONSENT_REQUIRED } from "@/lib/env";
import { adminEmails } from "@/lib/guard";
import { PRIVACY_VERSION } from "@/lib/constants";
import { MAX_ATTEMPTS_PER_CODE, MAX_FAILED_PER_HOUR, codesMatch, contactHint, isReconsent, needsConsent } from "@/lib/auth";

// POST /api/v1/auth/verify-code {email, code} → session + user.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const { email, code, accept_privacy } = await req.json().catch(() => ({}));
  if (!email || !code) {
    return fail("VALIDATION", "Email and code are required.", 422, rid);
  }
  const clean = String(email).trim().toLowerCase();

  const record = await prisma.authCode.findFirst({
    where: { email: clean },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.expiresAt < new Date()) {
    return fail("CODE_EXPIRED", "That code has expired. Request a new one.", 422, rid);
  }

  // Brute-force limits (HM-03). Across every code for this address in the last hour,
  // at most MAX_FAILED_PER_HOUR wrong guesses.
  const failedLastHour = await prisma.authCode.aggregate({
    where: { email: clean, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    _sum: { attempts: true },
  });
  if ((failedLastHour._sum.attempts ?? 0) >= MAX_FAILED_PER_HOUR) {
    return fail("TOO_MANY_ATTEMPTS", "Too many attempts. Try again in an hour.", 429, rid, { retry_after: 3600 });
  }
  // Per code: claim an attempt atomically BEFORE comparing, so parallel guesses can't
  // all slip in under the cap.
  const claimed = await prisma.authCode.updateMany({
    where: { id: record.id, attempts: { lt: MAX_ATTEMPTS_PER_CODE } },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count === 0) {
    return fail("TOO_MANY_ATTEMPTS", "Too many attempts. Request a new code.", 429, rid);
  }
  if (!codesMatch(record.code, String(code).trim())) {
    return fail("INVALID_CODE", "That code is not correct.", 422, rid, {
      field_errors: { code: "Incorrect code." },
    });
  }
  // A correct code isn't a failed guess: give the attempt back (the code may need a
  // second use when the privacy notice still has to be accepted).
  await prisma.authCode.updateMany({
    where: { id: record.id, attempts: { gt: 0 } },
    data: { attempts: { decrement: 1 } },
  });

  const prior = await prisma.user.findUnique({
    where: { email: clean },
    select: { id: true, accountStatus: true, privacyConsentAt: true, privacyConsentVersion: true },
  });

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
    return fail(
      "FORBIDDEN",
      `Your account is being deleted. If you want to keep it, ${contactHint()}.`,
      403,
      rid
    );
  }

  // Privacy consent (current version) is required before anything is created; the
  // code stays valid until then.
  if (!accept_privacy && needsConsent(prior, PRIVACY_VERSION, CONSENT_REQUIRED)) {
    const message = isReconsent(prior, PRIVACY_VERSION)
      ? "We've updated our privacy notice. Please read it and accept it to continue."
      : "Please accept the privacy notice to continue.";
    return fail("CONSENT_REQUIRED", message, 422, rid, {
      field_errors: { accept_privacy: "Required." },
    });
  }

  // Consume the code (single use).
  await prisma.authCode.deleteMany({ where: { email: clean } });

  // Find or create the account (email sign-in).
  let user = await prisma.user.findUnique({ where: { email: clean } });
  let isNew = false;
  if (!user) {
    isNew = true;
    user = await prisma.user.create({
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
    await prisma.verificationCheck.create({
      data: { userId: user.id, category: "email", status: "verified", points: 10 },
    });
  } else if (!user.emailVerified) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  }
  // Staff bootstrap: emails in ADMIN_EMAILS are granted the admin role on sign-in.
  if (adminEmails().includes(clean) && user.role !== "admin") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
    user.role = "admin";
  }

  if (accept_privacy && user.privacyConsentVersion !== PRIVACY_VERSION) {
    const before = user.privacyConsentVersion;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user!.id },
        data: { privacyConsentAt: new Date(), privacyConsentVersion: PRIVACY_VERSION },
      });
      await writeAudit(tx, {
        eventType: "auth.consent_recorded",
        actorType: "user",
        actorId: user!.id,
        subjectId: user!.id,
        resourceType: "user",
        resourceId: user!.id,
        action: "accept_privacy",
        safeBefore: before ? { version: before } : undefined,
        safeAfter: { version: PRIVACY_VERSION },
      }, rid);
    });
  }

  await createSession(user.id);
  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, {
      eventType: "auth.session_created",
      actorType: "user",
      actorId: user!.id,
      subjectId: user!.id,
      resourceType: "session",
      resourceId: user!.id,
      action: isNew ? "register" : "login",
    }, rid);
  });

  return ok(
    {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      is_new: isNew,
    },
    rid
  );
});
