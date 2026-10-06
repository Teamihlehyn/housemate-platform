import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { IS_BETA } from "@/lib/env";
import { PRIVACY_VERSION } from "@/lib/constants";

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
  if (record.attempts >= 5) {
    return fail("TOO_MANY_ATTEMPTS", "Too many attempts. Request a new code.", 429, rid);
  }
  if (record.code !== String(code).trim()) {
    await prisma.authCode.update({
      where: { id: record.id },
      data: { attempts: record.attempts + 1 },
    });
    return fail("INVALID_CODE", "That code is not correct.", 422, rid, {
      field_errors: { code: "Incorrect code." },
    });
  }

  // Consume the code.
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
  if (user.accountStatus === "deleted") {
    return fail("ACCOUNT_DELETED", "This account no longer exists.", 403, rid);
  }

  // Staff bootstrap: emails in ADMIN_EMAILS are granted the admin role on sign-in.
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.includes(clean) && user.role !== "admin") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
    user.role = "admin";
  }

  // Privacy consent. Required in the real-user pilot before a session is granted.
  if (accept_privacy) {
    await prisma.user.update({
      where: { id: user.id },
      data: { privacyConsentAt: new Date(), privacyConsentVersion: PRIVACY_VERSION },
    });
  } else if (IS_BETA && !user.privacyConsentAt) {
    return fail("CONSENT_REQUIRED", "Please accept the privacy notice to continue.", 422, rid, {
      field_errors: { accept_privacy: "Required." },
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
