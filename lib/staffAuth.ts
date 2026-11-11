import { cookies } from "next/headers";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { prisma } from "./db";
import { listedRole } from "./staff";

// Back-office sign-in (ENG-47): email + password, then a 6-digit code by email. This is the only
// way into /staff. A staff session lives in its own cookie (hm_staff_session, 12 h, SameSite=
// Strict), separate from the user session (hm_session), so the two never stand in for each
// other. Only addresses on the staff allowlist (ADMIN_EMAILS / STAFF_EMAILS) ever get a
// credential, a code or a session.

export const STAFF_COOKIE = "hm_staff_session";
export const PENDING_COOKIE = "hm_staff_pending"; // binds the code step to the password step
export const STAFF_SESSION_HOURS = 12;
export const PENDING_MINUTES = 10;
export const SETUP_LINK_MINUTES = 30;
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 200;
// Lockout: 5 wrong passwords per address in 15 minutes; 20 per connection an hour.
export const MAX_FAILS_PER_ADDRESS = 5;
export const FAIL_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILS_PER_IP_HOUR = 20;

// ---- Passwords: Node's scrypt, salted, no dependency ----------------------------------------
const N = 1 << 15, R = 8, P = 1, KEYLEN = 64;
const MAXMEM = 128 * N * R * 2;

function scrypt(password: string, salt: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (e, key) => (e ? reject(e) : resolve(key)))
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

// Constant-time check. Anything malformed is simply "no".
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64");
  const got = await scrypt(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// Run the same scrypt work for an address with no credential, so the answer takes as long.
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(18).toString("base64"));
  await verifyPassword(password, await dummyHash);
}

// A short built-in list of passwords people actually pick (no dependency). Compared lower-case,
// with spaces removed.
const COMMON = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword123",
  "123456789012", "1234567890123", "12345678910", "111111111111", "000000000000", "qwertyuiop", "qwertyuiop12",
  "qwerty123456", "1q2w3e4r5t6y", "1qaz2wsx3edc", "zaq12wsxcde3", "asdfghjkl123", "iloveyou1234", "letmein12345",
  "welcome12345", "welcome123", "administrator", "admin1234567", "adminadmin12", "changeme1234", "football1234",
  "baseball1234", "sunshine1234", "princess1234", "monkey123456", "dragon123456", "trustno11234", "abc123456789",
  "abcdefghijkl", "abcd12345678", "peabudy", "peabudy12345", "peabudy2026", "backoffice12", "housemate123",
  "lagos1234567", "london123456", "nigeria12345", "correcthorsebatterystaple",
]);

// Why a new password isn't acceptable, or null. Plain words for the set-up page.
export function passwordProblem(password: unknown, email: string): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  const flat = password.toLowerCase().replace(/\s+/g, "");
  if (COMMON.has(flat) || /^(.)\1+$/.test(flat)) return "That password is too common. Choose something less guessable.";
  const local = email.split("@")[0].toLowerCase();
  if (local.length >= 4 && flat.includes(local)) return "Don't use your email address in your password.";
  return null;
}

// ---- Tokens ------------------------------------------------------------------------------------
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256(token) };
}
export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
export function plausibleToken(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{40,60}$/.test(t);
}

// ---- Sessions ----------------------------------------------------------------------------------
const cookieBase = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function setPendingCookie(token: string) {
  const jar = await cookies();
  jar.set(PENDING_COOKIE, token, { ...cookieBase, maxAge: PENDING_MINUTES * 60 });
}
export async function pendingHashFromCookie(): Promise<string | null> {
  const t = (await cookies()).get(PENDING_COOKIE)?.value;
  return t && plausibleToken(t) ? sha256(t) : null;
}

export async function createStaffSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + STAFF_SESSION_HOURS * 3600 * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt, scope: "staff" } });
  const jar = await cookies();
  jar.set(STAFF_COOKIE, token, { ...cookieBase, expires: expiresAt });
  jar.delete(PENDING_COOKIE);
}

export async function destroyStaffSession(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  let userId: string | null = null;
  if (token) {
    const s = await prisma.session.findUnique({ where: { token } });
    userId = s?.userId ?? null;
    await prisma.session.deleteMany({ where: { token } });
  }
  jar.delete(STAFF_COOKIE);
  return userId;
}

// The signed-in staff member, or null. Needs a staff-scoped session in the staff cookie AND an
// address still on the allowlist; the role is the listed one (never the stored one alone).
export async function getStaffUser() {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token } });
  if (!session || session.scope !== "staff" || session.expiresAt < new Date()) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.accountStatus !== "active") return null;
  const role = listedRole(user.email);
  if (!role) return null;
  return { ...user, role };
}
