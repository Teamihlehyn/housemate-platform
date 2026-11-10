import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { validEmail } from "@/lib/accessRequests";
import { inviteState, maskEmail } from "@/lib/invites";
import { createInvite, emailInvite, inviteUrl } from "@/lib/staffInvites";

// Ad-hoc invites are admin only (HM-31); everyone else gets 404.

// GET /api/v1/staff/invites → {invites: [{id, bound, email_hint, createdAt, expiresAt, state}]}
// The 100 most recent ad-hoc invites (not those made from access requests), for revoking.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  await requireAdmin();
  const rows = await prisma.invite.findMany({ where: { accessRequestId: null }, orderBy: { createdAt: "desc" }, take: 100 });
  const now = new Date();
  return ok(
    {
      invites: rows.map((i) => ({
        id: i.id,
        bound: !!i.email,
        email_hint: i.email ? maskEmail(i.email) : null,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        state: inviteState(i, now),
      })),
    },
    rid
  );
});

// POST /api/v1/staff/invites {email?, name?}
// With an email: bound to that address, emailed, 14 days. Without: a single-use code anyone
// can redeem (hand it over in person), 72 hours (HM-29). 409 when the address already has
// an account.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const staff = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const raw = body.email == null ? "" : String(body.email).trim().toLowerCase();
  if (raw && !validEmail(raw)) {
    return fail("VALIDATION", "Enter a valid email address, or leave it empty for a code anyone can use once.", 422, rid, {
      field_errors: { email: "Enter a valid email address." },
    });
  }
  const email = raw || null;
  const name = body.name ? String(body.name).trim().slice(0, 80) || null : null;
  if (email && (await prisma.user.findUnique({ where: { email }, select: { id: true } }))) {
    return fail("STATE_CONFLICT", "This person already has an account.", 409, rid);
  }
  const invite = await prisma.$transaction(async (tx) => {
    const inv = await createInvite(tx, { email, accessRequestId: null, createdBy: staff.id });
    await writeAudit(tx, {
      eventType: "invite.created",
      actorType: "staff",
      actorId: staff.id,
      resourceType: "invite",
      resourceId: inv.id,
      action: "create",
      safeAfter: { bound: !!email },
    }, rid);
    return inv;
  });
  const email_status = email
    ? await emailInvite({ inviteId: invite.id, staffId: staff.id, to: email, name, code: invite.code }, rid)
    : "not_requested";
  return ok(
    { id: invite.id, invite_url: inviteUrl(invite.code), invite_code: invite.code, expires_at: invite.expiresAt, bound: !!email, email_status },
    rid
  );
});
