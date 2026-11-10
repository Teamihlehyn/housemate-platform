import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { clientIp, hashIp } from "@/lib/auth";
import { MAX_INVITE_CHECKS_PER_HOUR, findInvite, inviteUsable, maskEmail } from "@/lib/invites";
import { lockKey, recentCount } from "@/lib/rateLimit";

const HOUR = 60 * 60 * 1000;
const MAX_PER_IP_HOUR = 30;

// GET /api/v1/invites/[code] → {valid, email_hint?}. Public, for the /invite/[code] page.
// Unknown, malformed, expired and used codes all get the same {valid: false}. A bound
// invite returns a masked hint ("ad•••@gmail.com"), never the address itself.
// Rate-limited per IP bucket (30/h) and site-wide (300/h) so it can't be used to guess codes.
export const GET = handler(async (req: NextRequest, { rid, params }) => {
  const ipHash = hashIp(clientIp(req));
  const limited = await prisma.$transaction(async (tx) => {
    // HM-29: a site-wide cap as well, so many IPs together can't guess codes quickly.
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
  if (limited) {
    return fail("RATE_LIMITED", "Too many invite checks from this connection. Try again in an hour.", 429, rid, { retry_after: 3600 });
  }

  const invite = await findInvite(prisma, params.code);
  if (!inviteUsable(invite, null)) return ok({ valid: false }, rid);
  return ok(invite!.email ? { valid: true, email_hint: maskEmail(invite!.email) } : { valid: true }, rid);
});
