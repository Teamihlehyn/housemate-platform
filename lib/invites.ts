import { createHash, randomInt } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { siteUrl } from "./env";

// Invite-only sign-up (D15).
//
// A code is 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L, U/V), so it
// survives being read aloud or retyped from WhatsApp: 29^8 ≈ 5 × 10^11 possibilities.
// Only its SHA-256 is stored; the code itself exists in the email and the staff response.
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;
export const INVITE_TTL_DAYS = 14;
// Unbound ad-hoc codes work for anyone, so they live much shorter (HM-29).
export const UNBOUND_TTL_HOURS = 72;

export function inviteTtlMs(bound: boolean): number {
  return bound ? INVITE_TTL_DAYS * 24 * 60 * 60 * 1000 : UNBOUND_TTL_HOURS * 60 * 60 * 1000;
}

// Site-wide hourly caps on invite guessing (HM-29): GET /invites/[code] checks, and
// request-code attempts that present an unusable code. Over either cap, every invite check
// or invite sign-up attempt gets 429 until the hour rolls on.
export const MAX_INVITE_CHECKS_PER_HOUR = 300;
export const MAX_INVITE_FAILURES_PER_HOUR = 300;

export function generateInviteCode(): string {
  let s = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) s += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return s;
}

// Accept what people actually type: any case, spaces or hyphens ("abcd-efgh").
// Returns null when it can't be a code, so lookups for junk never touch the database.
export function normaliseInviteCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.toUpperCase().replace(/[\s-]/g, "");
  if (s.length !== INVITE_CODE_LENGTH) return null;
  for (const ch of s) if (!INVITE_ALPHABET.includes(ch)) return null;
  return s;
}

export function hashInviteCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function inviteUrl(code: string): string {
  return `${siteUrl()}/invite/${code}`;
}

// "ad•••@gmail.com": enough for the invitee to recognise their own address, not enough to
// learn someone else's from a forwarded link.
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  return `${local.slice(0, Math.min(2, Math.max(1, local.length - 1)))}•••@${domain}`;
}

type Db = PrismaClient | Prisma.TransactionClient;
export type InviteRow = { id: string; email: string | null; expiresAt: Date; usedAt: Date | null; revokedAt?: Date | null };

export type InviteCheck = { ok: true; invite: InviteRow } | { ok: false };

// Is this invite usable by this address right now? Pure, so the rules are unit-tested.
// Unknown, expired, used and bound-to-someone-else all fail the same way.
export function inviteUsable(invite: InviteRow | null, email: string | null, now: Date = new Date()): boolean {
  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= now) return false;
  if (invite.email && email !== null && invite.email !== email) return false;
  return true;
}

export async function findInvite(db: Db, rawCode: unknown): Promise<InviteRow | null> {
  const code = normaliseInviteCode(rawCode);
  if (!code) return null;
  return db.invite.findUnique({
    where: { codeHash: hashInviteCode(code) },
    select: { id: true, email: true, expiresAt: true, usedAt: true, revokedAt: true },
  });
}

// Create an invite and return its one-time code. Caller writes the audit row.
export async function createInvite(
  tx: Prisma.TransactionClient,
  opts: { email: string | null; accessRequestId: string | null; createdBy: string }
): Promise<{ id: string; code: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + inviteTtlMs(!!opts.email));
  // A collision is astronomically unlikely, but the unique index would turn one into a 500.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const codeHash = hashInviteCode(code);
    if (await tx.invite.findUnique({ where: { codeHash }, select: { id: true } })) continue;
    const row = await tx.invite.create({
      data: { codeHash, email: opts.email, accessRequestId: opts.accessRequestId, createdBy: opts.createdBy, expiresAt },
    });
    return { id: row.id, code, expiresAt };
  }
  throw new Error("Could not generate a unique invite code.");
}

export function inviteState(i: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now: Date = new Date()) {
  return i.usedAt ? "used" : i.revokedAt ? "revoked" : i.expiresAt <= now ? "expired" : "active";
}
