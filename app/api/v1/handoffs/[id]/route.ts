import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";
import { createHash } from "crypto";

// POST /api/v1/handoffs/[id] {action: consent|withdraw, payload_hash?, expected_version?}
// Submitted state is server-generated only after BOTH members consent.
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const h = await prisma.handoff.findUnique({
    where: { id: params.id },
    include: { household: { include: { memberships: true } }, acceptances: true },
  });
  if (!h || !h.household.memberships.some((m) => m.userId === user.id))
    return fail("NOT_FOUND", "Handoff not found.", 404, rid);
  const otherId = h.household.memberships.find((m) => m.userId !== user.id)!.userId;

  if (body.expected_version != null && body.expected_version !== h.version)
    return fail("VERSION_CONFLICT", "This handoff changed. Review and consent again.", 409, rid);

  if (action === "consent") {
    if (h.state !== "awaiting_member_consent")
      return fail("STATE_CONFLICT", "This handoff isn't awaiting consent.", 409, rid);
    if (h.acceptances.some((a) => a.userId === user.id))
      return ok({ state: h.state }, rid); // idempotent

    const payloadHash =
      body.payload_hash ??
      createHash("sha256").update(`${h.id}:${user.id}:v${h.version}`).digest("hex");

    const result = await prisma.$transaction(async (tx) => {
      await tx.handoffAcceptance.create({
        data: { handoffId: h.id, userId: user.id, payloadHash },
      });
      const accs = await tx.handoffAcceptance.count({ where: { handoffId: h.id } });
      let state = h.state;
      let decision: string | null = null;
      if (accs >= 2) {
        // Both consented → submit to partner simulator, which accepts (demo).
        state = "accepted";
        decision = "accepted";
        await tx.handoff.update({
          where: { id: h.id },
          data: { state, decision, version: h.version + 1 },
        });
        await tx.household.update({
          where: { id: h.household.id },
          data: { derivedStage: "move_in_pending" },
        });
        await notify(tx, otherId, "handoff_update", "Application accepted", "Demo application accepted; no home is reserved. Confirm your move-in when ready.");
        await notify(tx, user.id, "handoff_update", "Application accepted", "Demo application accepted; no home is reserved. Confirm your move-in when ready.");
      } else {
        await tx.handoff.update({ where: { id: h.id }, data: { version: h.version + 1 } });
        await notify(tx, otherId, "handoff_update", "Consent needed", `${user.displayName} consented. Add your consent to submit the application.`);
      }
      await writeAudit(tx, { eventType: "handoff.consent", actorId: user.id, subjectId: otherId, resourceType: "handoff", resourceId: h.id, action: "consent", safeAfter: { state } }, rid);
      await writeOutbox(tx, accs >= 2 ? "handoff_submitted" : "handoff_consent", { handoffId: h.id });
      return { state, decision };
    });
    return ok(result, rid);
  }

  if (action === "withdraw") {
    if (!["awaiting_member_consent", "submitted"].includes(h.state))
      return fail("STATE_CONFLICT", "This handoff can't be withdrawn.", 409, rid);
    await prisma.$transaction(async (tx) => {
      await tx.handoff.update({ where: { id: h.id }, data: { state: "withdrawn", version: h.version + 1 } });
      await tx.household.update({ where: { id: h.household.id }, data: { derivedStage: "planning" } });
      await writeAudit(tx, { eventType: "handoff.withdrawn", actorId: user.id, resourceType: "handoff", resourceId: h.id, action: "withdraw" }, rid);
      await writeOutbox(tx, "handoff_withdrawn", { handoffId: h.id });
      await notify(tx, otherId, "handoff_update", "Application withdrawn", "The rental application was withdrawn.");
    });
    return ok({ state: "withdrawn" }, rid);
  }

  return fail("VALIDATION", "Unknown action.", 422, rid);
});
