import { Wordmark } from "@/components/brand/Logo";

// Back-office sign-in and password set-up (ENG-47). Deliberately unlike the user sign-in: an
// ink header with "Back office", no mascots, no "Apply" call to action. Anyone can open these
// pages; they never say whether an address is on the staff list.
export const metadata = { title: "Back office sign-in — Peabudy", robots: { index: false, follow: false } };

export default function StaffAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper" data-back-office="true">
      <header className="bg-ink text-cream">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Wordmark height={18} color="currentColor" />
          <span className="rounded-full border border-cream/40 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">Back office</span>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-8">{children}</main>
      <p className="mx-auto max-w-md px-4 pb-8 text-xs text-ink-500">
        For the Peabudy team only. Looking for your Peabudy account? <a className="underline" href="/signin">Sign in here</a>.
      </p>
    </div>
  );
}
