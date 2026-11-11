import { NextRequest, NextResponse, after } from "next/server";
import { randomInt } from "crypto";
import { prisma } from "./db";
import { ApiError, fail } from "./api";
import { writeAudit } from "./audit";
import { lockKey, recentCount } from "./rateLimit";
import { DEMO_MODE } from "./env";
import { sendLoginCode } from "./email";
import {
  BUSY_MESSAGE,
  CODE_RESPONSE_FLOOR_MS,
  MAX_ATTEMPTS_PER_CODE,
  MAX_FAILED_PER_HOUR,
  clientIp,
  codesMatch,
  decideCodeRequest,
  generateLoginCode,
  emailHashSecret,
  hashEmailKey,
  hashIp,
} from "./auth";

// Shared six-digit email codes for sign-in, /join and activation (ENG-40, ENG-41, ENG-43).
// One per-address bucket covers all three, so /join can't be used to get round sign-in limits.

const HOUR = 60 * 60 * 1000;
let warnedNoSalt = false;

// The keyed hash of an address, or 503 when EMAIL_HASH_SECRET is missing in a deployment
// (fail closed, HM-40): without it neither the per-address limits nor the tombstones work.
export function emailKey(email: string): string {
  const secret = emailHashSecret();
  if (!secret) {
    console.error("EMAIL_HASH_SECRET is not set: email codes and application tombstones are refused.");
    throw new ApiError("EMAIL_NOT_CONFIGURED", "Sign-in isn't available right now. Please try again later.", 503);
  }
  return hashEmailKey(email, secret);
}

export type IssueResult =
  | { kind: "ok"; sinkCode?: string }
  | { kind: "limited"; response: NextResponse };

// Wait until at least `floorMs` has passed since `start`, plus a little jitter.
export async function padResponse(start: number, floorMs = CODE_RESPONSE_FLOOR_MS): Promise<void> {
  const wait = floorMs + randomInt(60) - (Date.now() - start);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

// Decide, record and (if allowed) send a code. The send runs after the response (`after`),
// so an eligible address answers as fast as an ineligible one. In demo modes a non-staff
// code comes back on screen instead.
export async function issueCode(
  req: NextRequest,
  rid: string,
  opts: { email: string; eligible: boolean; isStaff: boolean; channel: "signin" | "application" | "activation"; consentVersion?: string | null }
): Promise<IssueResult> {
  const { email, eligible, isStaff } = opts;
  const emailed = isStaff || !DEMO_MODE;
  const ipHash = emailed ? hashIp(clientIp(req)) : null;
  if (emailed && !ipHash && !warnedNoSalt) {
    warnedNoSalt = true;
    console.warn("IP_HASH_SALT is not set: per-IP sign-in code limits are off.");
  }
  const emailHash = emailKey(email);
  const code = generateLoginCode();

  const decision = await prisma.$transaction(async (tx) => {
    // Fixed order (email, then IP) so two requests can never wait on each other.
    await lockKey(tx, `code:email:${email}`);
    if (ipHash) await lockKey(tx, `code:ip:${ipHash}`);
    const since = new Date(Date.now() - HOUR);
    const [fromEmail, fromIp, sitewide] = await Promise.all([
      recentCount(tx, "auth.code_email", emailHash, HOUR),
      emailed && ipHash
        ? tx.auditEvent.count({ where: { eventType: "auth.code_requested", resourceId: ipHash, occurredAt: { gt: since } } })
        : 0,
      emailed
        ? tx.auditEvent.count({ where: { eventType: "auth.code_requested", action: "email", occurredAt: { gt: since } } })
        : 0,
    ]);
    const d = decideCodeRequest({ emailedCode: emailed, isStaff, eligible, fromEmail, fromIp, sitewide });
    if (d === "email_limited" || d === "ip_limited") return d;

    const sending = d === "send" || d === "send_sitewide_limited";
    if (sending) {
      await tx.authCode.create({
        data: { email, code, consentVersion: opts.consentVersion ?? null, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
      });
    } else if (d === "silent") {
      // HM-35: an address that may not sign in still gets a code row, with a fresh random code
      // that is never sent, so a later guess meets the same attempts, expiry and
      // TOO_MANY_ATTEMPTS as a user's would. Sign-in is still refused after the code check.
      await tx.authCode.create({
        data: { email, code: generateLoginCode(), consentVersion: null, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
      });
    }
    if (d !== "sitewide_limited") {
      // Per-address count: every counted request, eligible or not, so the 6th request in an
      // hour is refused the same way for every address.
      await writeAudit(tx, {
        eventType: "auth.code_email",
        actorType: "service",
        resourceType: "email_hash",
        resourceId: emailHash,
        action: opts.channel,
      }, rid);
    }
    // Security log: who asked is unknown, so only a salted hash of the IP bucket.
    await writeAudit(tx, {
      eventType: "auth.code_requested",
      actorType: "service",
      resourceType: ipHash ? "ip" : "none",
      resourceId: ipHash ?? "not_recorded",
      action: d === "sitewide_limited" ? "dropped_sitewide_cap" : d === "silent" ? "not_eligible" : emailed ? "email" : "on_screen",
      outcome: sending ? "allowed" : "denied",
      reasonCode: opts.channel,
    }, rid);
    return d;
  });

  if (decision === "email_limited") {
    return { kind: "limited", response: fail("RATE_LIMITED", "Too many code requests. Try again later.", 429, rid, { retry_after: 3600 }) };
  }
  if (decision === "ip_limited") {
    return {
      kind: "limited",
      response: fail("RATE_LIMITED", "Too many sign-in codes have been requested. Try again in an hour.", 429, rid, { retry_after: 3600 }),
    };
  }
  const sendLater = () =>
    after(async () => {
      try {
        await sendLoginCode(email, code, { allowOnScreen: false });
        await prisma.$transaction((tx) =>
          writeAudit(tx, { eventType: "email.sent", actorType: "service", resourceType: "email", resourceId: "E0", action: opts.channel })
        );
      } catch (e) {
        console.error("Code email failed", (e as { code?: string })?.code ?? "unknown");
      }
    });
  if (decision === "sitewide_limited" || decision === "send_sitewide_limited") {
    // HM-26: honest and identical for every address. Staff codes still go out behind it.
    if (decision === "send_sitewide_limited") sendLater();
    return { kind: "limited", response: fail("RATE_LIMITED", BUSY_MESSAGE, 429, rid, { retry_after: 3600 }) };
  }
  if (decision === "silent") return { kind: "ok" };
  if (!emailed) return { kind: "ok", sinkCode: code };
  sendLater();
  return { kind: "ok" };
}

// Check a six-digit code for an address, with the brute-force limits (HM-03). Throws the
// usual errors; on success returns the code row (not consumed: the caller deletes it in its
// own transaction, so a failure after this leaves the code usable).
export async function claimCode(email: string, code: unknown) {
  const record = await prisma.authCode.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
  if (!record || record.expiresAt < new Date()) {
    throw new ApiError("CODE_EXPIRED", "That code has expired. Request a new one.", 422);
  }
  const failedLastHour = await prisma.authCode.aggregate({
    where: { email, createdAt: { gt: new Date(Date.now() - HOUR) } },
    _sum: { attempts: true },
  });
  if ((failedLastHour._sum.attempts ?? 0) >= MAX_FAILED_PER_HOUR) {
    throw new ApiError("TOO_MANY_ATTEMPTS", "Too many attempts. Try again in an hour.", 429, undefined, 3600);
  }
  // Claim an attempt atomically BEFORE comparing, so parallel guesses can't all slip in.
  const claimed = await prisma.authCode.updateMany({
    where: { id: record.id, attempts: { lt: MAX_ATTEMPTS_PER_CODE } },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count === 0) throw new ApiError("TOO_MANY_ATTEMPTS", "Too many attempts. Request a new code.", 429);
  if (!codesMatch(record.code, String(code ?? "").trim())) throw invalidCode();
  // A correct code isn't a failed guess: give the attempt back.
  await prisma.authCode.updateMany({ where: { id: record.id, attempts: { gt: 0 } }, data: { attempts: { decrement: 1 } } });
  return record;
}

// The one "wrong code" answer, also used for addresses that may not sign in (R2.3).
export function invalidCode(): ApiError {
  return new ApiError("INVALID_CODE", "That code is not correct.", 422, { code: "Incorrect code." });
}
