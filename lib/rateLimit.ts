import { Prisma, PrismaClient } from "@prisma/client";

// Counting-based rate limits on the audit log (the same pattern as HM-08's code requests).
// Each limited action writes an audit row whose resourceId is the bucket key (a salted IP
// hash, never the raw IP); the limit is the number of such rows in the window. Indexed by
// AuditEvent(eventType, resourceId, occurredAt).
type Db = PrismaClient | Prisma.TransactionClient;

export async function recentCount(db: Db, eventType: string, key: string, windowMs: number): Promise<number> {
  return db.auditEvent.count({
    where: { eventType, resourceId: key, occurredAt: { gt: new Date(Date.now() - windowMs) } },
  });
}

// Serialise concurrent requests for one key until the transaction ends, so a burst can't
// slip past a cap by counting before any of its rows exist.
export async function lockKey(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
