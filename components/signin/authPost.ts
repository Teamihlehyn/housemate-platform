"use client";

// The public auth calls (sign-in, /join, activation) read Retry-After, which lib/client's api()
// doesn't expose. Same envelope and error shape as api().

import { ApiClientError } from "@/lib/client";

export class AuthError extends ApiClientError {
  constructor(code: string, message: string, status: number, fieldErrors: Record<string, string> | null, public retryAfter: number | null) {
    super(code, message, status, fieldErrors);
  }
}

export async function authPost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-ID": crypto.randomUUID() },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new AuthError("NETWORK", "We couldn't reach Peabudy. Check your connection and try again.", 0, null, null);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json.error ?? {};
    const ra = parseInt(res.headers.get("Retry-After") ?? "", 10);
    throw new AuthError(err.code ?? "ERROR", err.message ?? "Something went wrong. Try again.", res.status, err.field_errors ?? null, Number.isFinite(ra) ? ra : null);
  }
  return json.data as T;
}

export function waitText(seconds: number) {
  if (seconds < 90) return "You can try again in about a minute.";
  const m = Math.ceil(seconds / 60);
  return m < 90 ? `You can try again in about ${m} minutes.` : `You can try again in about ${Math.round(m / 60)} hour${Math.round(m / 60) === 1 ? "" : "s"}.`;
}

/** The HM-26 site-wide wait, kept for this tab so a reload doesn't hide it. */
export function readWait(key: string): { until: number; message: string } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) || "null");
    return v && typeof v.until === "number" && v.until > Date.now() ? v : null;
  } catch {
    return null;
  }
}
export function writeWait(key: string, v: { until: number; message: string } | null) {
  try {
    if (v) sessionStorage.setItem(key, JSON.stringify(v));
    else sessionStorage.removeItem(key);
  } catch {}
}
