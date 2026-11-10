import { fill } from "./render";
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
