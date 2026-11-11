import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { effectiveRole, listedRole } from "@/lib/staff";
import { IS_BETA, IS_RESEARCH, SIGNUPS_PAUSED } from "@/lib/env";
import { validEmail } from "@/lib/accessRequests";
import { PRIVACY_VERSION } from "@/lib/constants";
import { issueCode, padResponse } from "@/lib/codes";


// POST /api/v1/applications/start {email, consent_privacy: true}   — /join step 1 (ENG-40)
// The same 200 for every address: the code always goes to the address itself (E0), so only
// its owner learns what happens next. Members, applicants, declined and suspended addresses
// are sorted out at /applications/verify, after the code proves ownership.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const start = Date.now();
  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.email === "string" ? body.email.trim() : "";
  if (!validEmail(raw)) {
    return fail("VALIDATION", "Enter an email address, like name@example.com.", 422, rid, {
      field_errors: { email: "Enter an email address, like name@example.com." },
    });
  }
  if (body.consent_privacy !== true) {
    return fail("CONSENT_REQUIRED", "Tick the box to agree to the privacy notice so we can store your application.", 422, rid, {
      field_errors: { consent_privacy: "Required." },
    });
  }
  if (SIGNUPS_PAUSED) {
    return fail("FORBIDDEN", "We're not taking new applications for a few days. Please try again later.", 403, rid);
  }
  const email = raw.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true, email: true } });
  // Staff codes never appear on screen (they open the ops console).
  const isStaff = listedRole(email) !== null || (!!existing && effectiveRole(existing) !== "member" && (IS_RESEARCH || IS_BETA));

  const issued = await issueCode(req, rid, { email, eligible: true, isStaff, channel: "application", consentVersion: PRIVACY_VERSION });
  await padResponse(start);
  if (issued.kind === "limited") return issued.response;
  return ok(
    { status: "sent", message: "We've sent a 6-digit code to that address. It expires in 10 minutes.", sink_code: issued.sinkCode },
    rid
  );
});
