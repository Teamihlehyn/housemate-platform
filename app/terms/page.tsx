import Link from "next/link";
import Logo from "@/components/brand/Logo";
import { IS_BETA } from "@/lib/env";
import { FeedbackLink } from "@/components/ResearchTools";

export const metadata = { title: "Terms of use — Peabudy" };

export default function Terms() {
  const sections: [string, string][] = [
    [
      "What Peabudy is",
      IS_BETA
        ? "An early-access service for finding compatible housemates and agreeing how you'll live together. Identity is checked by our team; property listings and viewings are guided examples."
        : "A prototype for testing an idea: finding compatible housemates and agreeing how you'll live together. All people, checks and homes inside are samples.",
    ],
    ["No bookings, payments or tenancies", "Nothing here reserves a home, takes money or creates a tenancy. An accepted application is a demo, and your household agreement is a record of what you both said — not a legal contract."],
    ["Using it responsibly", "Be respectful, don't impersonate anyone, don't ask anyone for money, and don't share other people's personal details. We may remove accounts that break these rules."],
    ["Your content and feedback", "You own what you write. By sending feedback or taking part in research, you let us use your anonymised answers to improve Peabudy. We won't publish anything that identifies you without asking."],
    ["Safety", "A verification score shows which checks are complete — it is never a guarantee that someone is safe. Support here is not an emergency service; if anyone is in danger, contact local emergency services."],
    ["No warranty", "This is an early version provided as-is. Features may change, break or disappear, and data in the test environment may be reset."],
    ["Your data", "How we handle personal data is explained in the privacy notice."],
  ];
  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Logo size="sm" />
          <Link href="/signin" className="btn-primary">Get started</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-normal tracking-tightest text-ink">Terms of use</h1>
        <p className="mt-2 text-sm text-ink/50">Plain-language terms for this early version</p>
        <div className="mt-8 space-y-6">
          {sections.map(([t, d]) => (
            <section key={t}>
              <h2 className="font-semibold text-ink">{t}</h2>
              <p className="mt-1.5 text-ink/70">
                {d}
                {t === "Your data" && <> See the <Link href="/privacy" className="text-brand-700 underline underline-offset-2">privacy notice</Link>.</>}
              </p>
            </section>
          ))}
        </div>
        <p className="mt-10 text-sm text-ink/60">
          Questions? <FeedbackLink className="font-medium text-brand-700 underline underline-offset-2">Send us a message</FeedbackLink>.
        </p>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This is a starting draft for the test phase and should be reviewed with legal advice before a public launch.
        </div>
      </main>
    </div>
  );
}
