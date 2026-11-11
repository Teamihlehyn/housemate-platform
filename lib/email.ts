import { DEMO_MODE } from "./env";
import { ApiError } from "./api";
import { codeEmail } from "./emails";

// Sends a login code. Where on-screen codes are allowed (dev/staging/research) it
// returns a "sink" result so the code can be shown on screen. Otherwise it sends a
// real email via Resend; a missing config is a hard error (we never silently fail).
// Staff accounts always get a real email, even where on-screen codes are on.

export interface SendResult {
  sink: boolean;
  sinkCode?: string;
}

export async function sendLoginCode(
  email: string,
  code: string,
  opts: { allowOnScreen?: boolean } = {}
): Promise<SendResult> {
  if (opts.allowOnScreen ?? DEMO_MODE) {
    return { sink: true, sinkCode: code };
  }

  await sendEmail({ to: email, what: "your code", ...codeEmail({ code }) });
  return { sink: false };
}

// Resend's API. Locally (no VERCEL_ENV) EMAIL_API_URL can point at a fake mail server so the
// e2e suite can read what was sent; deployments always use Resend.
function emailApiUrl(): string {
  const local = !process.env.VERCEL_ENV && process.env.EMAIL_API_URL;
  return (local || "https://api.resend.com").replace(/\/+$/, "") + "/emails";
}

export function emailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

// Send one email through Resend. Throws ApiError 503 when email isn't set up here and 502
// when Resend refuses it. Never logs the address or the content.
export async function sendEmail(msg: {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
  what?: string; // for error messages: "your code", "the invite"
}): Promise<void> {
  const what = msg.what ?? "the email";
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new ApiError("EMAIL_NOT_CONFIGURED", `We couldn't send ${what}: email isn't set up here.`, 503);
  }
  const res = await fetch(emailApiUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html, headers: msg.headers }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Resend delivery failed", res.status, detail.slice(0, 300));
    throw new ApiError("EMAIL_SEND_FAILED", `We couldn't send ${what} to that address.`, 502);
  }
}
