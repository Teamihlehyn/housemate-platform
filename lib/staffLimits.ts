import { NextRequest } from "next/server";
import { prisma } from "./db";
import { writeAudit } from "./audit";
import { clientIp, hashIp } from "./auth";
import { emailKey } from "./codes";
import { lockKey, recentCount } from "./rateLimit";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { MAX_ATTEMPTS_PER_ADDRESS_HOUR, MAX_ATTEMPTS_PER_IP_HOUR, MAX_ATTEMPTS_PER_PAIR, PAIR_WINDOW_MS } from "./staffAuth";

// Counting for the back-office sign-in (ENG-47), on the audit log like every other limit.
// Keys are the keyed email hash (EMAIL_HASH_SECRET) and the salted IP bucket (IP_HASH_SALT),
// and every address is counted the same way, allowlisted or not.
const HOUR = 60 * 60 * 1000;

export function keysFor(req: NextRequest, email: string) {
  return { emailHash: emailKey(email), ipHash: hashIp(clientIp(req)) };
}

// Password attempts (HM-43, HM-45). Every attempt, right or wrong, is counted and recorded in one
// locked transaction BEFORE the password is checked, so parallel guesses can't slip past.
// Limits, counted the same way for every address (allowlisted or not):
//   per address + connection: 5 attempts in 15 minutes, restarting after a right password there;
//   per address: 50 attempts an hour (a ceiling against spread-out guessing; logged as an alert);
//   per connection: 20 attempts an hour.
// Keying the tight limit on the pair means a stranger's wrong passwords from another connection
// can't lock a staff member out. A successful password set-up clears earlier attempts.
function pairKey(keys: { emailHash: string; ipHash: string | null }) {
  return createHash("sha256").update(`${keys.emailHash}|${keys.ipHash ?? "no-ip"}`).digest("hex").slice(0, 32);
}

async function latest(tx: Prisma.TransactionClient, eventType: string, resourceId: string): Promise<number> {
  const row = await tx.auditEvent.findFirst({ where: { eventType, resourceId }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true } });
  return row?.occurredAt.getTime() ?? 0;
}

// Returns false (and records nothing more) when this attempt is over a limit.
export async function claimPasswordAttempt(keys: { emailHash: string; ipHash: string | null }, rid: string): Promise<boolean> {
  const pair = pairKey(keys);
  return prisma.$transaction(async (tx) => {
    await lockKey(tx, `staff-pw:${keys.emailHash}`);
    if (keys.ipHash) await lockKey(tx, `staff-pw-ip:${keys.ipHash}`);
    const now = Date.now();
    const cleared = await latest(tx, "staff.lockout_cleared", keys.emailHash);
    const pairOk = await latest(tx, "staff.pw_ok", pair);
    const pairSince = new Date(Math.max(now - PAIR_WINDOW_MS, cleared, pairOk));
    const addrSince = new Date(Math.max(now - HOUR, cleared));
    const [byPair, byAddress, byIp] = await Promise.all([
      tx.auditEvent.count({ where: { eventType: "staff.pw_attempt", resourceId: pair, occurredAt: { gt: pairSince } } }),
      tx.auditEvent.count({ where: { eventType: "staff.pw_attempt_addr", resourceId: keys.emailHash, occurredAt: { gt: addrSince } } }),
      keys.ipHash ? recentCount(tx, "staff.pw_attempt_ip", keys.ipHash, HOUR) : 0,
    ]);
    if (byPair >= MAX_ATTEMPTS_PER_PAIR || byAddress >= MAX_ATTEMPTS_PER_ADDRESS_HOUR || byIp >= MAX_ATTEMPTS_PER_IP_HOUR) {
      if (byAddress >= MAX_ATTEMPTS_PER_ADDRESS_HOUR) {
        // Many connections guessing one address: worth a look in the logs.
        console.warn("ALERT staff sign-in: an address hit the hourly password-attempt ceiling", keys.emailHash.slice(0, 8));
      }
      await writeAudit(tx, { eventType: "staff.pw_locked", actorType: "service", resourceType: "email_hash", resourceId: keys.emailHash, action: "password", outcome: "denied",
        reasonCode: byAddress >= MAX_ATTEMPTS_PER_ADDRESS_HOUR ? "address_ceiling" : byPair >= MAX_ATTEMPTS_PER_PAIR ? "pair" : "ip" }, rid);
      return false;
    }
    await writeAudit(tx, { eventType: "staff.pw_attempt", actorType: "service", resourceType: "pair_hash", resourceId: pair, action: "password" }, rid);
    await writeAudit(tx, { eventType: "staff.pw_attempt_addr", actorType: "service", resourceType: "email_hash", resourceId: keys.emailHash, action: "password" }, rid);
    if (keys.ipHash) await writeAudit(tx, { eventType: "staff.pw_attempt_ip", actorType: "service", resourceType: "ip", resourceId: keys.ipHash, action: "password" }, rid);
    return true;
  });
}

// A right password restarts the address + connection count.
export async function recordPasswordOk(keys: { emailHash: string; ipHash: string | null }, rid: string) {
  await prisma.$transaction((tx) =>
    writeAudit(tx, { eventType: "staff.pw_ok", actorType: "service", resourceType: "pair_hash", resourceId: pairKey(keys), action: "password" }, rid)
  );
}

// After a successful password set-up: earlier attempts on this address no longer count.
export async function clearLockout(tx: Prisma.TransactionClient, email: string, rid: string) {
  await writeAudit(tx, { eventType: "staff.lockout_cleared", actorType: "service", resourceType: "email_hash", resourceId: emailKey(email), action: "clear" }, rid);
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
