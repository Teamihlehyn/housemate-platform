import { NextRequest } from "next/server";
import { prisma } from "./db";
import { ApiError } from "./api";
import { writeAudit } from "./audit";
import { clientIp, hashIp } from "./auth";
import { MAX_INVITE_CHECKS_PER_HOUR } from "./invites";
import { lockKey, recentCount } from "./rateLimit";

const HOUR = 60 * 60 * 1000;
const MAX_PER_IP_HOUR = 30;

// Every look-up of an activation code (GET/POST /invites/[code], and verify-code with an
// activation_code, HM-42) counts towards the per-IP (30/h) and site-wide (300/h)
// caps (HM-29), so codes can't be guessed quickly.
export async function countActivationCheck(req: NextRequest, rid: string) {
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

