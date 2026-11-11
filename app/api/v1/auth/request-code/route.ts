import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { effectiveRole, listedRole } from "@/lib/staff";
import { APPROVAL_FIRST, IS_BETA, IS_RESEARCH } from "@/lib/env";
import { validEmail } from "@/lib/accessRequests";
import { issueCode, padResponse } from "@/lib/codes";

// POST /api/v1/auth/request-code {email}   — sign-in, members only (ENG-41)
//
// Approval-first (beta): every well-formed address gets the identical 200 below, in the same
// time. A code is emailed only to active members (not suspended or being deleted) and to
// ADMIN_EMAILS. Unknown, applicant, declined and suspended addresses get no code and no email.
// Rate limits are counted the same way for every address, so they can't tell them apart
// either (HM-28). The email is sent after the response; every answer is padded to a floor.
// Demo modes keep open sign-in: anyone gets a code (on screen, except staff).
// `invite_code` is no longer read here: activation codes are used at /invite/[code].
export const POST = handler(async (req: NextRequest, { rid }) => {
  const start = Date.now();
  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.email === "string" ? body.email.trim() : "";
  if (!validEmail(raw)) {
    return fail("VALIDATION", "Enter a valid email address.", 422, rid, {
      field_errors: { email: "Enter a valid email address." },
    });
  }
  const email = raw.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true, email: true, accountStatus: true } });
  // Listed staff (ADMIN_EMAILS / STAFF_EMAILS) sign in even before their account exists.
  const bootstrapAdmin = listedRole(email) !== null;
  const isStaff = bootstrapAdmin || (!!existing && effectiveRole(existing) !== "member" && (IS_RESEARCH || IS_BETA));
  const eligible =
    !APPROVAL_FIRST || bootstrapAdmin || (!!existing && (existing.accountStatus === "active" || existing.accountStatus === "restricted"));

  const issued = await issueCode(req, rid, { email, eligible, isStaff, channel: "signin" });
  await padResponse(start);
  if (issued.kind === "limited") return issued.response;
  return ok(
    {
      status: "sent",
      message: APPROVAL_FIRST
        ? "If you have an approved Peabudy account, we've sent a code. New here? Apply to join."
        : "We've sent a 6-digit code to that address.",
      sink_code: issued.sinkCode,
    },
    rid
  );
});
