import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";

// Brute-force limits for login codes (HM-03).
export const MAX_ATTEMPTS_PER_CODE = 5;
export const MAX_FAILED_PER_HOUR = 10; // per email address, across codes

// Code request caps (HM-08).
export const MAX_CODES_PER_EMAIL_HOUR = 5;
export const MAX_EMAILED_CODES_PER_IP_HOUR = 10;
export const MAX_EMAILED_CODES_PER_HOUR = 300; // site-wide

// HM-26: the one answer everyone gets above the site-wide cap.
export const BUSY_MESSAGE = "We're getting a lot of sign-in requests right now. Try again in an hour.";

export type CodeRequestDecision =
  | "send"
  | "silent" // approval-first: not an active member, so nothing is sent — same answer as "send"
  | "email_limited"
  | "ip_limited"
  | "sitewide_limited" // members: 429, nothing sent
  | "send_sitewide_limited"; // staff: the same 429, but the code is still sent

// What to do with a code request, given counts taken under a per-email/per-IP lock.
// Every check before the last one ignores `eligible`, so an address with no account (or an
// applicant, declined or suspended one) gets exactly the answer an active member gets (HM-28).
// - Per email (5 an hour, everyone, counted for every request): 429.
// - Per IP bucket (emailed codes only): 429. Applies to staff too, so it can't reveal them.
// - Site-wide (emailed codes only, HM-26): over the cap everyone gets the same honest 429.
//   Staff codes are still sent behind it, so a flood can't lock staff out of the console.
// - Then: eligible → send; otherwise → silent (the same 200, no code, no email).
export function decideCodeRequest(c: {
  emailedCode: boolean;
  isStaff: boolean;
  eligible: boolean;
  fromEmail: number;
  fromIp: number; // 0 when IPs aren't recorded
  sitewide: number;
}): CodeRequestDecision {
  if (c.fromEmail >= MAX_CODES_PER_EMAIL_HOUR) return "email_limited";
  if (c.emailedCode && c.fromIp >= MAX_EMAILED_CODES_PER_IP_HOUR) return "ip_limited";
  if (c.emailedCode && c.sitewide >= MAX_EMAILED_CODES_PER_HOUR) {
    return c.isStaff && c.eligible ? "send_sitewide_limited" : "sitewide_limited";
  }
  return c.eligible ? "send" : "silent";
}

// Every code-request answer takes at least this long, so the database work for an eligible
// address (a code row, the queued send) can't be told apart by timing (R2.4).
export const CODE_RESPONSE_FLOOR_MS = 450;

// Keyed hash of an address (HM-40), for counting code requests per address and for the
// declined-application tombstones (R7) without storing the address. HMAC-SHA256 with
// EMAIL_HASH_SECRET (32+ characters), a stable secret separate from IP_HASH_SALT so rotating
// one never resets the other. In any Vercel deployment there is no fallback: without the
// secret, emailHashSecret() is null and callers refuse to run (fail closed).
const LOCAL_EMAIL_SECRET = "peabudy-email-hash-local-only-not-a-secret";
export function emailHashSecret(env: Record<string, string | undefined> = process.env): string | null {
  const s = (env.EMAIL_HASH_SECRET || "").trim();
  if (s.length >= 32) return s;
  return env.VERCEL_ENV ? null : LOCAL_EMAIL_SECRET;
}
export function hashEmailKey(email: string, secret: string): string {
  return createHmac("sha256", secret).update("email:" + email.trim().toLowerCase()).digest("hex").slice(0, 32);
}


// The caller's IP. On Vercel, x-forwarded-for is set by the platform (first entry).
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip")?.trim() || "unknown";
}

// Expand an IPv6 address to 8 hextets, or null if it isn't one.
function ipv6Hextets(ip: string): string[] | null {
  let addr = ip.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  // Trailing dotted IPv4 (e.g. ::ffff:1.2.3.4 or 64:ff9b::1.2.3.4) → two hextets.
  const v4 = /(.*:)([0-9]{1,3}(?:\.[0-9]{1,3}){3})$/.exec(addr);
  if (v4) {
    const o = v4[2].split(".").map(Number);
    if (o.some((n) => n > 255)) return null;
    addr = v4[1] + ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16);
  }
  if (!/^[0-9a-f:]+$/.test(addr) || (addr.match(/::/g) ?? []).length > 1) return null;
  const [head, tail] = addr.includes("::") ? addr.split("::") : [addr, null];
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const missing = 8 - h.length - t.length;
  if (tail === null ? missing !== 0 : missing < 1) return null;
  const all = [...h, ...Array(tail === null ? 0 : missing).fill("0"), ...t];
  if (all.some((x) => !/^[0-9a-f]{1,4}$/.test(x))) return null;
  return all.map((x) => parseInt(x, 16).toString(16));
}

// The rate-limit bucket for an address (HM-08). IPv4: the address itself. IPv6: its /64,
// because one household or phone usually gets a whole /64 and can rotate through it.
// IPv4-mapped IPv6 (::ffff:a.b.c.d) counts as the IPv4 address.
export function ipBucket(ip: string): string {
  const raw = ip.trim();
  if (/^[0-9]{1,3}(\.[0-9]{1,3}){3}$/.test(raw)) return raw;
  const h = ipv6Hextets(raw);
  if (!h) return raw.toLowerCase();
  if (h.slice(0, 5).every((x) => x === "0") && h[5] === "ffff") {
    const n = (x: string) => parseInt(x, 16);
    return [n(h[6]) >> 8, n(h[6]) & 255, n(h[7]) >> 8, n(h[7]) & 255].join(".");
  }
  return h.slice(0, 4).join(":") + "::/64";
}

// Salt for IP hashes (HM-23). In any Vercel deployment (VERCEL_ENV set) there is no
// fallback: without a real IP_HASH_SALT (16+ characters) we don't record IPs at all, so
// per-IP limits are off but nothing breaks. Locally a fixed salt keeps tests deterministic.
const LOCAL_SALT = "peabudy-ip-local-only";
export function ipHashSalt(env: Record<string, string | undefined> = process.env): string | null {
  const salt = (env.IP_HASH_SALT || "").trim();
  if (salt.length >= 16) return salt;
  return env.VERCEL_ENV ? null : LOCAL_SALT;
}

// IPs are personal data: keep only a salted, truncated hash of the bucket (enough to count
// requests). Returns null when IPs mustn't be recorded (no salt in a deployment).
export function hashIp(ip: string, salt: string | null = ipHashSalt()): string | null {
  if (!salt) return null;
  return createHash("sha256").update(salt + ":" + ipBucket(ip)).digest("hex").slice(0, 32);
}

// Six-digit login code from a cryptographically secure source (100000–999999).
export function generateLoginCode(): string {
  return String(randomInt(100000, 1000000));
}

// Constant-time comparison. Hashing first gives equal-length buffers, so neither the
// content nor the length of a guess changes the timing.
export function codesMatch(expected: string, given: string): boolean {
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(expected), h(given));
}

// Must this person tick the privacy notice before signing in? Yes when consent is
// required here and they have never agreed, or agreed to an older version.
export function needsConsent(
  user: { privacyConsentAt: Date | null; privacyConsentVersion: string | null } | null,
  currentVersion: string,
  consentRequired: boolean
): boolean {
  if (!consentRequired) return false;
  if (!user || !user.privacyConsentAt) return true;
  return user.privacyConsentVersion !== currentVersion;
}

// Is this an existing account being asked to re-consent to a newer notice?
export function isReconsent(
  user: { privacyConsentAt: Date | null; privacyConsentVersion: string | null } | null,
  currentVersion: string
): boolean {
  return !!user?.privacyConsentAt && user.privacyConsentVersion !== currentVersion;
}

// Contact line for messages that need a human (e.g. cancelling a deletion).
export function contactHint(): string {
  const email = (process.env.NEXT_PUBLIC_CONTACT_EMAIL || "").trim();
  return email ? `email ${email}` : "contact the Peabudy team";
}
