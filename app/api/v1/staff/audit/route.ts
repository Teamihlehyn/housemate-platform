import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/db";

// GET /api/v1/staff/audit — scoped, redacted audit explorer + outbox health. Admin only (404 otherwise).
export const GET = handler(async (req: NextRequest, { rid }) => {
  await requireAdmin();
  const url = new URL(req.url);
  const eventType = url.searchParams.get("event_type") ?? undefined;

  const [events, outboxPending, outboxDead, totalAudit, signins] = await Promise.all([
    prisma.auditEvent.findMany({
      where: eventType ? { eventType } : {},
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    prisma.outboxEvent.count({ where: { status: "pending" } }),
    prisma.outboxEvent.count({ where: { status: "dead_letter" } }),
    prisma.auditEvent.count(),
    // ENG-48: recent back-office sign-ins for admins to eyeball.
    prisma.auditEvent.findMany({ where: { eventType: "staff.session_created" }, orderBy: { occurredAt: "desc" }, take: 20 }),
  ]);
  const people = await prisma.user.findMany({
    where: { id: { in: [...new Set(signins.map((s) => s.actorId).filter(Boolean) as string[])] } },
    select: { id: true, email: true },
  });
  const emailOf = new Map(people.map((p) => [p.id, p.email]));

  return ok(
    {
      health: { outboxPending, outboxDead, totalAudit },
      recent_staff_signins: signins.map((s) => {
        let after: { role?: string; device?: string } = {};
        try {
          after = s.safeAfter ? JSON.parse(s.safeAfter) : {};
        } catch {
          after = {};
        }
        return { email: (s.actorId && emailOf.get(s.actorId)) || "(account removed)", role: after.role ?? null, device: after.device ?? null, at: s.occurredAt };
      }),
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        actorType: e.actorType,
        action: e.action,
        outcome: e.outcome,
        resourceType: e.resourceType,
        reasonCode: e.reasonCode,
        safeAfter: e.safeAfter ? JSON.parse(e.safeAfter) : null,
        occurredAt: e.occurredAt,
        correlationId: e.correlationId,
      })),
    },
    rid
  );
});
