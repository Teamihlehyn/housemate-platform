import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/db";

// GET /api/v1/staff/funnel?days=30 — admin only (404 otherwise). Counts per flow version, city,
// event and step (ENG-58): events, and distinct anonymous funnels. Nothing per person.
export const GET = handler(async (req: NextRequest, { rid }) => {
  await requireAdmin();
  const days = Number(req.nextUrl.searchParams.get("days") ?? 30);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return fail("VALIDATION", "Choose between 1 and 365 days.", 422, rid, { field_errors: { days: "1–365." } });
  }
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.$queryRaw<{ flow_version: string; city: string | null; event: string; step: string | null; step_index: number | null; events: number; funnels: number }[]>`
    SELECT "flowVersion" AS flow_version, city, event, step, min("stepIndex") AS step_index,
           count(*)::int AS events, count(DISTINCT "funnelId")::int AS funnels
    FROM "FunnelEvent" WHERE "createdAt" > ${since}
    GROUP BY "flowVersion", city, event, step
    ORDER BY "flowVersion", city NULLS FIRST, event, min("stepIndex") NULLS FIRST, step`;
  return ok({ days, rows }, rid);
});
