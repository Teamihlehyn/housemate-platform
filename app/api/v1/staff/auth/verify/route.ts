import { NextRequest, after } from "next/server";
import { deviceHint, sendStaffAlert } from "@/lib/staffAlerts";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { listedRole } from "@/lib/staff";
import { claimCode, invalidCode } from "@/lib/codes";
import { createStaffSession, pendingHashFromCookie } from "@/lib/staffAuth";

// POST /api/v1/staff/auth/verify {email, code}   — back-office step 2 (ENG-47)
// Valid only with the pending cookie from a successful password step on this browser, and the
// emailed code. Then a staff session (hm_staff_session: 12 h, HttpOnly, SameSite=Strict), with
// the stored role set to the listed one. Every failure looks like a wrong code.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !body?.code) return fail("VALIDATION", "Enter the 6-digit code from your email.", 422, rid, { field_errors: { code: "Required." } });
  const pending = await pendingHashFromCookie();
  if (!pending) throw invalidCode();
  const record = await claimCode(email, body.code, "staff", pending);
  if (record.decoy) throw invalidCode();
  const role = listedRole(email);
  const user = role ? await prisma.user.findUnique({ where: { email } }) : null;
  const cred = user ? await prisma.staffCredential.findUnique({ where: { userId: user.id } }) : null;
  if (!role || !user || user.accountStatus !== "active" || !cred) throw invalidCode();

  await prisma.$transaction(async (tx) => {
    await tx.authCode.deleteMany({ where: { email, scope: "staff" } });
    if (user.role !== role) await tx.user.update({ where: { id: user.id }, data: { role } });
    await writeAudit(tx, {
      eventType: "staff.session_created",
      actorType: "staff",
      actorId: user.id,
      subjectId: user.id,
      resourceType: "session",
      resourceId: user.id,
      action: "login",
      safeAfter: { role, device: deviceHint(req.headers.get("user-agent")) },
    }, rid);
  });
  await createStaffSession(user.id);
  // ENG-48: a sign-in alert to every admin and this address (at most one per 10 minutes).
  const ua = req.headers.get("user-agent");
  after(() => sendStaffAlert("signin", { id: user.id, email: user.email }, { rid, userAgent: ua }));
  return ok({ status: "signed_in", role, redirect: "/staff" }, rid);
});
