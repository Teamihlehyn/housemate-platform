import { escapeHtml, fill } from "./render";
import * as T from "./templates";
import { INVITE_HTML, INVITE_SUBJECT, INVITE_TEXT, SURVEY_HTML, SURVEY_SUBJECT, SURVEY_TEXT } from "./templates";

// Emails built from the designer's templates (docs/design/emails/, synced into templates.ts
// by scripts/sync-email-templates.mjs). Values are HTML-escaped in the HTML part.

// Invite email (D15).
export function inviteEmail(values: { invite_url: string; code: string }) {
  return { subject: INVITE_SUBJECT, html: fill(INVITE_HTML, values, "html"), text: fill(INVITE_TEXT, values, "text") };
}

// Survey email (D17).
export function surveyEmail(values: { first_name: string; survey_url: string; unsubscribe_url: string }) {
  return { subject: SURVEY_SUBJECT, html: fill(SURVEY_HTML, values, "html"), text: fill(SURVEY_TEXT, values, "text") };
}

// ---------------------------------------------------------------------------------------
// Approval-first emails (ENG-43). Each uses the designer's template when it has been synced
// (docs/design/emails/<name>.html/.txt), otherwise a plain built-in version with the same
// facts. The subject may carry placeholders too (E0's code).

type Built = { subject: string; html: string; text: string };

function fromTemplate(
  tpl: { subject: string | null; html: string | null; text: string | null },
  values: Record<string, string>,
  fallback: () => Built
): Built {
  if (!tpl.subject || !tpl.html || !tpl.text) return fallback();
  return { subject: fill(tpl.subject, values, "text"), html: fill(tpl.html, values, "html"), text: fill(tpl.text, values, "text") };
}

// A minimal, light HTML wrapper for the built-in versions: paragraphs and one link.
function plainHtml(heading: string, paragraphs: string[], link?: { href: string; label: string }): string {
  const p = paragraphs.map((x) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(x)}</p>`).join("");
  const a = link
    ? `<p style="margin:20px 0"><a href="${escapeHtml(link.href)}" style="background:#23221e;color:#faf9f5;padding:12px 20px;border-radius:999px;text-decoration:none;display:inline-block">${escapeHtml(link.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="en-GB"><body style="margin:0;background:#f6f4ef;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#23221e"><div style="max-width:480px;margin:0 auto;padding:32px 20px"><div style="font-size:20px;font-weight:700;color:#2f6a5a">Peabudy</div><h1 style="font-size:21px;margin:22px 0 12px">${escapeHtml(heading)}</h1>${p}${a}</div></body></html>`;
}

// E0: sign-in, /join and activation code. No hint whether the address has an account.
export function codeEmail(v: { code: string }): Built {
  return fromTemplate({ subject: T.CODE_SUBJECT, html: T.CODE_HTML, text: T.CODE_TEXT }, v, () => ({
    subject: `Your Peabudy code: ${v.code}`,
    text: `Your Peabudy code is ${v.code}. It expires in 10 minutes.\n\nPeabudy will never ask you for this code.\n\nIf you didn't ask for it, you can ignore this email.`,
    html: plainHtml("Your Peabudy code", [
      `Your code is ${v.code}. It expires in 10 minutes.`,
      "Peabudy will never ask you for this code.",
      "If you didn't ask for it, you can ignore this email.",
    ]),
  }));
}

// E1: application received.
export function applicationReceivedEmail(v: { first_name: string; status_url: string }): Built {
  const T1 = { subject: T.APPLICATION_RECEIVED_SUBJECT, html: T.APPLICATION_RECEIVED_HTML, text: T.APPLICATION_RECEIVED_TEXT };
  return fromTemplate(T1, v, () => {
    const lines = [
      `Hi ${v.first_name}, thanks for applying to Peabudy.`,
      "What happens next: within a day we'll email you to book a 10-minute video ID call. Once a person on our team has checked your profile and seen your ID, we'll send you an invite to activate your account.",
      "We'll never ask you for money.",
    ];
    return {
      subject: "We've got your Peabudy application",
      text: `${lines.join("\n\n")}\n\nCheck your application: ${v.status_url}`,
      html: plainHtml("We've got your application", lines, { href: v.status_url, label: "Check your application" }),
    };
  });
}

// E1 + E5: received, and the city isn't open yet.
export function applicationWaitlistedEmail(v: { first_name: string; status_url: string; city_name: string }): Built {
  const T5 = { subject: T.APPLICATION_WAITLISTED_SUBJECT, html: T.APPLICATION_WAITLISTED_HTML, text: T.APPLICATION_WAITLISTED_TEXT };
  return fromTemplate(T5, v, () => {
    const lines = [
      `Hi ${v.first_name}, thanks for applying to Peabudy.`,
      `Peabudy isn't open in ${v.city_name} yet. We've kept your application and we'll email you when ${v.city_name} opens.`,
      "We'll never ask you for money.",
    ];
    return {
      subject: "We've got your Peabudy application",
      text: `${lines.join("\n\n")}\n\nCheck your application: ${v.status_url}`,
      html: plainHtml("We've got your application", lines, { href: v.status_url, label: "Check your application" }),
    };
  });
}

// E2: approved, with the activation link and the code typed out.
export function approvedEmail(v: { first_name: string; activation_url: string; code: string; expires_on: string }): Built {
  const T2 = { subject: T.APPROVED_SUBJECT, html: T.APPROVED_HTML, text: T.APPROVED_TEXT };
  return fromTemplate(T2, v, () => {
    const lines = [
      `Hi ${v.first_name}, you're approved.`,
      `Activate your account to make your profile live. Your activation code is ${v.code}, and it works until ${v.expires_on}.`,
      "Never share this link or code: it's yours alone.",
    ];
    return {
      subject: "You're approved: activate your Peabudy account",
      text: `${lines.join("\n\n")}\n\nActivate your account: ${v.activation_url}`,
      html: plainHtml("You're approved", lines, { href: v.activation_url, label: "Activate your account" }),
    };
  });
}

// E3: declined. Kind, generic, no reason.
export function declinedEmail(v: { first_name: string; reapply_on: string }): Built {
  const T3 = { subject: T.DECLINED_SUBJECT, html: T.DECLINED_HTML, text: T.DECLINED_TEXT };
  return fromTemplate(T3, v, () => {
    const lines = [
      `Hi ${v.first_name}, thank you for applying to Peabudy.`,
      "We can't offer you a place right now.",
      `You're welcome to apply again from ${v.reapply_on}.`,
    ];
    return { subject: "About your Peabudy application", text: lines.join("\n\n"), html: plainHtml("About your application", lines) };
  });
}

// E4: ID call booked.
// call_link: the video link staff entered, or a sentence saying it will follow.
export const CALL_LINK_LATER = "We'll send you the video link before the call.";
export function callBookedEmail(v: { first_name: string; call_time: string; call_link: string }): Built {
  const T4 = { subject: T.CALL_BOOKED_SUBJECT, html: T.CALL_BOOKED_HTML, text: T.CALL_BOOKED_TEXT };
  return fromTemplate(T4, v, () => {
    const lines = [
      `Hi ${v.first_name}, your Peabudy ID call is booked for ${v.call_time}.`,
      v.call_link.startsWith("https://") ? `Join the call: ${v.call_link}` : v.call_link,
      "It takes about 10 minutes on video. Have a photo ID with you, such as a passport, driving licence or national ID card.",
      "We look at your ID on the call. We don't record the call or keep a copy of your ID.",
    ];
    return { subject: `Your Peabudy ID call: ${v.call_time}`, text: lines.join("\n\n"), html: plainHtml("Your ID call is booked", lines) };
  });
}
