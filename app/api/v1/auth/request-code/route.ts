import { NextRequest } from "next/server";
import { randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { sendLoginCode } from "@/lib/email";
import { adminEmails } from "@/lib/guard";
import { DEMO_MODE, IS_BETA, IS_RESEARCH } from "@/lib/env";
import { clientIp, decideCodeRequest, generateLoginCode, hashIp } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const HOUR = 60 * 60 * 1000;
let warnedNoSalt = false;

// Serialise concurrent requests for the same key until the transaction ends, so a burst
// can't slip past a cap by counting before any of its rows exist (HM-08).
async function lock(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

// POST /api/v1/auth/request-code {email}
// Where on-screen codes are allowed, the code comes back in `sink_code`; otherwise it is emailed.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    return fail("VALIDATION", "Enter a valid email address.", 422, rid, {
      field_errors: { email: "Enter a valid email address." },
    });
  }
  const clean = email.trim().toLowerCase();

  // On-screen codes where allowed — but never for staff, whose accounts open the
  // ops console. Those always go to the real inbox.
  const existing = await prisma.user.findUnique({ where: { email: clean }, select: { role: true } });
  const isStaff = adminEmails().includes(clean) || (!!existing && existing.role !== "member" && (IS_RESEARCH || IS_BETA));
  const emailed = isStaff || !DEMO_MODE;

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
    await lock(tx, `code:email:${clean}`);
    if (ipHash) await lock(tx, `code:ip:${ipHash}`);

    const since = new Date(Date.now() - HOUR);
    const [fromEmail, fromIp, sitewide] = await Promise.all([
      tx.authCode.count({ where: { email: clean, createdAt: { gt: since } } }),
      emailed && ipHash
        ? tx.auditEvent.count({ where: { eventType: "auth.code_requested", resourceId: ipHash, occurredAt: { gt: since } } })
        : 0,
      emailed && !isStaff
        ? tx.auditEvent.count({ where: { eventType: "auth.code_requested", action: "email", occurredAt: { gt: since } } })
        : 0,
    ]);
    const d = decideCodeRequest({ emailedCode: emailed, isStaff, fromEmail, fromIp, sitewide });
    if (d === "email_limited" || d === "ip_limited") return d;

    if (d === "send") {
      await tx.authCode.create({ data: { email: clean, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    }
    // Security log: who asked is unknown, so record only a salted hash of the IP bucket,
    // and only for emailed codes. A dropped request is logged so ops can see a flood.
    await writeAudit(tx, {
      eventType: "auth.code_requested",
      actorType: "service",
      resourceType: ipHash ? "ip" : "none",
      resourceId: ipHash ?? "not_recorded",
      action: d === "drop" ? "dropped_sitewide_cap" : emailed ? "email" : "on_screen",
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
  if (decision === "drop") {
    // Same response as a sent code, after roughly the time a send takes.
    await new Promise((r) => setTimeout(r, 150 + randomInt(350)));
    return ok({ status: "sent", sink_code: undefined }, rid);
  }

  const { sink, sinkCode } = await sendLoginCode(clean, code, isStaff ? { allowOnScreen: false } : {});
  return ok({ status: "sent", sink_code: sink ? sinkCode : undefined }, rid);
});
