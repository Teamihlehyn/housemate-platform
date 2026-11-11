import { NextRequest } from "next/server";
import { prisma } from "./db";
import { writeAudit } from "./audit";
import { clientIp, hashIp } from "./auth";
import { emailKey } from "./codes";
import { lockKey, recentCount } from "./rateLimit";
import { FAIL_WINDOW_MS, MAX_FAILS_PER_ADDRESS, MAX_FAILS_PER_IP_HOUR } from "./staffAuth";

// Counting for the back-office sign-in (ENG-47), on the audit log like every other limit.
// Keys are the keyed email hash (EMAIL_HASH_SECRET) and the salted IP bucket (IP_HASH_SALT),
// and every address is counted the same way, allowlisted or not.
const HOUR = 60 * 60 * 1000;

export function keysFor(req: NextRequest, email: string) {
  return { emailHash: emailKey(email), ipHash: hashIp(clientIp(req)) };
}

// Is this address or connection locked out after wrong passwords?
export async function passwordLocked(keys: { emailHash: string; ipHash: string | null }): Promise<boolean> {
  const [byAddress, byIp] = await Promise.all([
    recentCount(prisma, "staff.password_failed", keys.emailHash, FAIL_WINDOW_MS),
    keys.ipHash ? recentCount(prisma, "staff.password_failed_ip", keys.ipHash, HOUR) : 0,
  ]);
  return byAddress >= MAX_FAILS_PER_ADDRESS || byIp >= MAX_FAILS_PER_IP_HOUR;
}

export async function recordPasswordFailure(keys: { emailHash: string; ipHash: string | null }, rid: string) {
  await prisma.$transaction(async (tx) => {
    await lockKey(tx, `staff-pw:${keys.emailHash}`);
    await writeAudit(tx, { eventType: "staff.password_failed", actorType: "service", resourceType: "email_hash", resourceId: keys.emailHash, action: "password", outcome: "denied" }, rid);
    if (keys.ipHash) {
      await writeAudit(tx, { eventType: "staff.password_failed_ip", actorType: "service", resourceType: "ip", resourceId: keys.ipHash, action: "password", outcome: "denied" }, rid);
    }
  });
}

// Set-up link requests: 3 an hour per address, 10 an hour per connection. Returns true when
// over a limit; otherwise records this request.
export async function setupRequestLimited(keys: { emailHash: string; ipHash: string | null }, rid: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await lockKey(tx, `staff-setup:${keys.emailHash}`);
    const [byAddress, byIp] = await Promise.all([
      recentCount(tx, "staff.setup_requested", keys.emailHash, HOUR),
      keys.ipHash ? recentCount(tx, "staff.setup_requested_ip", keys.ipHash, HOUR) : 0,
    ]);
    if (byAddress >= 3 || byIp >= 10) return true;
    await writeAudit(tx, { eventType: "staff.setup_requested", actorType: "service", resourceType: "email_hash", resourceId: keys.emailHash, action: "request" }, rid);
    if (keys.ipHash) await writeAudit(tx, { eventType: "staff.setup_requested_ip", actorType: "service", resourceType: "ip", resourceId: keys.ipHash, action: "request" }, rid);
    return false;
  });
}
