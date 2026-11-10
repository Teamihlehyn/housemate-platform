import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { clientIp, hashIp } from "@/lib/auth";
import { validateAccessRequest } from "@/lib/accessRequests";
import { PRIVACY_VERSION } from "@/lib/constants";
import { lockKey, recentCount } from "@/lib/rateLimit";

const HOUR = 60 * 60 * 1000;
const MAX_PER_IP_HOUR = 5;
const MAX_SITEWIDE_HOUR = 300;

// POST /api/v1/access-requests {name, email, city, area, move_in_month, how_heard?, note?, consent: true}
// Public. Always 202 {status: "received"} once the input is valid — whether the address
// already has an account, already has a pending request, or is new — so the form can't be
// used to find out who is a member. Only a genuinely new request is stored.
// London (or any city not in OPEN_CITIES) is accepted; staff see it as waitlisted.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const body = await req.json().catch(() => ({}));
  const v = validateAccessRequest(body && typeof body === "object" ? body : {});
  if (!v.ok) {
    const onlyConsent = v.consentMissing && Object.keys(v.fieldErrors).length === 1;
    return fail(
      onlyConsent ? "CONSENT_REQUIRED" : "VALIDATION",
      onlyConsent ? "Tick the box so we can store your request." : "Check the highlighted answers.",
      422,
      rid,
      { field_errors: v.fieldErrors }
    );
  }
  const r = v.value;
  const ipHash = hashIp(clientIp(req));

  const outcome = await prisma.$transaction(async (tx) => {
    await lockKey(tx, `access:email:${r.email}`);
    if (ipHash) await lockKey(tx, `access:ip:${ipHash}`);
    const [fromIp, sitewide] = await Promise.all([
      ipHash ? recentCount(tx, "access.requested", ipHash, HOUR) : 0,
      tx.auditEvent.count({ where: { eventType: "access.requested", occurredAt: { gt: new Date(Date.now() - HOUR) } } }),
    ]);
    if (fromIp >= MAX_PER_IP_HOUR || sitewide >= MAX_SITEWIDE_HOUR) return "limited" as const;

    const [account, pending] = await Promise.all([
      tx.user.findUnique({ where: { email: r.email }, select: { id: true } }),
      tx.accessRequest.findFirst({ where: { email: r.email, status: "pending" }, select: { id: true } }),
    ]);
    const result = account ? "existing_account" : pending ? "duplicate" : "created";
    if (result === "created") {
      await tx.accessRequest.create({
        data: {
          name: r.name,
          email: r.email,
          city: r.city,
          area: r.area,
          moveInMonth: r.moveInMonth,
          howHeard: r.howHeard,
          note: r.note,
          consentVersion: PRIVACY_VERSION,
        },
      });
    }
    // Who asked is unknown: the row carries the salted IP bucket (for the limit) and the
    // city, nothing else.
    await writeAudit(tx, {
      eventType: "access.requested",
      actorType: "service",
      resourceType: ipHash ? "ip" : "none",
      resourceId: ipHash ?? "not_recorded",
      action: "request_access",
      reasonCode: result,
      safeAfter: { city: r.city },
    }, rid);
    return result;
  });

  if (outcome === "limited") {
    return fail("RATE_LIMITED", "Too many requests from this connection. Try again in an hour.", 429, rid, { retry_after: 3600 });
  }
  return ok({ status: "received" }, rid, {}, 202);
});
