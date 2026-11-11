import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { maskEmail } from "@/lib/invites";
import { countActivationCheck as countCheck } from "@/lib/activationLimits";
import { getCurrentUser } from "@/lib/session";
import { activationTarget } from "@/lib/applicationService";
import { issueCode, padResponse } from "@/lib/codes";

const INVALID =
  "This activation link isn't valid any more. Sign in if you've already activated, or contact hello@peabudy.com.";

// The code is usable, and not being opened by someone signed in as another person (case 10).
async function usableTarget(code: string) {
  const target = await activationTarget(code);
  if (!target) return null;
  const current = await getCurrentUser();
  if (current && current.id !== target.person.id) return null;
  return target;
}

// GET /api/v1/invites/[code] → {valid: true, email_hint} | {valid: false}   (ENG-43)
// Validates an activation code without using it. Every kind of unusable code looks the same.
export const GET = handler(async (req: NextRequest, { rid, params }) => {
  await countCheck(req, rid);
  const target = await usableTarget(params.code);
  if (!target) return ok({ valid: false }, rid);
  return ok({ valid: true, email_hint: maskEmail(target.person.email) }, rid);
});

// POST /api/v1/invites/[code] {} → {status: "sent", email_hint, sink_code?}   (ENG-43)
// Emails a sign-in code to the address the activation code is bound to. The person then
// calls POST /auth/verify-code {activation_code, code}.
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const start = Date.now();
  await countCheck(req, rid);
  const target = await usableTarget(params.code);
  if (!target) return fail("INVITE_INVALID", INVALID, 422, rid);
  const issued = await issueCode(req, rid, { email: target.person.email, eligible: true, isStaff: false, channel: "activation" });
  await padResponse(start);
  if (issued.kind === "limited") return issued.response;
  return ok({ status: "sent", email_hint: maskEmail(target.person.email), sink_code: issued.sinkCode }, rid);
});
