import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireStaff } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { IS_BETA } from "@/lib/env";

const PAGE = 50;

// GET /api/v1/staff/research?before=<ISO time> — feedback, safety reports and counts.
// Feedback shows who sent it (display name + the last 6 characters of the account ID only;
// never the full ID or the email) or "Signed out" (ENG-31). Paged: pass the last item's createdAt as `before`
// to load more feedback. Counts: beta → members, verified, feedback in the last 7 days;
// research → the tester cohort counts.
export const GET = handler(async (req: NextRequest, { rid }) => {
  await requireStaff();
  const beforeRaw = req.nextUrl.searchParams.get("before");
  const before = beforeRaw && !Number.isNaN(Date.parse(beforeRaw)) ? new Date(beforeRaw) : null;

  const feedback = await prisma.testerFeedback.findMany({
    where: before ? { createdAt: { lt: before } } : {},
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
  });
  const more = feedback.length > PAGE;
  const page = feedback.slice(0, PAGE);
  const senderIds = [...new Set(page.map((f) => f.userId).filter(Boolean) as string[])];

  // Later pages carry only feedback.
  if (before) {
    const senders = await names(senderIds);
    return ok({ feedback: page.map((f) => feedbackDto(f, senders)), more_feedback: more }, rid);
  }

  const reports = await prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const senders = await names([...senderIds, ...reports.flatMap((r) => [r.reporterId, r.targetUserId])]);
  const counts = IS_BETA ? await betaCounts() : await researchCounts();
  return ok(
    {
      mode: IS_BETA ? "beta" : "research",
      counts,
      feedback: page.map((f) => feedbackDto(f, senders)),
      more_feedback: more,
      reports: reports.map((r) => ({
        ...r,
        caseId: r.id.slice(-6).toUpperCase(),
        reporter: senders.get(r.reporterId) ?? "—",
        target: senders.get(r.targetUserId) ?? "—",
      })),
    },
    rid
  );
});

async function names(ids: string[]) {
  const rows = await prisma.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, displayName: true } });
  return new Map(rows.map((u) => [u.id, u.displayName]));
}

function feedbackDto(
  f: { id: string; userId: string | null; testerId: string | null; source: string | null; page: string; rating: number | null; message: string; createdAt: Date },
  senders: Map<string, string>
) {
  return {
    id: f.id,
    page: f.page,
    rating: f.rating,
    message: f.message,
    source: f.source,
    testerId: f.testerId,
    createdAt: f.createdAt,
    sender: f.userId
      ? { signedIn: true, displayName: senders.get(f.userId) ?? "Deleted account", ref: f.userId.slice(-6).toUpperCase() }
      : { signedIn: false },
  };
}

async function betaCounts() {
  const member = { isDemoBot: false, role: "member" };
  const [members, verified, feedback7d] = await Promise.all([
    prisma.user.count({ where: { ...member, accountStatus: { in: ["active", "restricted"] } } }),
    prisma.user.count({ where: { ...member, checks: { some: { category: "identity", status: "verified" } } } }),
    prisma.testerFeedback.count({ where: { createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
  ]);
  return { members, verified, feedback7d };
}

async function researchCounts() {
  const [testers, personas, households, completed] = await Promise.all([
    prisma.user.count({ where: { isDemoBot: false, sandboxWorldId: { not: null } } }),
    prisma.user.count({ where: { isDemoBot: false, email: { startsWith: "demo-" } } }),
    prisma.household.count({ where: { state: { in: ["active", "completed"] } } }),
    prisma.household.count({ where: { state: "completed" } }),
  ]);
  return { testers, personas, households, completed };
}
