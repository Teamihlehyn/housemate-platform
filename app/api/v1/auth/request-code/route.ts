import { NextRequest } from "next/server";
import { randomInt } from "crypto";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { sendLoginCode } from "@/lib/email";
import { adminEmails } from "@/lib/guard";
import { DEMO_MODE, INVITE_ONLY, IS_BETA, IS_RESEARCH, SIGNUPS_PAUSED } from "@/lib/env";
import { BUSY_MESSAGE, NewAccountGate, clientIp, decideCodeRequest, generateLoginCode, hashIp } from "@/lib/auth";
import { MAX_INVITE_FAILURES_PER_HOUR, findInvite, inviteUsable } from "@/lib/invites";
import { validEmail } from "@/lib/accessRequests";
import { lockKey } from "@/lib/rateLimit";
import { writeAudit } from "@/lib/audit";

const HOUR = 60 * 60 * 1000;
let warnedNoSalt = false;

const jitter = () => new Promise((r) => setTimeout(r, 150 + randomInt(350)));

// POST /api/v1/auth/request-code {email, invite_code?}
// Where on-screen codes are allowed, the code comes back in `sink_code`; otherwise it is emailed.
//
// Invite-only sign-up (D15, beta). An address with no account needs a valid invite:
//   no invite → 403 INVITE_REQUIRED; unknown/expired/used/bound to another address → 422
//   INVITE_INVALID. Accounts that exist (in any state) and ADMIN_EMAILS never need one, and
//   invite_code is then ignored entirely, so a code can't be used to learn anything about
//   them. The invite is only checked here; it is consumed when verify-code creates the account.
// Enumeration: INVITE_REQUIRED does tell someone who already knows an address that it has no
//   account. That is inherent to invite-only sign-in with an inline error. It is bounded by the
//   per-IP cap (refusals count towards it) and is the same for every unknown address, with or
//   without a staff email. See docs/engineering/invite-only-signup.md.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const body = await req.json().catch(() => ({}));
  const { email } = body;
  if (!email || typeof email !== "string" || !validEmail(email.trim())) {
    return fail("VALIDATION", "Enter a valid email address.", 422, rid, {
      field_errors: { email: "Enter a valid email address." },
    });
  }
  const clean = email.trim().toLowerCase();

  // On-screen codes where allowed — but never for staff, whose accounts open the
  // ops console. Those always go to the real inbox.
  const existing = await prisma.user.findUnique({ where: { email: clean }, select: { role: true } });
  const bootstrapAdmin = adminEmails().includes(clean);
  const isStaff = bootstrapAdmin || (!!existing && existing.role !== "member" && (IS_RESEARCH || IS_BETA));
  const emailed = isStaff || !DEMO_MODE;

  // New accounts: pause switch, then the invite.
  let newAccount: NewAccountGate = null;
  let inviteId: string | null = null;
  if (!existing && !bootstrapAdmin) {
    if (SIGNUPS_PAUSED) newAccount = "paused";
    else if (INVITE_ONLY) {
      const supplied = body.invite_code != null && String(body.invite_code).trim() !== "";
      if (!supplied) newAccount = "required";
      else if (
        (await prisma.auditEvent.count({
          where: { eventType: "auth.code_requested", action: "invite_invalid", occurredAt: { gt: new Date(Date.now() - HOUR) } },
        })) >= MAX_INVITE_FAILURES_PER_HOUR
      ) {
        // HM-29: too many bad codes site-wide this hour — someone is guessing. Every invite
        // sign-up attempt waits, valid or not, so the cap can't be used as an oracle.
        return fail("RATE_LIMITED", "We're getting a lot of invite attempts right now. Try again in an hour.", 429, rid, {
          retry_after: 3600,
        });
      } else {
        const invite = await findInvite(prisma, String(body.invite_code));
        if (inviteUsable(invite, clean)) {
          newAccount = "ok";
          inviteId = invite!.id;
        } else newAccount = "invalid";
      }
    }
  }

  // Only emailed codes are capped per IP, so only they record an IP hash (HM-23). Without a
  // salt in a deployment, IPs aren't recorded at all and the per-IP cap is off.
  const ipHash = emailed ? hashIp(clientIp(req)) : null;
  if (emailed && !ipHash && !warnedNoSalt) {
    warnedNoSalt = true;
    console.warn("IP_HASH_SALT is not set: per-IP sign-in code limits are off.");
  }

  const code = generateLoginCode();
  const decision = await prisma.$transaction(async (tx) => {
    // Fixed order (email, then IP) so two requests can never wait on each other.
    await lockKey(tx, `code:email:${clean}`);
    if (ipHash) await lockKey(tx, `code:ip:${ipHash}`);

    const since = new Date(Date.now() - HOUR);
    const [fromEmail, fromIp, sitewide] = await Promise.all([
      tx.authCode.count({ where: { email: clean, createdAt: { gt: since } } }),
      emailed && ipHash
        ? tx.auditEvent.count({ where: { eventType: "auth.code_requested", resourceId: ipHash, occurredAt: { gt: since } } })
        : 0,
      emailed
        ? tx.auditEvent.count({ where: { eventType: "auth.code_requested", action: "email", occurredAt: { gt: since } } })
        : 0,
    ]);
    const d = decideCodeRequest({ emailedCode: emailed, isStaff, fromEmail, fromIp, sitewide, newAccount });
    if (d === "email_limited" || d === "ip_limited") return d;

    const sending = d === "send" || d === "send_sitewide_limited";
    if (sending) {
      await tx.authCode.create({
        data: { email: clean, code, inviteId, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
      });
    }
    // Security log: who asked is unknown, so record only a salted hash of the IP bucket,
    // and only for emailed codes. Refusals are logged so ops can see a flood or a probe.
    const action =
      d === "sitewide_limited" ? "dropped_sitewide_cap"
      : d === "signups_paused" ? "signups_paused"
      : d === "invite_required" ? "invite_required"
      : d === "invite_invalid" ? "invite_invalid"
      : emailed ? "email" : "on_screen";
    await writeAudit(tx, {
      eventType: "auth.code_requested",
      actorType: "service",
      resourceType: ipHash ? "ip" : "none",
      resourceId: ipHash ?? "not_recorded",
      action,
      outcome: sending ? "allowed" : "denied",
    }, rid);
    return d;
  });

  if (decision === "email_limited") {
    return fail("RATE_LIMITED", "Too many code requests. Try again later.", 429, rid, { retry_after: 3600 });
  }
  if (decision === "ip_limited") {
    return fail("RATE_LIMITED", "Too many sign-in codes have been requested. Try again in an hour.", 429, rid, {
      retry_after: 3600,
    });
  }
  if (decision === "signups_paused") {
    return fail("FORBIDDEN", "We're not taking new sign-ups for a few days. Please try again later.", 403, rid);
  }
  if (decision === "invite_required") {
    return fail(
      "INVITE_REQUIRED",
      "Peabudy is invite-only for now. Ask for an invite at /request-access, or enter the invite code from your email.",
      403,
      rid
    );
  }
  if (decision === "invite_invalid") {
    return fail("INVITE_INVALID", "That invite code isn't valid. Check it, or ask for a new invite at /request-access.", 422, rid, {
      field_errors: { invite_code: "This invite code isn't valid." },
    });
  }
  if (decision === "sitewide_limited") {
    // HM-26: honest, and identical for every address, after roughly the time a send takes.
    await jitter();
    return fail("RATE_LIMITED", BUSY_MESSAGE, 429, rid, { retry_after: 3600 });
  }

  if (decision === "send_sitewide_limited") {
    // Staff: the code goes to their inbox, but the answer is the same 429 members get (the
    // send itself stands in for the members' jitter). A send failure must not change the
    // answer either, or it would mark the address as staff.
    await sendLoginCode(clean, code, { allowOnScreen: false }).catch((e) =>
      console.error("Staff code send failed behind the site-wide cap", e?.code ?? e)
    );
    return fail("RATE_LIMITED", BUSY_MESSAGE, 429, rid, { retry_after: 3600 });
  }
  const { sink, sinkCode } = await sendLoginCode(clean, code, isStaff ? { allowOnScreen: false } : {});
  return ok({ status: "sent", sink_code: sink ? sinkCode : undefined }, rid);
});
