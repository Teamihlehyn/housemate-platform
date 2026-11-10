import { prisma } from "./db";
import { ApiError } from "./api";
import { writeAudit } from "./audit";
import { createInvite, inviteState, inviteUrl } from "./invites";
import { emailConfigured, sendEmail } from "./email";
import { inviteEmail } from "./emails";
import { isCityOpen } from "./env";

export type EmailStatus = "sent" | "not_configured" | "failed" | "not_requested";

// Email an invite. Never throws: the invite already exists, and staff can copy the link
// or press Resend. The outcome is audited without the address.
export async function emailInvite(
  opts: { inviteId: string; staffId: string; to: string; name: string | null; code: string },
  rid: string
): Promise<EmailStatus> {
  let status: EmailStatus;
  if (!emailConfigured()) status = "not_configured";
  else {
    try {
      const msg = inviteEmail({ invite_url: inviteUrl(opts.code), code: opts.code });
      await sendEmail({ to: opts.to, ...msg, what: "the invite" });
      status = "sent";
    } catch {
      status = "failed";
    }
  }
  await prisma.$transaction((tx) =>
    writeAudit(tx, {
      eventType: "invite.emailed",
      actorType: "staff",
      actorId: opts.staffId,
      resourceType: "invite",
      resourceId: opts.inviteId,
      action: "email",
      outcome: status === "sent" ? "allowed" : "failed",
      reasonCode: status,
    }, rid)
  );
  return status;
}

// Staff view of a request: everything the person typed (staff need it to decide), plus
// whether their city is open and the state of the latest invite. Never the code.
export async function accessRequestDto(id: string) {
  const r = await prisma.accessRequest.findUnique({ where: { id } });
  if (!r) throw new ApiError("NOT_FOUND", "This request doesn't exist.", 404);
  return (await accessRequestDtos([r]))[0];
}

type Row = Awaited<ReturnType<typeof prisma.accessRequest.findMany>>[number];

export async function accessRequestDtos(rows: Row[]) {
  const ids = rows.map((r) => r.id);
  const [invites, reviewers, accounts] = await Promise.all([
    prisma.invite.findMany({ where: { accessRequestId: { in: ids } }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.reviewedBy).filter(Boolean) as string[])] } },
      select: { id: true, displayName: true },
    }),
    prisma.user.findMany({ where: { email: { in: rows.map((r) => r.email) } }, select: { email: true } }),
  ]);
  const latest = new Map<string, (typeof invites)[number]>();
  for (const i of invites) if (i.accessRequestId && !latest.has(i.accessRequestId)) latest.set(i.accessRequestId, i);
  const names = new Map(reviewers.map((u) => [u.id, u.displayName]));
  const hasAccount = new Set(accounts.map((a) => a.email));
  const now = new Date();
  return rows.map((r) => {
    const inv = latest.get(r.id);
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      city: r.city,
      area: r.area,
      moveInMonth: r.moveInMonth,
      howHeard: r.howHeard,
      note: r.note,
      status: r.status,
      waitlisted: !isCityOpen(r.city),
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      reviewedBy: r.reviewedBy ? names.get(r.reviewedBy) ?? "Staff" : null,
      declineReason: r.declineReason,
      hasAccount: hasAccount.has(r.email),
      invite: inv
        ? { id: inv.id, expiresAt: inv.expiresAt, usedAt: inv.usedAt, state: inviteState(inv, now) }
        : null,
    };
  });
}

export { createInvite, inviteUrl };

// Invite-guessing pressure in the last hour (HM-29), shown to staff next to the queue.
export async function inviteAbuseCounts() {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [checks, failures] = await Promise.all([
    prisma.auditEvent.count({ where: { eventType: "invite.checked", occurredAt: { gt: since } } }),
    prisma.auditEvent.count({ where: { eventType: "auth.code_requested", action: "invite_invalid", occurredAt: { gt: since } } }),
  ]);
  return { invite_checks_1h: checks, invite_failures_1h: failures };
}
