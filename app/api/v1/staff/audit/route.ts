import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireStaff } from "@/lib/guard";
import { prisma } from "@/lib/db";

// GET /api/v1/staff/audit — scoped, redacted audit explorer + outbox health.
export const GET = handler(async (req: NextRequest, { rid }) => {
  await requireStaff();
  const url = new URL(req.url);
  const eventType = url.searchParams.get("event_type") ?? undefined;

  const [events, outboxPending, outboxDead, totalAudit] = await Promise.all([
    prisma.auditEvent.findMany({
      where: eventType ? { eventType } : {},
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    prisma.outboxEvent.count({ where: { status: "pending" } }),
    prisma.outboxEvent.count({ where: { status: "dead_letter" } }),
    prisma.auditEvent.count(),
  ]);

  return ok(
    {
      health: { outboxPending, outboxDead, totalAudit },
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
