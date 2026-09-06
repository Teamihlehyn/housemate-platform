import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";

// POST /api/v1/households {introduction_id, plan:{earliestDate,latestDate,contributions,stayMin,stayMax,propertyId?}}
// Creates a proposal; creator's submit counts as their acceptance.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const introId = body.introduction_id;
  const plan = body.plan ?? {};

  const intro = await prisma.introduction.findUnique({
    where: { id: introId },
    include: { conversation: true },
  });
  if (!intro || (intro.lowUserId !== user.id && intro.highUserId !== user.id) || intro.state !== "accepted")
    return fail("NOT_FOUND", "No accepted introduction found.", 404, rid);

  const otherId = intro.lowUserId === user.id ? intro.highUserId : intro.lowUserId;

  // One active/proposed household per user.
  const busy = await prisma.membership.findFirst({
    where: {
      userId: { in: [user.id, otherId] },
      state: "active",
      household: { state: { in: ["proposed", "active"] } },
    },
  });
  if (busy)
    return fail("STATE_CONFLICT", "One of you already has an active household.", 409, rid);

  const [meSearch, otherSearch] = await Promise.all([
    prisma.search.findUnique({ where: { userId: user.id } }),
    prisma.search.findUnique({ where: { userId: otherId } }),
  ]);
  if (!meSearch || !otherSearch) return fail("VALIDATION", "Both searches required.", 422, rid);

  const earliestDate = plan.earliestDate ?? meSearch.earliestDate;
  const latestDate = plan.latestDate ?? meSearch.latestDate;
  if (!earliestDate || !latestDate)
    return fail("VALIDATION", "A shared move-in window is required.", 422, rid);

  // Default contributions = each user's rent maximum (editable within band client-side).
  const contributions =
    plan.contributions ?? {
      [user.id]: meSearch.rentMaxMinor,
      [otherId]: otherSearch.rentMaxMinor,
    };

  const result = await prisma.$transaction(async (tx) => {
    const hh = await tx.household.create({
      data: {
        state: "proposed",
        introductionId: intro.id,
        memberships: {
          create: [{ userId: user.id }, { userId: otherId }],
        },
      },
    });
    const p = await tx.householdPlan.create({
      data: {
        householdId: hh.id,
        versionNo: 1,
        earliestDate,
        latestDate,
        contributions: JSON.stringify(contributions),
        currency: meSearch.currency ?? "GBP",
        stayMin: plan.stayMin ?? meSearch.stayMinMonths ?? 6,
        stayMax: plan.stayMax ?? meSearch.stayMaxMonths ?? 12,
        propertyId: plan.propertyId ?? null,
      },
    });
    // Creator's submit = their acceptance.
    await tx.planAcceptance.create({ data: { planId: p.id, userId: user.id } });

    await writeAudit(tx, { eventType: "household.proposed", actorId: user.id, subjectId: otherId, resourceType: "household", resourceId: hh.id, action: "propose" }, rid);
    await writeOutbox(tx, "household_proposed", { householdId: hh.id });
    await notify(tx, otherId, "household_proposed", "Household proposal", `${user.displayName} proposed forming a household.`);
    return { householdId: hh.id, planVersion: p.versionNo };
  });

  return ok({ id: result.householdId, state: "proposed", planVersion: result.planVersion }, rid);
});
