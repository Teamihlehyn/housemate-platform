import { createHash, randomInt, timingSafeEqual } from "crypto";

// Brute-force limits for login codes (HM-03).
export const MAX_ATTEMPTS_PER_CODE = 5;
export const MAX_FAILED_PER_HOUR = 10; // per email address, across codes

// Emailed-code request caps (HM-08).
export const MAX_EMAILED_CODES_PER_IP_HOUR = 10;
export const MAX_EMAILED_CODES_PER_HOUR = 300; // site-wide

// The caller's IP. On Vercel, x-forwarded-for is set by the platform (first entry).
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip")?.trim() || "unknown";
}

// IPs are personal data: keep only a salted, truncated hash (enough to count requests).
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT || "peabudy-ip-v1";
  return createHash("sha256").update(salt + ":" + ip).digest("hex").slice(0, 32);
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
