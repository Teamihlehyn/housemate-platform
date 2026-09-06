import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";

// POST /api/v1/households/[id]/viewings {shortlist_item_id, starts_at, timezone}
// Requires an active household + both members "interested" + fresh stock.
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const hh = await prisma.household.findUnique({
    where: { id: params.id },
    include: { memberships: true },
  });
  if (!hh || !hh.memberships.some((m) => m.userId === user.id))
    return fail("NOT_FOUND", "Household not found.", 404, rid);
  if (hh.state !== "active")
    return fail("STATE_CONFLICT", "Household must be active.", 409, rid);

  const item = await prisma.shortlistItem.findUnique({
    where: { id: body.shortlist_item_id },
    include: { votes: true },
  });
  if (!item || item.householdId !== hh.id)
    return fail("NOT_FOUND", "Shortlist item not found.", 404, rid);

  const memberIds = hh.memberships.map((m) => m.userId);
  const bothInterested = memberIds.every(
    (id) => item.votes.find((v) => v.userId === id)?.decision === "interested"
  );
  if (!bothInterested)
    return fail("STATE_CONFLICT", "Both members must be interested before booking a viewing.", 409, rid);

  if (item.propertyId) {
    const prop = await prisma.property.findUnique({ where: { id: item.propertyId } });
    if (!prop || prop.state !== "available")
      return fail("STATE_CONFLICT", "That property is no longer available.", 409, rid);
  }

  const startsAt = new Date(body.starts_at);
  if (isNaN(startsAt.getTime()) || startsAt < new Date())
    return fail("VALIDATION", "Choose a valid future time slot.", 422, rid);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
  const timezone = body.timezone ?? "Europe/London";
  const otherId = memberIds.find((id) => id !== user.id)!;

  const viewing = await prisma.$transaction(async (tx) => {
    const v = await tx.viewing.create({
      data: {
        householdId: hh.id,
        shortlistItemId: item.id,
        proposedBy: user.id,
        startsAt,
        endsAt,
        timezone,
        state: "awaiting_partner",
      },
    });
    await tx.household.update({ where: { id: hh.id }, data: { derivedStage: "viewing" } });
    await writeAudit(tx, { eventType: "viewing.requested", actorId: user.id, subjectId: otherId, resourceType: "viewing", resourceId: v.id, action: "propose" }, rid);
    await writeOutbox(tx, "viewing_requested", { viewingId: v.id });
    await notify(tx, otherId, "viewing_change", "Viewing proposed", `${user.displayName} proposed a viewing time.`);
    return v;
  });

  return ok({ id: viewing.id, state: viewing.state }, rid);
});
