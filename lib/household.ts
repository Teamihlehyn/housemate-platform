import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ApiError } from "./api";
import { writeAudit, writeOutbox, notify } from "./audit";
import { monthlyEquivalentMinor } from "./money";
import { HOMES_ENABLED } from "./env";

type Tx = Prisma.TransactionClient;
type ActorType = "user" | "service";

export const NOTICE_WEEKS = [2, 4, 6, 8, 12] as const;
export const BILLS_SPLITS = ["equal", "same_as_rent"] as const;

// Latest plan version and whether every active member has accepted it.
export async function planStatus(tx: Tx, householdId: string) {
  const plan = await tx.householdPlan.findFirst({
    where: { householdId },
    orderBy: { versionNo: "desc" },
    include: { acceptances: true },
  });
  if (!plan) throw new ApiError("NOT_FOUND", "No household plan.", 404);
  const members = await tx.membership.findMany({ where: { householdId, state: "active" } });
  const acceptedBy = plan.acceptances.filter((a) => !a.revokedAt).map((a) => a.userId);
  const agreed = members.length > 0 && members.every((m) => acceptedBy.includes(m.userId));
  return { plan, members, acceptedBy, agreed };
}

// Stage from workflow progress (independent of re-agreement).
export async function progressStage(tx: Tx, householdId: string): Promise<string> {
  const handoff = await tx.handoff.findFirst({ where: { householdId }, orderBy: { createdAt: "desc" } });
  if (handoff?.state === "accepted") return "move_in_pending";
  if (handoff && ["draft", "awaiting_member_consent", "submitted"].includes(handoff.state)) return "application";
  const viewings = await tx.viewing.count({
    where: { householdId, state: { in: ["awaiting_partner", "confirmed", "completed", "disputed"] } },
  });
  return viewings > 0 ? "viewing" : "planning";
}

// No viewing or application may progress until both people accept the latest agreement.
export async function requirePlanAgreed(householdId: string) {
  const { agreed } = await planStatus(prisma, householdId);
  if (!agreed)
    throw new ApiError(
      "NEEDS_REAGREEMENT",
      "Your household agreement changed. Both of you need to accept the latest version first.",
      409
    );
}

// Accept the latest plan version. Forms the household when it was a proposal.
export async function acceptPlan(opts: {
  householdId: string;
  userId: string;
  planVersion?: number | null;
  actorType?: ActorType;
  rid?: string;
}): Promise<"formed" | "agreed" | "waiting" | "already"> {
  const { householdId, userId, planVersion, actorType = "user", rid } = opts;
  return prisma.$transaction(async (tx) => {
    const hh = await tx.household.findUnique({ where: { id: householdId }, include: { memberships: true } });
    if (!hh || !hh.memberships.some((m) => m.userId === userId && m.state === "active"))
      throw new ApiError("NOT_FOUND", "Household not found.", 404);
    if (!["proposed", "active"].includes(hh.state))
      throw new ApiError("STATE_CONFLICT", "This household is closed.", 409);

    const { plan } = await planStatus(tx, householdId);
    if (planVersion != null && planVersion !== plan.versionNo)
      throw new ApiError("VERSION_CONFLICT", "The agreement changed. Review the latest version and accept again.", 409);
    if (plan.acceptances.some((a) => a.userId === userId && !a.revokedAt)) return "already";

    const memberIds = hh.memberships.filter((m) => m.state === "active").map((m) => m.userId);
    if (hh.state === "proposed") {
      const busy = await tx.membership.findFirst({
        where: { userId: { in: memberIds }, householdId: { not: hh.id }, state: "active", household: { state: "active" } },
      });
      if (busy) throw new ApiError("STATE_CONFLICT", "One of you is already in an active household.", 409);
    }

    await tx.planAcceptance.create({ data: { planId: plan.id, userId } });
    const { agreed } = await planStatus(tx, householdId);

    let result: "formed" | "agreed" | "waiting" = "waiting";
    if (agreed && hh.state === "proposed") {
      await tx.household.update({
        where: { id: hh.id },
        data: { state: "active", formedAt: new Date(), version: hh.version + 1, derivedStage: "planning" },
      });
      await tx.search.updateMany({ where: { userId: { in: memberIds } }, data: { status: "paused" } });
      await tx.introduction.updateMany({
        where: { state: "pending", OR: [{ lowUserId: { in: memberIds } }, { highUserId: { in: memberIds } }] },
        data: { state: "expired", reasonCode: "household_formed" },
      });
      result = "formed";
    } else if (agreed) {
      await tx.household.update({
        where: { id: hh.id },
        data: { version: hh.version + 1, derivedStage: await progressStage(tx, hh.id) },
      });
      result = "agreed";
    }

    const actor = await tx.user.findUnique({ where: { id: userId } });
    await writeAudit(tx, {
      eventType: result === "formed" ? "household.formed" : "household.plan_accepted",
      actorType,
      actorId: userId,
      resourceType: "household",
      resourceId: hh.id,
      action: "accept_plan",
      safeAfter: { planVersion: plan.versionNo, result },
      versionBefore: hh.version,
    }, rid);
    await writeOutbox(tx, result === "formed" ? "household_formed" : "household_plan_accepted", {
      householdId: hh.id,
      planVersion: plan.versionNo,
    });
    for (const other of memberIds.filter((id) => id !== userId)) {
      if (result === "formed")
        await notify(tx, other, "household_formed", "Household formed", `${actor?.displayName} accepted. Your household is active — start planning together.`);
      else if (result === "agreed")
        await notify(tx, other, "household_change", "Agreement accepted", `${actor?.displayName} accepted agreement v${plan.versionNo}. You're both agreed.`);
    }
    return result;
  });
}

export interface PlanChanges {
  contributions?: Record<string, number>; // monthly minor units per member
  noticePeriodWeeks?: number;
  billsSplit?: string;
  notes?: string | null;
  stayMin?: number;
  stayMax?: number;
}

// Propose a new agreement version. Clears prior acceptances; the proposer accepts it.
export async function proposePlanChange(opts: {
  householdId: string;
  userId: string;
  expectedPlanVersion: number;
  changes: PlanChanges;
  rid?: string;
}): Promise<number> {
  const { householdId, userId, expectedPlanVersion, changes, rid } = opts;
  const fe: Record<string, string> = {};

  return prisma.$transaction(async (tx) => {
    const hh = await tx.household.findUnique({ where: { id: householdId }, include: { memberships: true } });
    if (!hh || !hh.memberships.some((m) => m.userId === userId && m.state === "active"))
      throw new ApiError("NOT_FOUND", "Household not found.", 404);
    if (!["proposed", "active"].includes(hh.state))
      throw new ApiError("STATE_CONFLICT", "This household is closed.", 409);

    const { plan } = await planStatus(tx, householdId);
    if (expectedPlanVersion !== plan.versionNo)
      throw new ApiError("VERSION_CONFLICT", "The agreement changed while you were editing. Review the latest version.", 409);

    const memberIds = hh.memberships.filter((m) => m.state === "active").map((m) => m.userId);
    const current = JSON.parse(plan.contributions) as Record<string, number>;
    let contributions = current;
    if (changes.contributions) {
      contributions = { ...current };
      for (const id of memberIds) {
        const v = changes.contributions[id];
        if (v === undefined) continue;
        if (!Number.isInteger(v) || v < 100 || v > 10_000_000_000) fe[`contribution_${id}`] = "Enter a valid monthly amount.";
        else contributions[id] = v;
      }
    }
    const notice = changes.noticePeriodWeeks ?? plan.noticePeriodWeeks;
    if (!(NOTICE_WEEKS as readonly number[]).includes(notice)) fe.noticePeriodWeeks = "Choose a notice period.";
    const bills = changes.billsSplit ?? plan.billsSplit;
    if (!(BILLS_SPLITS as readonly string[]).includes(bills)) fe.billsSplit = "Choose how bills are split.";
    const notes = changes.notes === undefined ? plan.notes : (changes.notes ?? "").trim() || null;
    if (notes && notes.length > 500) fe.notes = "Keep notes under 500 characters.";
    const stayMin = changes.stayMin ?? plan.stayMin;
    const stayMax = changes.stayMax ?? plan.stayMax;
    if (stayMin < 1 || stayMax > 36 || stayMin > stayMax) fe.stay = "Stay must be 1–36 months, minimum ≤ maximum.";
    if (Object.keys(fe).length) throw new ApiError("VALIDATION", "Please fix the highlighted fields.", 422, fe);

    const changed = [
      JSON.stringify(contributions) !== plan.contributions && "contributions",
      notice !== plan.noticePeriodWeeks && "noticePeriodWeeks",
      bills !== plan.billsSplit && "billsSplit",
      notes !== plan.notes && "notes",
      (stayMin !== plan.stayMin || stayMax !== plan.stayMax) && "stay",
    ].filter(Boolean) as string[];
    if (changed.length === 0) throw new ApiError("NO_CHANGE", "Nothing changed in the agreement.", 422);

    const next = await tx.householdPlan.create({
      data: {
        householdId,
        versionNo: plan.versionNo + 1,
        earliestDate: plan.earliestDate,
        latestDate: plan.latestDate,
        contributions: JSON.stringify(contributions),
        currency: plan.currency,
        stayMin,
        stayMax,
        noticePeriodWeeks: notice,
        billsSplit: bills,
        notes,
        // Homes are off in beta: never carry a property into a new version (ENG-01).
        propertyId: HOMES_ENABLED ? plan.propertyId : null,
        changeReason: changed.join(","),
      },
    });
    await tx.planAcceptance.create({ data: { planId: next.id, userId } });
    await tx.household.update({
      where: { id: householdId },
      data: {
        version: hh.version + 1,
        currentPlanVersion: next.versionNo,
        ...(hh.state === "active" ? { derivedStage: "needs_reagreement" } : {}),
      },
    });

    const actor = await tx.user.findUnique({ where: { id: userId } });
    await writeAudit(tx, {
      eventType: "household.plan_changed",
      actorId: userId,
      resourceType: "household",
      resourceId: householdId,
      action: "propose_plan_change",
      safeAfter: { planVersion: next.versionNo, changed },
      versionBefore: hh.version,
      versionAfter: hh.version + 1,
    }, rid);
    await writeOutbox(tx, "household_changed", { householdId, planVersion: next.versionNo, changed });
    for (const other of memberIds.filter((id) => id !== userId))
      await notify(tx, other, "household_change", "Agreement updated", `${actor?.displayName} proposed agreement v${next.versionNo}. Review and accept it.`);
    return next.versionNo;
  });
}

// All members completed → completed; all gave the same other answer → that answer;
// otherwise the reports disagree and the viewing is disputed.
export function viewingStateFromOutcomes(responses: string[]): string {
  if (responses.every((r) => r === "completed")) return "completed";
  if (responses.every((r) => r === responses[0])) return responses[0];
  return "disputed";
}

export async function recordViewingOutcome(opts: {
  viewingId: string;
  userId: string;
  response: string;
  actorType?: ActorType;
  rid?: string;
}): Promise<string> {
  const { viewingId, userId, response, actorType = "user", rid } = opts;
  return prisma.$transaction(async (tx) => {
    const v = await tx.viewing.findUnique({ where: { id: viewingId }, include: { household: { include: { memberships: true } } } });
    if (!v) throw new ApiError("NOT_FOUND", "Viewing not found.", 404);
    if (!["confirmed", "completed", "disputed"].includes(v.state))
      throw new ApiError("STATE_CONFLICT", "Only a confirmed viewing has an outcome.", 409);
    await tx.viewingOutcome.upsert({
      where: { viewingId_userId: { viewingId, userId } },
      create: { viewingId, userId, response },
      update: { response },
    });
    const members = v.household.memberships.filter((m) => m.state === "active").map((m) => m.userId);
    const outcomes = await tx.viewingOutcome.findMany({ where: { viewingId } });
    let state = v.state;
    if (members.every((id) => outcomes.some((o) => o.userId === id))) {
      state = viewingStateFromOutcomes(outcomes.map((o) => o.response));
      await tx.viewing.update({ where: { id: viewingId }, data: { state, version: v.version + 1 } });
    }
    await writeAudit(tx, { eventType: "viewing.outcome", actorType, actorId: userId, resourceType: "viewing", resourceId: viewingId, action: "outcome", safeAfter: { response, state } }, rid);
    await writeOutbox(tx, "viewing_completed", { viewingId, response });
    return state;
  });
}

export async function recordHandoffConsent(opts: {
  handoffId: string;
  userId: string;
  payloadHash: string;
  actorType?: ActorType;
  rid?: string;
}): Promise<{ state: string; decision: string | null }> {
  const { handoffId, userId, payloadHash, actorType = "user", rid } = opts;
  return prisma.$transaction(async (tx) => {
    const h = await tx.handoff.findUnique({
      where: { id: handoffId },
      include: { household: { include: { memberships: true } }, acceptances: true },
    });
    if (!h) throw new ApiError("NOT_FOUND", "Application not found.", 404);
    if (h.state !== "awaiting_member_consent")
      throw new ApiError("STATE_CONFLICT", "This application isn't awaiting consent.", 409);
    if (h.acceptances.some((a) => a.userId === userId)) return { state: h.state, decision: h.decision };

    await tx.handoffAcceptance.create({ data: { handoffId, userId, payloadHash } });
    const members = h.household.memberships.filter((m) => m.state === "active").map((m) => m.userId);
    const accs = await tx.handoffAcceptance.count({ where: { handoffId } });
    const actor = await tx.user.findUnique({ where: { id: userId } });
    let state = h.state;
    let decision: string | null = null;
    if (accs >= members.length) {
      // Everyone consented → submit to the sample letting partner, which accepts (demo).
      state = "accepted";
      decision = "accepted";
      await tx.handoff.update({ where: { id: handoffId }, data: { state, decision, version: h.version + 1 } });
      await tx.household.update({ where: { id: h.householdId }, data: { derivedStage: "move_in_pending" } });
      for (const m of members)
        await notify(tx, m, "handoff_update", "Application accepted", "Demo application accepted; no home is reserved. Confirm your move-in when ready.");
    } else {
      await tx.handoff.update({ where: { id: handoffId }, data: { version: h.version + 1 } });
      for (const m of members.filter((id) => id !== userId))
        await notify(tx, m, "handoff_update", "Consent needed", `${actor?.displayName} consented. Add your consent to submit the application.`);
    }
    await writeAudit(tx, { eventType: "handoff.consent", actorType, actorId: userId, resourceType: "handoff", resourceId: handoffId, action: "consent", safeAfter: { state } }, rid);
    await writeOutbox(tx, state === "accepted" ? "handoff_submitted" : "handoff_consent", { handoffId });
    return { state, decision };
  });
}

export async function recordMoveIn(opts: {
  householdId: string;
  userId: string;
  actualDate: string;
  response: string;
  actorType?: ActorType;
  rid?: string;
}): Promise<string> {
  const { householdId, userId, actualDate, response, actorType = "user", rid } = opts;
  return prisma.$transaction(async (tx) => {
    const hh = await tx.household.findUnique({ where: { id: householdId }, include: { memberships: true } });
    if (!hh) throw new ApiError("NOT_FOUND", "Household not found.", 404);
    await tx.moveInConfirmation.upsert({
      where: { householdId_userId: { householdId, userId } },
      create: { householdId, userId, actualDate, response, source: "self_report_demo" },
      update: { response, actualDate },
    });
    const members = hh.memberships.filter((m) => m.state === "active").map((m) => m.userId);
    const confs = await tx.moveInConfirmation.findMany({ where: { householdId } });
    const actor = await tx.user.findUnique({ where: { id: userId } });
    let state = hh.state;
    if (members.every((id) => confs.find((c) => c.userId === id)?.response === "moved_in")) {
      state = "completed";
      await tx.household.update({ where: { id: householdId }, data: { state, closedAt: new Date(), version: hh.version + 1 } });
      for (const m of members) await notify(tx, m, "move_in", "Move-in confirmed", "You've both confirmed your move-in. 🎉");
    } else {
      for (const m of members.filter((id) => id !== userId))
        await notify(tx, m, "move_in", "Move-in update", `${actor?.displayName} recorded their move-in status.`);
    }
    await writeAudit(tx, { eventType: "move_in.confirmed", actorType, actorId: userId, resourceType: "household", resourceId: householdId, action: "move_in_confirm", safeAfter: { response } }, rid);
    await writeOutbox(tx, "move_in_confirmed", { householdId, response });
    return state;
  });
}

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
    include: { profile: true, search: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  const activeIds = hh.memberships.filter((m) => m.state === "active").map((m) => m.userId);

  const currentPlan = hh.plans[0];
  // Beta has no homes: don't look up or expose any property (ENG-01).
  const propertyIds = !HOMES_ENABLED ? [] : [
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
  const acceptedBy = currentPlan ? currentPlan.acceptances.filter((a) => !a.revokedAt).map((a) => a.userId) : [];

  return {
    id: hh.id,
    state: hh.state,
    derivedStage: hh.derivedStage,
    version: hh.version,
    members: hh.memberships.map((m) => {
      const u = userMap.get(m.userId);
      const s = u?.search;
      return {
        userId: m.userId,
        state: m.state,
        name: u?.displayName ?? "User",
        initials: u?.profile?.avatarInitials ?? "?",
        isSample: !!u?.isDemoBot,
        // Each member's saved rent band as a monthly equivalent, to flag splits outside it.
        rentBand:
          s?.rentMinMinor != null && s?.rentMaxMinor != null && s.rentPeriod
            ? {
                minMonthly: monthlyEquivalentMinor(s.rentMinMinor, s.rentPeriod),
                maxMonthly: monthlyEquivalentMinor(s.rentMaxMinor, s.rentPeriod),
              }
            : null,
      };
    }),
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
          noticePeriodWeeks: currentPlan.noticePeriodWeeks,
          billsSplit: currentPlan.billsSplit,
          notes: currentPlan.notes,
          propertyId: HOMES_ENABLED ? currentPlan.propertyId : null,
          acceptedBy,
          agreed: activeIds.length > 0 && activeIds.every((id) => acceptedBy.includes(id)),
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
      bothInterested: activeIds.every((id) => s.votes.find((v) => v.userId === id)?.decision === "interested"),
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
    moveIns: hh.moveIns.map((m) => ({ userId: m.userId, actualDate: m.actualDate, response: m.response })),
  };
}
