import { Fragment, ReactNode } from "react";
import Link from "next/link";
import { PLACEHOLDER } from "./source";

// A deliberately small Markdown renderer for the legal drafts (ENG-25): headings, paragraphs,
// bullet and numbered lists, tables, blockquotes, **bold**, *italic*, `code` and links.
// No raw HTML is ever rendered; everything is React text. Placeholders are highlighted.

type Block =
  | { t: "h"; level: number; text: string }
  | { t: "p"; text: string }
  | { t: "ul" | "ol"; items: string[] }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "quote"; text: string };

export function parseBlocks(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) { blocks.push({ t: "h", level: h[1].length, text: h[2] }); i++; continue; }
    if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const head = cells(l);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push({ t: "table", head, rows });
      continue;
    }
    if (/^>/.test(l)) {
      const q: string[] = [];
      while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push({ t: "quote", text: q.join(" ").trim() });
      continue;
    }
    const list = /^\s*([-*]|\d+\.)\s+/.exec(l);
    if (list) {
      const ordered = /\d/.test(list[1]);
      const items: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        const m = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (m) items.push(m[2]);
        else items[items.length - 1] += " " + lines[i].trim();
        i++;
      }
      blocks.push({ t: ordered ? "ol" : "ul", items });
      continue;
    }
    const p: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|\s*\||\s*([-*]|\d+\.)\s)/.test(lines[i])) p.push(lines[i++].trim());
    blocks.push({ t: "p", text: p.join(" ") });
  }
  return blocks;
}

// Only same-site paths (not protocol-relative "//host"), https and mailto links.
export function safeHref(href: string): string {
  return /^(\/(?!\/)|https:\/\/|mailto:)/.test(href) && !/\\/.test(href) ? href : "#";
}

// Inline: links, bold, italic, code, placeholders. Nested emphasis is handled by recursion.
export function inline(text: string, key = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(...placeholders(text.slice(last, m.index), `${key}-${n++}`));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined) {
      const href = m[2];
      const safe = safeHref(href);
      out.push(
        safe.startsWith("/")
          ? <Link key={k} href={safe} className="text-brand-700 underline underline-offset-2">{inline(m[1], k)}</Link>
          : <a key={k} href={safe} className="text-brand-700 underline underline-offset-2" rel="noopener noreferrer">{inline(m[1], k)}</a>
      );
    } else if (m[3] !== undefined) out.push(<strong key={k} className="font-semibold text-ink">{inline(m[3], k)}</strong>);
    else if (m[4] !== undefined) out.push(<em key={k}>{inline(m[4], k)}</em>);
    else out.push(<code key={k} className="rounded bg-ink/5 px-1 text-[0.9em]">{m[5]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...placeholders(text.slice(last), `${key}-${n++}`));
  return out;
}

function placeholders(text: string, key: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(PLACEHOLDER)) {
    if (m.index! > last) parts.push(<Fragment key={`${key}-t${n++}`}>{text.slice(last, m.index)}</Fragment>);
    parts.push(
      <mark key={`${key}-p${n++}`} className="rounded bg-amber-100 px-1 text-amber-900" title="Not filled in yet">{m[0]}</mark>
    );
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(<Fragment key={`${key}-t${n++}`}>{text.slice(last)}</Fragment>);
  return parts;
}

export default function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-4 text-ink/80">
      {parseBlocks(source).map((b, i) => {
        const k = `b${i}`;
        switch (b.t) {
          case "h":
            if (b.level === 1) return <h1 key={k} className="font-display text-3xl font-normal tracking-tightest text-ink">{inline(b.text, k)}</h1>;
            if (b.level === 2) return <h2 key={k} className="pt-4 text-lg font-semibold text-ink">{inline(b.text, k)}</h2>;
            return <h3 key={k} className="pt-2 font-semibold text-ink">{inline(b.text, k)}</h3>;
          case "p":
            return <p key={k}>{inline(b.text, k)}</p>;
          case "ul":
          case "ol": {
            const L = b.t === "ul" ? "ul" : "ol";
            return (
              <L key={k} className={`space-y-1.5 pl-5 ${b.t === "ul" ? "list-disc" : "list-decimal"}`}>
                {b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}
              </L>
            );
          }
          case "table":
            return (
              <div key={k} className="overflow-x-auto rounded-xl border border-ink/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-cream text-ink">
                    <tr>{b.head.map((c, j) => <th key={j} scope="col" className="px-3 py-2 font-semibold">{inline(c, `${k}-h${j}`)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-t border-ink/10 align-top">
                        {r.map((c, x) => <td key={x} className="px-3 py-2">{inline(c, `${k}-${j}-${x}`)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "quote":
            return <blockquote key={k} className="border-l-4 border-ink/15 pl-4 text-ink/70">{inline(b.text, k)}</blockquote>;
        }
      })}
    </div>
  );
}
