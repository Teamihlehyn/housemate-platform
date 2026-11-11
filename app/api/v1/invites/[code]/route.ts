import { NextRequest } from "next/server";
import { handler, ok, fail, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { clientIp, hashIp } from "@/lib/auth";
import { MAX_INVITE_CHECKS_PER_HOUR, maskEmail } from "@/lib/invites";
import { lockKey, recentCount } from "@/lib/rateLimit";
import { getCurrentUser } from "@/lib/session";
import { activationTarget } from "@/lib/applicationService";
import { issueCode, padResponse } from "@/lib/codes";

const HOUR = 60 * 60 * 1000;
const MAX_PER_IP_HOUR = 30;
const INVALID =
  "This activation link isn't valid any more. Sign in if you've already activated, or contact hello@peabudy.com.";

// Every look-up of a code (GET or POST) counts towards the per-IP (30/h) and site-wide (300/h)
// caps (HM-29), so codes can't be guessed quickly.
async function countCheck(req: NextRequest, rid: string) {
  const ipHash = hashIp(clientIp(req));
  const limited = await prisma.$transaction(async (tx) => {
    const sitewide = await tx.auditEvent.count({
      where: { eventType: "invite.checked", occurredAt: { gt: new Date(Date.now() - HOUR) } },
    });
    if (sitewide >= MAX_INVITE_CHECKS_PER_HOUR) return true;
    if (ipHash) {
      await lockKey(tx, `invite-check:ip:${ipHash}`);
      if ((await recentCount(tx, "invite.checked", ipHash, HOUR)) >= MAX_PER_IP_HOUR) return true;
    }
    await writeAudit(tx, {
      eventType: "invite.checked",
      actorType: "service",
      resourceType: ipHash ? "ip" : "none",
      resourceId: ipHash ?? "not_recorded",
      action: "check",
    }, rid);
    return false;
  });
  if (limited) throw new ApiError("RATE_LIMITED", "Too many activation checks from this connection. Try again in an hour.", 429, undefined, 3600);
}

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
