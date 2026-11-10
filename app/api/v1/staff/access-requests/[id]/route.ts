import { NextRequest } from "next/server";
import { handler, ok, fail, ApiError } from "@/lib/api";
import { requireStaff } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { lockKey } from "@/lib/rateLimit";
import { accessRequestDto, createInvite, emailInvite, inviteUrl } from "@/lib/staffInvites";

// POST /api/v1/staff/access-requests/[id] {action: "invite" | "decline" | "resend", reason?}
// - invite: pending or declined → invited; creates a 14-day invite bound to the request's
//   email and emails the link. Response includes invite_url so staff can share it another
//   way if the email fails.
// - resend: invited (not yet used) → a fresh invite; any earlier unused invite stops working.
// - decline: pending or invited (not yet used) → declined, with an optional reason (≤ 300);
//   any unused invite stops working. Nothing is emailed.
// 404 for an unknown id; 409 STATE_CONFLICT when the request isn't in a state for the action
// or the address already has an account.
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const staff = await requireStaff();
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  if (!["invite", "decline", "resend"].includes(action)) {
    return fail("VALIDATION", "Action must be invite, decline or resend.", 422, rid, { field_errors: { action: "Unknown action." } });
  }
  const reason = body.reason == null ? null : String(body.reason).trim().slice(0, 300) || null;

  const result = await prisma.$transaction(async (tx) => {
    await lockKey(tx, `access-request:${params.id}`);
    const r = await tx.accessRequest.findUnique({ where: { id: params.id } });
    if (!r) throw new ApiError("NOT_FOUND", "This request doesn't exist.", 404);
    const allowed = action === "invite" ? ["pending", "declined"] : action === "resend" ? ["invited"] : ["pending", "invited"];
    if (!allowed.includes(r.status)) {
      throw new ApiError("STATE_CONFLICT", `This request is ${r.status}, so it can't be ${action === "resend" ? "resent" : action + "d"}.`, 409);
    }
    if (await tx.user.findUnique({ where: { email: r.email }, select: { id: true } })) {
      throw new ApiError("STATE_CONFLICT", "This person already has an account.", 409);
    }
    // Any earlier unused invite for this request stops working.
    await tx.invite.updateMany({
      where: { accessRequestId: r.id, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const before = r.status;
    let invite: { id: string; code: string; expiresAt: Date } | null = null;
    if (action === "decline") {
      await tx.accessRequest.update({
        where: { id: r.id },
        data: { status: "declined", reviewedBy: staff.id, reviewedAt: new Date(), declineReason: reason },
      });
    } else {
      invite = await createInvite(tx, { email: r.email, accessRequestId: r.id, createdBy: staff.id });
      await tx.accessRequest.update({
        where: { id: r.id },
        data: { status: "invited", reviewedBy: staff.id, reviewedAt: new Date(), declineReason: null },
      });
    }
    await writeAudit(tx, {
      eventType: action === "decline" ? "access.declined" : action === "resend" ? "access.invite_resent" : "access.invited",
      actorType: "staff",
      actorId: staff.id,
      resourceType: "access_request",
      resourceId: r.id,
      action,
      safeBefore: { status: before },
      safeAfter: { status: action === "decline" ? "declined" : "invited", city: r.city },
    }, rid);
    return { request: r, invite };
  });

  let email_status: string = "not_requested";
  if (result.invite) {
    email_status = await emailInvite(
      { inviteId: result.invite.id, staffId: staff.id, to: result.request.email, name: result.request.name, code: result.invite.code },
      rid
    );
  }
  return ok(
    {
      request: await accessRequestDto(result.request.id),
      ...(result.invite
        ? { invite_url: inviteUrl(result.invite.code), invite_code: result.invite.code, expires_at: result.invite.expiresAt }
        : {}),
      email_status,
    },
    rid
  );
});
