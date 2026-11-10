import Link from "next/link";
import Logo from "@/components/brand/Logo";
import Pea, { PeaMood, PeaTone } from "@/components/brand/Pea";

// Shared frame for the small public pages (request access, invite, unsubscribe): logo bar,
// pastel wash, one readable column. Safe-area padding keeps content off the notch and home bar.
export default function PublicShell({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-pastel">
      <header className="border-b border-ink-100/70 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 py-2">
          <Logo size="sm" />
          {aside}
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-6 sm:pt-10">{children}</main>
    </div>
  );
}

/** Pea plus a speech bubble: the onboarding voice. Decorative mascot, the line is real text. */
export function PeaSays({
  children,
  mood = "awake",
  tone = "pea",
  friend,
}: {
  children: React.ReactNode;
  mood?: PeaMood;
  tone?: PeaTone;
  /** Show Bud beside Pea. */
  friend?: PeaMood;
}) {
  return (
    <div className="flex items-end gap-2.5">
      <div className="flex shrink-0 items-end -space-x-2" aria-hidden="true">
        <Pea size={52} mood={mood} tone={tone} blink={mood === "awake" || mood === "wow"} />
        {friend && <Pea size={40} mood={friend} tone="fresh" blink={friend === "awake"} />}
      </div>
      <p className="relative mb-2 min-w-0 rounded-panel rounded-bl-md bg-white px-4 py-2.5 text-body-sm font-medium text-ink ring-1 ring-ink-100">
        {children}
      </p>
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-[44px] items-center font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-800">
      {children}
    </Link>
  );
}
