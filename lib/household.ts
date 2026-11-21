import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ApiError } from "./api";
import { writeAudit, writeOutbox, notify } from "./audit";
import { monthlyEquivalentMinor } from "./money";
import { HOMES_ENABLED } from "./env";
import { lockKey } from "./rateLimit";

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
// ---- Proposals (D-R2: ENG-52, SEC-17) ----------------------------------------------------------

// HM-49: proposals, formation, withdraw and decline for the same person run one at a time. Take
// the per-person locks (sorted, the same keys POST /households uses) for every member, then the
// caller re-reads the household inside the transaction.
async function lockHouseholdMembers(tx: Tx, householdId: string): Promise<void> {
  const ms = await tx.membership.findMany({ where: { householdId }, select: { userId: true } });
  for (const id of [...new Set(ms.map((m) => m.userId))].sort()) await lockKey(tx, `household-proposals:${id}`);
}
export const MAX_OUTGOING_PROPOSALS = 3;
type Db = Tx | typeof prisma;

async function nameOf(db: Db, id: string): Promise<string> {
  return (await db.user.findUnique({ where: { id }, select: { displayName: true } }))?.displayName || "This user";
}

// Why `meId` can't propose a household to `otherId` right now, or null. Every message is about
// the proposer's own state, except "{name} isn't available", which never says why.
export async function proposalBlocker(
  meId: string,
  otherId: string,
  db: Db = prisma
): Promise<{ code: "own_active" | "other_unavailable" | "own_pending_same" | "incoming_pending" | "own_pending_limit"; message: string } | null> {
  const activeOf = (id: string) =>
    db.membership.findFirst({ where: { userId: id, state: "active", household: { state: "active" } }, select: { householdId: true } });
  const mine = await activeOf(meId);
  if (mine) {
    const mate = await db.membership.findFirst({ where: { householdId: mine.householdId, userId: { not: meId }, state: "active" }, select: { userId: true } });
    return {
      code: "own_active",
      message: `You're already in a household${mate ? ` with ${await nameOf(db, mate.userId)}` : ""}. Leave it to propose a new one.`,
    };
  }
  if (await activeOf(otherId)) {
    return { code: "other_unavailable", message: `${await nameOf(db, otherId)} isn't available for a household right now.` };
  }
  const pair = await db.household.findFirst({
    where: {
      state: "proposed",
      AND: [
        { memberships: { some: { userId: meId, state: "active" } } },
        { memberships: { some: { userId: otherId, state: "active" } } },
      ],
    },
    select: { proposedBy: true },
  });
  if (pair) {
    const name = await nameOf(db, otherId);
    return pair.proposedBy === otherId
      ? { code: "incoming_pending", message: `${name} has already proposed a household to you. Accept or decline it on your Household page.` }
      : { code: "own_pending_same", message: `You've already proposed a household to ${name}. Wait for their answer, or withdraw it.` };
  }
  const outgoing = await db.household.count({ where: { state: "proposed", proposedBy: meId } });
  if (outgoing >= MAX_OUTGOING_PROPOSALS) {
    return { code: "own_pending_limit", message: `You've got ${MAX_OUTGOING_PROPOSALS} pending proposals. Withdraw one to propose to someone else.` };
  }
  return null;
}

// On formation: close the other pending proposals of both people, neutrally.
async function closeOtherProposals(tx: Tx, formedId: string, memberIds: string[], rid?: string) {
  const others = await tx.household.findMany({
    where: { id: { not: formedId }, state: "proposed", memberships: { some: { userId: { in: memberIds }, state: "active" } } },
    include: { memberships: true },
  });
  for (const o of others) {
    const closed = await tx.household.updateMany({ where: { id: o.id, state: "proposed" }, data: { state: "closed", closedAt: new Date(), version: o.version + 1 } });
    if (closed.count !== 1) continue;
    await writeAudit(tx, {
      eventType: "household.closed",
      actorType: "service",
      resourceType: "household",
      resourceId: o.id,
      action: "auto_close",
      reasonCode: "formed_elsewhere",
      versionBefore: o.version,
      versionAfter: o.version + 1,
    }, rid);
    await writeOutbox(tx, "household_closed", { householdId: o.id });
    const unavailable = o.memberships.find((m) => memberIds.includes(m.userId))?.userId;
    const name = unavailable ? await nameOf(tx, unavailable) : "This user";
    for (const m of o.memberships) {
      if (memberIds.includes(m.userId)) continue;
      await notify(tx, m.userId, "household_closed", "Proposal closed", `This proposal is closed. ${name} isn't available for a household right now.`, { type: "household", id: o.id });
    }
  }
}

// Withdraw (the proposer) or decline (the other person) a pending proposal.
export async function closeProposal(opts: { householdId: string; userId: string; action: "withdraw" | "decline"; rid?: string }) {
  const { householdId, userId, action, rid } = opts;
  return prisma.$transaction(async (tx) => {
    await lockHouseholdMembers(tx, householdId);
    const hh = await tx.household.findUnique({ where: { id: householdId }, include: { memberships: true } });
    if (!hh || !hh.memberships.some((m) => m.userId === userId && m.state === "active")) throw new ApiError("NOT_FOUND", "Household not found.", 404);
    if (hh.state !== "proposed") throw new ApiError("STATE_CONFLICT", "This proposal isn't pending any more.", 409);
    const proposer = hh.proposedBy;
    if (action === "withdraw" && proposer !== userId) throw new ApiError("STATE_CONFLICT", "Only the person who proposed can withdraw. You can decline it.", 409);
    if (action === "decline" && proposer === userId) throw new ApiError("STATE_CONFLICT", "You proposed this one. You can withdraw it.", 409);
    const moved = await tx.household.updateMany({
      where: { id: hh.id, state: "proposed", version: hh.version },
      data: { state: action === "decline" ? "declined" : "closed", closedAt: new Date(), version: hh.version + 1 },
    });
    if (moved.count !== 1) throw new ApiError("STATE_CONFLICT", "This proposal isn't pending any more.", 409);
    const otherId = hh.memberships.find((m) => m.userId !== userId)?.userId;
    await writeAudit(tx, {
      eventType: action === "decline" ? "household.declined" : "household.withdrawn",
      actorId: userId,
      subjectId: otherId ?? null,
      resourceType: "household",
      resourceId: hh.id,
      action,
      versionBefore: hh.version,
      versionAfter: hh.version + 1,
    }, rid);
    await writeOutbox(tx, "household_closed", { householdId: hh.id, reason: action });
    if (otherId) {
      const me = await nameOf(tx, userId);
      await notify(
        tx,
        otherId,
        "household_closed",
        action === "decline" ? "Proposal declined" : "Proposal withdrawn",
        action === "decline" ? `${me} declined your household proposal.` : `${me} withdrew their household proposal.`,
        { type: "household", id: hh.id }
      );
    }
    return { state: action === "decline" ? "declined" : "closed" };
  });
}

// Your own pending proposals (sent and received), for the Household page. Nothing about anyone
// else's pairings.
export async function myProposals(userId: string) {
  const rows = await prisma.household.findMany({
    where: { state: "proposed", memberships: { some: { userId, state: "active" } } },
    include: { memberships: true },
    orderBy: { createdAt: "desc" },
  });
  const otherIds = rows.map((r) => r.memberships.find((m) => m.userId !== userId)?.userId).filter(Boolean) as string[];
  const users = await prisma.user.findMany({ where: { id: { in: otherIds } }, select: { id: true, displayName: true } });
  const names = new Map(users.map((u) => [u.id, u.displayName]));
  return rows.map((r) => {
    const other = r.memberships.find((m) => m.userId !== userId)?.userId ?? null;
    const sent = r.proposedBy === userId;
    return {
      id: r.id,
      version: r.version,
      direction: sent ? "sent" : "received",
      other_user_id: other,
      other_name: other ? names.get(other) ?? "User" : "User",
      created_at: r.createdAt,
      can_withdraw: sent,
      can_decline: !sent,
      can_accept: !sent,
    };
  });
}

export async function acceptPlan(opts: {
  householdId: string;
  userId: string;
  planVersion?: number | null;
  actorType?: ActorType;
  rid?: string;
}): Promise<"formed" | "agreed" | "waiting" | "already"> {
  const { householdId, userId, planVersion, actorType = "user", rid } = opts;
  return prisma.$transaction(async (tx) => {
    // HM-49: serialise per person before deciding anything, then re-read.
    await lockHouseholdMembers(tx, householdId);
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
      if (busy) {
        const otherMember = memberIds.find((id) => id !== userId);
        const who = otherMember ? (await tx.user.findUnique({ where: { id: otherMember }, select: { displayName: true } }))?.displayName : null;
        throw new ApiError(
          "STATE_CONFLICT",
          busy.userId === userId
            ? "You're already in a household. Leave it to form a new one."
            : `This proposal is closed. ${who ?? "They"} isn't available for a household right now.`,
          409
        );
      }
    }

    await tx.planAcceptance.create({ data: { planId: plan.id, userId } });
    const { agreed } = await planStatus(tx, householdId);

    let result: "formed" | "agreed" | "waiting" = "waiting";
    if (agreed && hh.state === "proposed") {
      const formed = await tx.household.updateMany({
        where: { id: hh.id, state: "proposed", version: hh.version },
        data: { state: "active", formedAt: new Date(), version: hh.version + 1, derivedStage: "planning" },
      });
      if (formed.count !== 1) throw new ApiError("STATE_CONFLICT", "This proposal isn't pending any more.", 409);
      await tx.search.updateMany({ where: { userId: { in: memberIds } }, data: { status: "paused" } });
      await tx.introduction.updateMany({
        where: { state: "pending", OR: [{ lowUserId: { in: memberIds } }, { highUserId: { in: memberIds } }] },
        data: { state: "expired", reasonCode: "household_formed" },
      });
      // D-R2: forming is the exclusivity point. Every other pending proposal involving either
      // person closes, and the other party gets a neutral notice (no reason, no names but the
      // person they proposed with).
      await closeOtherProposals(tx, hh.id, memberIds, rid);
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
        await notify(tx, other, "household_formed", "Household formed", `${actor?.displayName} accepted. Your household is active — start planning together.`, { type: "household", id: hh.id });
      else if (result === "agreed")
        await notify(tx, other, "household_change", "Agreement accepted", `${actor?.displayName} accepted agreement v${plan.versionNo}. You're both agreed.`, { type: "household", id: hh.id });
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
      await notify(tx, other, "household_change", "Agreement updated", `${actor?.displayName} proposed agreement v${next.versionNo}. Review and accept it.`, { type: "household", id: householdId });
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
        await notify(tx, m, "handoff_update", "Application accepted", "Demo application accepted; no home is reserved. Confirm your move-in when ready.", { type: "household", id: h.householdId });
    } else {
      await tx.handoff.update({ where: { id: handoffId }, data: { version: h.version + 1 } });
      for (const m of members.filter((id) => id !== userId))
        await notify(tx, m, "handoff_update", "Consent needed", `${actor?.displayName} consented. Add your consent to submit the application.`, { type: "household", id: h.householdId });
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
      for (const m of members) await notify(tx, m, "move_in", "Move-in confirmed", "You've both confirmed your move-in. 🎉", { type: "household", id: householdId });
    } else {
      for (const m of members.filter((id) => id !== userId))
        await notify(tx, m, "move_in", "Move-in update", `${actor?.displayName} recorded their move-in status.`, { type: "household", id: householdId });
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
    // D-R2: who proposed it, and what you can do while it's pending.
    proposed_by: hh.proposedBy,
    proposal:
      hh.state === "proposed"
        ? { direction: hh.proposedBy === userId ? "sent" : "received", can_withdraw: hh.proposedBy === userId, can_decline: hh.proposedBy !== userId }
        : null,
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
