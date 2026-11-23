// HM-54: spot contact details in free text (bios now; maybe intros later). DETECTION ONLY:
// nothing calls this yet — whether a match blocks the save or only warns is the founder's
// decision. Pure and unit-tested (tests/contactDetails.unit.ts). Returns the kinds found,
// never the matched text, so callers can't log it by accident.

export type ContactKind = "phone" | "email" | "url" | "handle" | "messaging_app";

// Digits with optional spaces, dots, dashes or brackets between them ("0803 123 4567",
// "+44 (0)7700 900123"). Collapsed before matching.
const PHONE_CHUNK = /(?:\+|00)?\d(?:[\s().\-]{0,3}\d){8,15}/g;
// Nigerian: +234 / 234 / 0 then 7,8,9 then 0 or 1, then 8 digits. UK mobile: +44 / 0 then 7 + 9 digits.
// UK landline: 0 then 1/2/3 + 8–9 digits.
const PHONE_FORMS = [
  /^(?:\+?234|0)[789][01]\d{8}$/,
  /^(?:\+?44(?:0)?|0)7\d{9}$/,
  /^(?:\+?44(?:0)?|0)[123]\d{8,9}$/,
];
const EMAIL = /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\sat\s)\s*[a-z0-9-]+(?:\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[a-z]{2,})+/i;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|ng|co\.uk|uk|net|org|io|me|link|ly)\b(?:\/\S*)?|\bwa\.me\/?\S*|\bt\.me\/\S+/i;
const HANDLE = /(?:^|[\s(])@[a-z0-9_.]{3,30}\b/i;
const APPS = /\b(?:whats\s?app|watsapp|wassap|telegram|signal\s+me|cash\s?app|snap(?:chat)?|insta(?:gram)?|ig\s*:|dm\s+me|text\s+me|call\s+me)\b/i;

function hasPhone(text: string): boolean {
  for (const m of text.match(PHONE_CHUNK) ?? []) {
    const digits = m.replace(/[\s().\-]/g, "").replace(/^00/, "+");
    const norm = digits.replace(/^\+44\(?0\)?/, "+44");
    if (PHONE_FORMS.some((re) => re.test(norm))) return true;
  }
  return false;
}

export function findContactDetails(text: string | null | undefined): ContactKind[] {
  const t = String(text ?? "");
  if (!t.trim()) return [];
  const kinds: ContactKind[] = [];
  if (hasPhone(t)) kinds.push("phone");
  if (EMAIL.test(t)) kinds.push("email");
  if (URL.test(t)) kinds.push("url");
  if (HANDLE.test(t)) kinds.push("handle");
  if (APPS.test(t)) kinds.push("messaging_app");
  return kinds;
}

export function hasContactDetails(text: string | null | undefined): boolean {
  return findContactDetails(text).length > 0;
}
