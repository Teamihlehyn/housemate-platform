// Beta "What's been checked" copy (ENG-04 / DES-02). Pure data, safe to import in client
// components. Beta never shows a number or the word "demo" for checks.

export type CheckStatus = "verified" | "pending" | "failed" | "not_provided";
export interface CheckItem {
  category: string;
  status: CheckStatus;
  checkedMonth: string | null; // "YYYY-MM"
}
export interface CheckRow {
  key: string;
  done: boolean;
  text: string;
}

export const CHECKS_DISCLAIMER = "Checks completed — not a guarantee of safety.";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "2026-11" → "November 2026". Parsed by hand so the viewer's time zone can't shift it.
export function monthLabel(ym: string | null | undefined): string | null {
  const m = /^([0-9]{4})-([0-9]{2})$/.exec(ym ?? "");
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : null;
}

// Rows for the checks card. `own` adds the not-done identity states for the person's own
// profile; another member's profile lists completed checks only.
// The phone row is hidden: staff approval can't yet record whether the phone was really
// confirmed on the call (DES-02, F-08), so we don't claim it.
export function checkRows(checks: CheckItem[], opts: { own: boolean }): CheckRow[] {
  const get = (c: string) => checks.find((x) => x.category === c);
  const rows: CheckRow[] = [];

  const email = get("email");
  if (email?.status === "verified") rows.push({ key: "email", done: true, text: "Email confirmed" });

  const id = get("identity");
  if (id?.status === "verified") {
    const month = monthLabel(id.checkedMonth);
    rows.push({ key: "identity", done: true, text: `Identity checked by the Peabudy team${month ? ` · ${month}` : ""}` });
  } else if (opts.own && id?.status === "failed") {
    rows.push({ key: "identity", done: false, text: "We couldn't complete your ID check. We'll email you about next steps." });
  } else if (opts.own) {
    rows.push({ key: "identity", done: false, text: "ID check not done yet. We'll email you to book a short video call." });
  }
  return rows;
}

export function identityChecked(checks: CheckItem[] | undefined): boolean {
  return !!checks?.some((c) => c.category === "identity" && c.status === "verified");
}
