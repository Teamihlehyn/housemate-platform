import { DEMO_MODE } from "./env";
import { ApiError } from "./api";

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

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new ApiError("EMAIL_NOT_CONFIGURED", "We couldn't send your code: email isn't set up here.", 503);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `Your Peabudy sign-in code: ${code}`,
      text: `Your Peabudy sign-in code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`,
      html: loginEmailHtml(code),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Resend delivery failed", res.status, detail);
    throw new ApiError("EMAIL_SEND_FAILED", "We couldn't send your code to that address.", 502);
  }

  return { sink: false };
}

function loginEmailHtml(code: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f4ef;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#23221e">
  <div style="max-width:440px;margin:0 auto;padding:40px 24px">
    <div style="font-size:20px;font-weight:700;color:#2f6a5a">Peabudy</div>
    <h1 style="font-size:22px;font-weight:600;margin:24px 0 8px">Your sign-in code</h1>
    <p style="color:#6b6a65;margin:0 0 20px">Enter this code to sign in. It expires in 10 minutes.</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:8px;background:#fff;border:1px solid #e7e5df;border-radius:12px;padding:18px;text-align:center">${code}</div>
    <p style="color:#9a988f;font-size:12px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
  </div></body></html>`;
}
