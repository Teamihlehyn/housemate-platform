import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireStaff } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { accessRequestDtos, inviteAbuseCounts } from "@/lib/staffInvites";
import { MAX_INVITE_CHECKS_PER_HOUR, MAX_INVITE_FAILURES_PER_HOUR } from "@/lib/invites";

const STATUSES = ["pending", "invited", "declined", "all"];

// GET /api/v1/staff/access-requests?status=pending|invited|declined|all (default pending)
// Pending: oldest first, cities that aren't open yet (waitlisted) last. Others: newest first.
export const GET = handler(async (req: NextRequest, { rid }) => {
  await requireStaff();
  const status = req.nextUrl.searchParams.get("status") || "pending";
  if (!STATUSES.includes(status)) {
    return fail("VALIDATION", "Status must be pending, invited, declined or all.", 422, rid, {
      field_errors: { status: "Unknown status." },
    });
  }
  const rows = await prisma.accessRequest.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: status === "pending" ? "asc" : "desc" },
    take: 200,
  });
  const dtos = await accessRequestDtos(rows);
  if (status === "pending") dtos.sort((a, b) => Number(a.waitlisted) - Number(b.waitlisted));
  const counts = Object.fromEntries(
    (await prisma.accessRequest.groupBy({ by: ["status"], _count: true })).map((g) => [g.status, g._count])
  );
  return ok(
    {
      requests: dtos,
      counts: { pending: counts.pending ?? 0, invited: counts.invited ?? 0, declined: counts.declined ?? 0 },
      // HM-29: how close invite guessing is to the site-wide caps.
      abuse: { ...(await inviteAbuseCounts()), max_checks_1h: MAX_INVITE_CHECKS_PER_HOUR, max_failures_1h: MAX_INVITE_FAILURES_PER_HOUR },
    },
    rid
  );
});
