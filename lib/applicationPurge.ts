import { prisma } from "./db";
import { writeAudit } from "./audit";
import { hashEmailKey } from "./auth";
import { purgeKind, PurgeKind } from "./applications";

// Application retention (R7). Deletes the answers and the applicant account for stale drafts,
// declined and withdrawn applications past 30 days. For a declined application whose reapply
// date hasn't come, only a hashed email and that date survive (ApplicantTombstone), so the
// 30-day reapply rule still holds. Never touches anyone who became a user (accountStatus
// active/restricted/suspended), and audit rows stay (they hold ids, no personal data).
export async function findPurgeable(now: Date = new Date()) {
  const apps = await prisma.application.findMany({
    where: { status: { in: ["draft", "declined", "withdrawn"] } },
    select: { id: true, userId: true, status: true, updatedAt: true, reviewedAt: true, reapplyAfter: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: apps.map((a) => a.userId) } },
    select: { id: true, email: true, accountStatus: true, updatedAt: true, profile: { select: { updatedAt: true } }, search: { select: { updatedAt: true } } },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const out: { appId: string; userId: string; email: string; kind: PurgeKind; reapplyAfter: Date | null }[] = [];
  for (const a of apps) {
    const u = byId.get(a.userId);
    if (!u) continue;
    const touched = [a.updatedAt, u.updatedAt, u.profile?.updatedAt, u.search?.updatedAt].filter(Boolean) as Date[];
    const last = new Date(Math.max(...touched.map((d) => d.getTime())));
    const kind = purgeKind(a, u.accountStatus, last, now);
    if (kind) out.push({ appId: a.id, userId: u.id, email: u.email, kind, reapplyAfter: a.reapplyAfter });
  }
  return out;
}

export async function purgeApplications(opts: { dryRun: boolean; staffId: string; rid: string; now?: Date }) {
  const now = opts.now ?? new Date();
  const rows = await findPurgeable(now);
  const counts = {
    stale_drafts: rows.filter((r) => r.kind === "stale_draft").length,
    declined: rows.filter((r) => r.kind === "declined").length,
    withdrawn: rows.filter((r) => r.kind === "withdrawn").length,
    expired_tombstones: await prisma.applicantTombstone.count({ where: { reapplyAfter: { lte: now } } }),
  };
  if (opts.dryRun) return { dry_run: true, ...counts };

  const userIds = rows.map((r) => r.userId);
  const emails = rows.map((r) => r.email);
  const kept = await prisma.$transaction(async (tx) => {
    let tombstones = 0;
    for (const r of rows) {
      if (r.kind === "declined" && r.reapplyAfter && r.reapplyAfter > now) {
        await tx.applicantTombstone.upsert({
          where: { emailHash: hashEmailKey(r.email) },
          create: { emailHash: hashEmailKey(r.email), reapplyAfter: r.reapplyAfter },
          update: { reapplyAfter: r.reapplyAfter },
        });
        tombstones++;
      }
    }
    // Rows without foreign keys first, then the user (cascades profile, search, answers,
    // checks, sessions, score snapshots).
    await tx.invite.deleteMany({ where: { applicationId: { in: rows.map((r) => r.appId) } } });
    await tx.application.deleteMany({ where: { id: { in: rows.map((r) => r.appId) } } });
    await tx.authCode.deleteMany({ where: { email: { in: emails } } });
    await tx.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await tx.testerFeedback.deleteMany({ where: { userId: { in: userIds } } });
    await tx.idempotencyKey.deleteMany({ where: { actorId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds }, accountStatus: { in: ["applicant", "deletion_pending"] } } });
    const expired = await tx.applicantTombstone.deleteMany({ where: { reapplyAfter: { lte: now } } });
    await writeAudit(tx, {
      eventType: "application.purged",
      actorType: "staff",
      actorId: opts.staffId,
      resourceType: "application",
      resourceId: "purge",
      action: "purge",
      safeAfter: { ...counts, tombstones_kept: tombstones, tombstones_expired: expired.count },
    }, opts.rid);
    return tombstones;
  }, { timeout: 30000 });
  return { dry_run: false, ...counts, deleted_accounts: rows.length, tombstones_kept: kept };
}

// /join verify for a new address: a purged declined application still blocks reapplying until
// its date. Returns the reapply date, or null (and clears an expired tombstone).
export async function tombstoneReapplyAfter(email: string, now: Date = new Date()): Promise<Date | null> {
  const t = await prisma.applicantTombstone.findUnique({ where: { emailHash: hashEmailKey(email) } });
  if (!t) return null;
  if (t.reapplyAfter > now) return t.reapplyAfter;
  await prisma.applicantTombstone.delete({ where: { emailHash: t.emailHash } }).catch(() => undefined);
  return null;
}
