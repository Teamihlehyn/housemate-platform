import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser, withIdempotency } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";
import { addDays, testToday } from "@/lib/dates";

// GET /api/v1/introductions?direction=incoming|outgoing
export const GET = handler(async (req: NextRequest, { rid }) => {
  const user = await requireUser();
  const direction = new URL(req.url).searchParams.get("direction") ?? "incoming";

  const intros = await prisma.introduction.findMany({
    where:
      direction === "outgoing"
        ? { senderId: user.id }
        : { senderId: { not: user.id }, OR: [{ lowUserId: user.id }, { highUserId: user.id }] },
    orderBy: { createdAt: "desc" },
    include: { conversation: true },
  });

  const otherIds = intros.map((i) => (i.lowUserId === user.id ? i.highUserId : i.lowUserId));
  const others = await prisma.user.findMany({
    where: { id: { in: otherIds } },
    include: { profile: true },
  });
  const map = new Map(others.map((o) => [o.id, o]));

  return ok(
    {
      introductions: intros.map((i) => {
        const otherId = i.lowUserId === user.id ? i.highUserId : i.lowUserId;
        const o = map.get(otherId);
        return {
          id: i.id,
          state: i.state,
          text: i.state === "pending" || i.conversation ? i.text : undefined,
          otherUserId: otherId,
          otherName: o?.displayName ?? "Member",
          otherInitials: o?.profile?.avatarInitials ?? "?",
          isSender: i.senderId === user.id,
          conversationId: i.conversation?.id ?? null,
          expiresAt: i.expiresAt,
          version: i.version,
        };
      }),
    },
    rid
  );
});

// POST /api/v1/introductions {target_user_id, text}
export const POST = handler(async (req: NextRequest, { rid }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const idemKey = req.headers.get("idempotency-key");
  const targetId = body.target_user_id;
  const text = String(body.text ?? "").trim();

  if (!targetId || targetId === user.id)
    return fail("VALIDATION", "Invalid target.", 422, rid);
  if (text.length < 30 || text.length > 300)
    return fail("VALIDATION", "Introduction must be 30–300 characters.", 422, rid, {
      field_errors: { text: "Introduction must be 30–300 characters." },
    });

  // Eligibility re-check at commit time.
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    include: { profile: true, search: true },
  });
  if (!target || target.accountStatus !== "active" || target.profile?.publicationStatus !== "published")
    return fail("NOT_FOUND", "This member is not available.", 404, rid);

  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: user.id, blockedId: targetId },
        { blockerId: targetId, blockedId: user.id },
      ],
    },
  });
  if (block) return fail("NOT_FOUND", "This member is not available.", 404, rid);

  // Rate limits: 10 new / 24h; 20 pending.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.introduction.count({
    where: { senderId: user.id, createdAt: { gt: since } },
  });
  if (recent >= 10)
    return fail("RATE_LIMITED", "You've reached the daily introduction limit.", 429, rid, {
      retry_after: 3600,
    });
  const pending = await prisma.introduction.count({
    where: { senderId: user.id, state: "pending" },
  });
  if (pending >= 20)
    return fail("RATE_LIMITED", "You have too many pending introductions.", 429, rid);

  const [low, high] = user.id < targetId ? [user.id, targetId] : [targetId, user.id];

  const run = () =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.introduction.findUnique({
        where: { lowUserId_highUserId: { lowUserId: low, highUserId: high } },
      });
      if (existing) {
        if (existing.state === "pending" || existing.state === "accepted") {
          return { id: existing.id, state: existing.state, already: true };
        }
        // Declined/expired: 30-day resend cooldown.
        const cooldownEnd = addDays(existing.updatedAt.toISOString().slice(0, 10), 30);
        if (testToday() < cooldownEnd) {
          throw Object.assign(new Error("cooldown"), { _cooldown: true });
        }
        const updated = await tx.introduction.update({
          where: { id: existing.id },
          data: {
            state: "pending",
            senderId: user.id,
            text,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            version: existing.version + 1,
          },
        });
        await writeAudit(tx, { eventType: "introduction.sent", actorId: user.id, subjectId: targetId, resourceType: "introduction", resourceId: updated.id, action: "resend" }, rid);
        await writeOutbox(tx, "introduction_sent", { id: updated.id });
        await notify(tx, targetId, "introduction_received", "New introduction", `${user.displayName} would like to connect.`);
        return { id: updated.id, state: "pending", already: false };
      }
      const created = await tx.introduction.create({
        data: {
          lowUserId: low,
          highUserId: high,
          senderId: user.id,
          text,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await writeAudit(tx, { eventType: "introduction.sent", actorId: user.id, subjectId: targetId, resourceType: "introduction", resourceId: created.id, action: "create" }, rid);
      await writeOutbox(tx, "introduction_sent", { id: created.id });
      await notify(tx, targetId, "introduction_received", "New introduction", `${user.displayName} would like to connect.`);
      return { id: created.id, state: "pending", already: false };
    });

  try {
    const { result } = await withIdempotency(idemKey, user.id, "POST /introductions", body, run);
    return ok(result, rid);
  } catch (e) {
    if ((e as { _cooldown?: boolean })._cooldown)
      return fail("COOLDOWN", "You can't resend to this member yet.", 409, rid);
    throw e;
  }
});
