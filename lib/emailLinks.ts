import { createHmac, timingSafeEqual } from "crypto";
import { siteUrl } from "./env";

// Signed links in emails (ENG-29): the survey unsubscribe link and the pseudonymous survey
// reference. HMAC-SHA256 with EMAIL_LINK_SECRET (32+ characters). In any Vercel deployment
// there is no fallback: without the secret, links can't be made or checked, so survey
// sending refuses to run and every unsubscribe token is invalid. Locally a fixed secret
// keeps tests deterministic.
const LOCAL_SECRET = "peabudy-email-links-local-only-not-secret";

export function emailLinkSecret(env: Record<string, string | undefined> = process.env): string | null {
  const s = (env.EMAIL_LINK_SECRET || "").trim();
  if (s.length >= 32) return s;
  return env.VERCEL_ENV ? null : LOCAL_SECRET;
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

// "<userId>.<signature>". No expiry: an unsubscribe link must keep working.
export function unsubscribeToken(userId: string, secret: string | null = emailLinkSecret()): string | null {
  if (!secret) return null;
  return `${userId}.${sign(secret, `${userId}|survey`)}`;
}

// The user ID the token was made for, or null for anything tampered, truncated or unsigned.
export function verifyUnsubscribeToken(token: unknown, secret: string | null = emailLinkSecret()): string | null {
  if (!secret || typeof token !== "string" || token.length > 200) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  if (!/^[a-z0-9]{8,40}$/i.test(userId)) return null;
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(secret, `${userId}|survey`));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}

// The page people see (built by the designer) and the RFC 8058 one-click endpoint.
export function unsubscribeUrl(token: string): string {
  return `${siteUrl()}/unsubscribe?token=${encodeURIComponent(token)}`;
}
export function unsubscribeApiUrl(token: string): string {
  return `${siteUrl()}/api/v1/unsubscribe?token=${encodeURIComponent(token)}`;
}

// Links survey answers (Tally) to an account without exposing the internal ID.
export function surveyRef(userId: string, secret: string | null = emailLinkSecret()): string | null {
  if (!secret) return null;
  return createHmac("sha256", secret).update(`${userId}|survey_ref`).digest("hex").slice(0, 16);
}
