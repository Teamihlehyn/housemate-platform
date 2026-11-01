import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireStaff } from "@/lib/guard";
import { prisma } from "@/lib/db";

// GET /api/v1/staff/research — tester feedback, safety reports and test-cohort counts.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  await requireStaff();
  const [feedback, reports, testers, personas, households, completed] = await Promise.all([
    prisma.testerFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.user.count({ where: { isDemoBot: false, sandboxWorldId: { not: null } } }),
    prisma.user.count({ where: { isDemoBot: false, email: { startsWith: "demo-" } } }),
    prisma.household.count({ where: { state: { in: ["active", "completed"] } } }),
    prisma.household.count({ where: { state: "completed" } }),
  ]);
  const ids = [...new Set(reports.flatMap((r) => [r.reporterId, r.targetUserId]))];
  const names = new Map(
    (await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } })).map((u) => [u.id, u.displayName])
  );
  return ok(
    {
      counts: { testers, personas, households, completed },
      feedback,
      reports: reports.map((r) => ({
        ...r,
        caseId: r.id.slice(-6).toUpperCase(),
        reporter: names.get(r.reporterId) ?? "—",
        target: names.get(r.targetUserId) ?? "—",
      })),
    },
    rid
  );
});
