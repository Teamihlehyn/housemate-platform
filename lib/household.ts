import { prisma } from "./db";

// Build the full workspace view for a household, scoped to a member.
export async function buildHouseholdView(householdId: string, userId: string) {
  const hh = await prisma.household.findUnique({
    where: { id: householdId },
    include: {
      memberships: true,
      plans: { orderBy: { versionNo: "desc" }, include: { acceptances: true } },
      shortlist: { where: { state: "active" }, include: { votes: true } },
      viewings: { orderBy: { createdAt: "desc" }, include: { outcomes: true } },
      handoffs: { orderBy: { createdAt: "desc" }, include: { acceptances: true } },
      moveIns: true,
    },
  });
  if (!hh) return null;
  if (!hh.memberships.some((m) => m.userId === userId)) return null;

  const memberIds = hh.memberships.map((m) => m.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    include: { profile: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const currentPlan = hh.plans[0];
  const propertyIds = [
    ...new Set(
      [
        ...hh.shortlist.map((s) => s.propertyId),
        currentPlan?.propertyId,
        ...hh.handoffs.map((h) => h.propertyId),
      ].filter(Boolean) as string[]
    ),
  ];
  const properties = await prisma.property.findMany({ where: { id: { in: propertyIds } } });
  const propMap = new Map(properties.map((p) => [p.id, p]));

  const currentHandoff = hh.handoffs[0] ?? null;

  return {
    id: hh.id,
    state: hh.state,
    derivedStage: hh.derivedStage,
    version: hh.version,
    members: hh.memberships.map((m) => ({
      userId: m.userId,
      state: m.state,
      name: userMap.get(m.userId)?.displayName ?? "Member",
      initials: userMap.get(m.userId)?.profile?.avatarInitials ?? "?",
    })),
    currentPlan: currentPlan
      ? {
          id: currentPlan.id,
          versionNo: currentPlan.versionNo,
          earliestDate: currentPlan.earliestDate,
          latestDate: currentPlan.latestDate,
          contributions: JSON.parse(currentPlan.contributions) as Record<string, number>,
          currency: currentPlan.currency,
          stayMin: currentPlan.stayMin,
          stayMax: currentPlan.stayMax,
          propertyId: currentPlan.propertyId,
          acceptedBy: currentPlan.acceptances.filter((a) => !a.revokedAt).map((a) => a.userId),
        }
      : null,
    shortlist: hh.shortlist.map((s) => ({
      id: s.id,
      title: s.title,
      propertyId: s.propertyId,
      url: s.url,
      area: s.area,
      priceNote: s.priceNote,
      property: s.propertyId ? propMap.get(s.propertyId) ?? null : null,
      votes: s.votes.map((v) => ({ userId: v.userId, decision: v.decision })),
      bothInterested:
        memberIds.every((id) => s.votes.find((v) => v.userId === id)?.decision === "interested"),
    })),
    viewings: hh.viewings.map((v) => ({
      id: v.id,
      shortlistItemId: v.shortlistItemId,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      timezone: v.timezone,
      state: v.state,
      proposedBy: v.proposedBy,
      version: v.version,
      outcomes: v.outcomes.map((o) => ({ userId: o.userId, response: o.response })),
    })),
    handoff: currentHandoff
      ? {
          id: currentHandoff.id,
          state: currentHandoff.state,
          version: currentHandoff.version,
          partnerId: currentHandoff.partnerId,
          decision: currentHandoff.decision,
          propertyId: currentHandoff.propertyId,
          acceptedBy: currentHandoff.acceptances.map((a) => a.userId),
        }
      : null,
    moveIns: hh.moveIns.map((m) => ({
      userId: m.userId,
      actualDate: m.actualDate,
      response: m.response,
    })),
    propertyMap: Object.fromEntries(propMap),
  };
}

// Derive the household stage from workflow progress.
export function deriveStage(view: NonNullable<Awaited<ReturnType<typeof buildHouseholdView>>>): string {
  if (view.state === "completed") return "move_in_pending";
  if (view.handoff?.state === "accepted") return "move_in_pending";
  if (view.handoff && ["submitted", "awaiting_member_consent", "draft"].includes(view.handoff.state))
    return "application";
  if (view.viewings.some((v) => ["confirmed", "completed"].includes(v.state))) return "viewing";
  return "planning";
}
