import { NextRequest, after } from "next/server";
import { sendStaffAlert } from "@/lib/staffAlerts";
import { handler, ok, fail, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { listedRole } from "@/lib/staff";
import { hashPassword, passwordProblem, plausibleToken, sha256 } from "@/lib/staffAuth";
import { clearLockout } from "@/lib/staffLimits";

const INVALID = "This link isn't valid any more. Ask for a new one on the back-office sign-in page.";

// POST /api/v1/staff/auth/setup {token, password}   (ENG-47)
// Uses a set-up link once: checks the password, stores its scrypt hash, ends every staff
// session for the account, audits staff.password_set. Creates a staff-only account (no profile,
// never in the product) when the allowlisted address has none yet.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const body = await req.json().catch(() => ({}));
  if (!plausibleToken(body?.token)) return fail("INVITE_INVALID", INVALID, 422, rid);
  const row = await prisma.staffSetupToken.findUnique({ where: { tokenHash: sha256(body.token) } });
  if (!row || row.usedAt || row.expiresAt <= new Date()) return fail("INVITE_INVALID", INVALID, 422, rid);
  const role = listedRole(row.email);
  if (!role) return fail("INVITE_INVALID", INVALID, 422, rid);
  const problem = passwordProblem(body.password, row.email);
  if (problem) return fail("VALIDATION", problem, 422, rid, { field_errors: { password: problem } });
  const passwordHash = await hashPassword(body.password);

  let staffUser: { id: string; email: string } | null = null;
  await prisma.$transaction(async (tx) => {
    const used = await tx.staffSetupToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw new ApiError("INVITE_INVALID", INVALID, 422);
    let user = await tx.user.findUnique({ where: { email: row.email } });
    if (user && user.accountStatus !== "active") throw new ApiError("INVITE_INVALID", INVALID, 422);
    if (!user) {
      user = await tx.user.create({
        data: { email: row.email, emailVerified: true, displayName: row.email.split("@")[0].slice(0, 40), accountStatus: "active", role },
      });
    } else if (user.role !== role) {
      await tx.user.update({ where: { id: user.id }, data: { role } });
    }
    await tx.staffCredential.upsert({
      where: { userId: user.id },
      create: { userId: user.id, passwordHash, passwordSetAt: new Date() },
      update: { passwordHash, passwordSetAt: new Date() },
    });
    await tx.session.deleteMany({ where: { userId: user.id, scope: "staff" } });
    await tx.authCode.deleteMany({ where: { email: row.email, scope: "staff" } });
    // Earlier password attempts on this address no longer count (HM-43).
    await clearLockout(tx, row.email, rid);
    await writeAudit(tx, {
      eventType: "staff.password_set",
      actorType: "staff",
      actorId: user.id,
      subjectId: user.id,
      resourceType: "user",
      resourceId: user.id,
      action: "set_password",
      safeAfter: { role },
    }, rid);
    staffUser = { id: user.id, email: user.email };
  });
  // ENG-48: every admin, and this address, hear about it (after the response, never blocking).
  const alerted = staffUser as { id: string; email: string } | null;
  if (alerted) after(() => sendStaffAlert("password_set", alerted, { rid }));
  return ok({ status: "set", redirect: "/staff/signin" }, rid);
});
