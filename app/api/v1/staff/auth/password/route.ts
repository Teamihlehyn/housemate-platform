import { NextRequest, after } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { validEmail } from "@/lib/accessRequests";
import { listedRole } from "@/lib/staff";
import { generateLoginCode } from "@/lib/auth";
import { padResponse } from "@/lib/codes";
import { sendEmail } from "@/lib/email";
import { staffCodeEmail } from "@/lib/emails";
import { PASSWORD_MAX, burnPasswordCheck, newToken, setPendingCookie, verifyPassword } from "@/lib/staffAuth";
import { claimPasswordAttempt, keysFor, recordPasswordOk } from "@/lib/staffLimits";

const MESSAGE = "If your email and password are right, we've emailed you a 6-digit code.";
const FLOOR_MS = 700;

// POST /api/v1/staff/auth/password {email, password}   — back-office step 1 (ENG-47)
// Every address gets the identical 200 and timing, and a pending cookie that binds step 2 to
// this request. Only an allowlisted, active account whose password verifies gets a real code
// by email; anyone else gets a never-sent decoy code row (as HM-35), so step 2 answers the same.
// Limits (lib/staffLimits.ts): every attempt is counted before the password is checked; over a
// limit → the same 429 for every address.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const start = Date.now();
  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  // HM-46: an over-long password gets the same 422 as an empty one, before any hashing.
  if (!validEmail(raw) || !password || password.length > PASSWORD_MAX) {
    return fail("VALIDATION", "Enter your email and password.", 422, rid, {
      field_errors: { ...(validEmail(raw) ? {} : { email: "Enter your work email address." }), ...(password && password.length <= PASSWORD_MAX ? {} : { password: "Enter your password." }) },
    });
  }
  const email = raw.toLowerCase();
  const keys = keysFor(req, email);
  if (!(await claimPasswordAttempt(keys, rid))) {
    await padResponse(start, FLOOR_MS);
    return fail("RATE_LIMITED", "Too many attempts. Try again in 15 minutes.", 429, rid, { retry_after: 900 });
  }

  const user = listedRole(email) ? await prisma.user.findUnique({ where: { email } }) : null;
  const cred = user && user.accountStatus === "active" ? await prisma.staffCredential.findUnique({ where: { userId: user.id } }) : null;
  const good = cred ? await verifyPassword(password, cred.passwordHash) : (await burnPasswordCheck(password), false);

  const pending = newToken();
  const code = generateLoginCode();
  await prisma.authCode.create({
    data: { email, code, scope: "staff", pendingHash: pending.hash, decoy: !good, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  await setPendingCookie(pending.token);
  if (good) {
    await prisma.$transaction(async (tx) => {
      await writeAudit(tx, { eventType: "staff.password_ok", actorType: "staff", actorId: user!.id, subjectId: user!.id, resourceType: "user", resourceId: user!.id, action: "password" }, rid);
    });
    after(async () => {
      try {
        await sendEmail({ to: email, ...staffCodeEmail({ code }), what: "your code" });
        await prisma.$transaction((tx) =>
          writeAudit(tx, { eventType: "email.sent", actorType: "service", subjectId: user!.id, resourceType: "email", resourceId: "staff_code", action: "send" }, rid)
        );
      } catch (e) {
        console.error("Staff code email failed", (e as { code?: string })?.code ?? "unknown");
      }
    });
    await recordPasswordOk(keys, rid);
  }
  await padResponse(start, FLOOR_MS);
  return ok({ status: "sent", message: MESSAGE }, rid);
});
