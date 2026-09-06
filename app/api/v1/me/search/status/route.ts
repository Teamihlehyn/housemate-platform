import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox } from "@/lib/audit";

// POST /api/v1/me/search/status {action: pause|resume}
export const POST = handler(async (req: NextRequest, { rid }) => {
  const user = await requireUser();
  const { action } = await req.json().catch(() => ({}));
  const search = await prisma.search.findUnique({ where: { userId: user.id } });
  if (!search) return fail("NOT_FOUND", "No search.", 404, rid);

  if (action === "pause" && search.status !== "active")
    return fail("STATE_CONFLICT", "Only an active search can be paused.", 409, rid);
  if (action === "resume" && search.status !== "paused")
    return fail("STATE_CONFLICT", "Only a paused search can be resumed.", 409, rid);
  if (!["pause", "resume"].includes(action))
    return fail("VALIDATION", "Unknown action.", 422, rid);

  const busy = await prisma.membership.findFirst({
    where: { userId: user.id, state: "active", household: { state: { in: ["proposed", "active"] } } },
  });
  if (action === "resume" && busy)
    return fail("STATE_CONFLICT", "Leave your household before resuming search.", 409, rid);

  const status = action === "pause" ? "paused" : "active";
  await prisma.$transaction(async (tx) => {
    await tx.search.update({ where: { userId: user.id }, data: { status } });
    await writeAudit(tx, { eventType: "search.status", actorId: user.id, resourceType: "search", resourceId: search.id, action, safeAfter: { status } }, rid);
    await writeOutbox(tx, "search_paused", { userId: user.id, status });
  });
  return ok({ status }, rid);
});
