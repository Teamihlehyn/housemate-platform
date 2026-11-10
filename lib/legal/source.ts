import { readFileSync } from "fs";
import path from "path";

// The interim legal text (ENG-25) lives in docs/product/beta/legal/ and is owned by the
// product manager and the founder's reviewer. Pages read it at build time. Internal parts
// are removed before rendering: the leading "Draft written by AI" banner and every
// "Note:" block for the founder and counsel. [BRACKETED CAPITALS] placeholders stay
// visible on purpose until the reviewer fills them (founder decision, 10 Nov).
export type LegalDoc = "privacy-notice" | "terms";

export function legalPath(doc: LegalDoc): string {
  return path.join(process.cwd(), "docs", "product", "beta", "legal", `${doc}.md`);
}

export function readLegal(doc: LegalDoc): string {
  return stripInternal(readFileSync(legalPath(doc), "utf8"));
}

export function stripInternal(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  // Everything before the first "# " heading is the drafting banner.
  const start = lines.findIndex((l) => /^# /.test(l));
  const body = start >= 0 ? lines.slice(start) : lines;
  const out: string[] = [];
  for (let i = 0; i < body.length; i++) {
    if (/^>\s*\*?Note:/.test(body[i])) {
      while (i + 1 < body.length && /^>/.test(body[i + 1])) i++;
      continue;
    }
    out.push(body[i]);
  }
  return out.join("\n");
}

// "[CONTROLLER NAME]", "[DATE]", "[FROM DIDIT GO-LIVE, about 27 Nov…]" — square brackets
// opening with two or more capitals or digits ("[30] days"), and not a Markdown link.
export const PLACEHOLDER = /\[[A-Z0-9][A-Z0-9_/-]+[^\]]*\](?!\()/g;

export function placeholdersIn(md: string): string[] {
  return [...new Set([...md.matchAll(PLACEHOLDER)].map((m) => m[0]))];
}
