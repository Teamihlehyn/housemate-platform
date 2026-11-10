import Link from "next/link";
import { CHECKS_DISCLAIMER, CheckItem, checkRows } from "@/lib/checks";
import { IconCheck } from "@/components/icons";

// Beta: "What's been checked" (ENG-04 / DES-02). A list of completed checks, never a score.
export function ChecksCard({ checks, own, as: Heading = "h2" }: { checks: CheckItem[]; own: boolean; as?: "h2" | "h3" }) {
  const rows = checkRows(checks, { own });
  return (
    <section className="card mt-4 p-6" aria-label="What's been checked">
      <Heading className="font-semibold text-ink">What&apos;s been checked</Heading>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="flex items-start gap-2 border-b border-ink-100 pb-2">
            {r.done ? (
              <IconCheck size={18} strokeWidth={2.5} className="mt-0.5 shrink-0 text-brand-600" />
            ) : (
              <span aria-hidden="true" className="mt-0.5 w-[18px] shrink-0 text-center text-ink-500">—</span>
            )}
            <span className={r.done ? "text-ink" : "text-ink-600"}>
              <span className="sr-only">{r.done ? "Done: " : "Not done: "}</span>
              {r.text}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-600">{CHECKS_DISCLAIMER}</p>
      <Link href="/safety" className="mt-2 inline-flex min-h-[44px] items-center text-sm font-medium text-brand-700 underline underline-offset-2">
        How we check identity
      </Link>
    </section>
  );
}

// Compact form: one "ID checked" chip, icon plus text (never colour alone).
export function IdCheckedChip({ className = "" }: { className?: string }) {
  return (
    <span className={`chip bg-brand-100 text-brand-800 ${className}`}>
      <IconCheck size={14} strokeWidth={2.5} />
      ID checked
    </span>
  );
}
