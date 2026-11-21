import Link from "next/link";
import { BANNER, IS_BETA } from "@/lib/env";
import { FeedbackLink } from "@/components/ResearchTools";
import Logo from "@/components/brand/Logo";
import Pea from "@/components/brand/Pea";
import HeroCities from "@/components/landing/HeroCities";
import { AgreementCard, MatchCard, StepCards } from "@/components/landing/StoryCards";
import { IconArrowRight, IconCheck, IconLock, IconShield, IconWallet } from "@/components/icons";

/* ---------------------------------- bits ---------------------------------- */

function SectionHead({ eyebrow, title, body, center = false }: { eyebrow: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-caption font-semibold uppercase tracking-wide text-brand-700">{eyebrow}</p>
      <h2 className="mt-2 font-display text-display text-ink md:text-display-md">{title}</h2>
      {body && <p className="mt-3 text-body-lg text-ink-700">{body}</p>}
    </div>
  );
}

function ChecksMock({ isBeta }: { isBeta: boolean }) {
  const rows = isBeta
    ? [
        { k: "Email", v: "Confirmed", done: true },
        { k: "Identity", v: "Checked by our team", done: true },
        { k: "Reference", v: "Not checked", done: false },
      ]
    : [
        { k: "Email", v: "Confirmed", done: true },
        { k: "Identity", v: "Demo verified", done: true },
        { k: "Phone", v: "Demo verified", done: true },
        { k: "Reference", v: "Not checked", done: false },
      ];
  return (
    <div className="rounded-card bg-white p-5 ring-1 ring-ink-100">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-ink">What&apos;s been checked</p>
        <span className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-700">Example</span>
      </div>
      <ul className="mt-3 divide-y divide-ink-100">
        {rows.map((r) => (
          <li key={r.k} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="flex items-center gap-2 text-ink">
              <span
                aria-hidden="true"
                className={`grid h-5 w-5 place-items-center rounded-full ${r.done ? "bg-brand-600 text-white" : "border-2 border-ink-400"}`}
              >
                {r.done && <IconCheck size={13} strokeWidth={3} />}
              </span>
              {r.k}
            </span>
            <span className={r.done ? "font-semibold text-brand-800" : "text-ink-600"}>{r.v}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-field bg-cream px-3 py-2 text-sm font-medium text-ink-700">Checks completed — not a guarantee of safety.</p>
    </div>
  );
}

/* ---------------------------------- page ---------------------------------- */

export default function Landing() {
  // Short on purpose: a title and one line each (founder, 21 Nov: let the visuals talk).
  const trust = [
    { Icon: IconShield, t: "Checked, never guaranteed", d: "We show what was checked. Never a promise of safety." },
    { Icon: IconLock, t: "Private by default", d: "Gender, contact details and address stay hidden." },
    { Icon: IconWallet, t: "No money through us", d: IS_BETA ? "Never pay before seeing a home." : "No payments or real bookings." },
    { Icon: IconCheck, t: "Report and block", d: "One tap, and they aren't told." },
  ];

  return (
    <div className="min-h-screen overflow-x-clip font-sans">
      {/* Nav */}
      <header className="sticky top-[var(--banner-h,33px)] z-40 border-b border-ink-100/70 bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Logo size="sm" />
          <nav className="hidden items-center gap-1 text-sm font-semibold text-ink-700 lg:flex" aria-label="Sections">
            <a href="#how" className="inline-flex min-h-[44px] items-center rounded-full px-3 hover:bg-ink-50">How it works</a>
            <a href="#habits" className="inline-flex min-h-[44px] items-center rounded-full px-3 hover:bg-ink-50">What we match on</a>
            <Link href="/safety" className="inline-flex min-h-[44px] items-center rounded-full px-3 hover:bg-ink-50">Safety</Link>
          </nav>
          <div className="flex items-center gap-1">
            <Link href="/signin" className={`btn-ghost px-3 sm:px-4 ${IS_BETA ? "" : "hidden sm:inline-flex"}`}>
              Sign in
            </Link>
            <Link href={IS_BETA ? "/join" : "/signin"} className="btn-primary whitespace-nowrap px-4 sm:px-5">
              {IS_BETA ? <><span className="min-[360px]:hidden">Apply</span><span className="hidden min-[360px]:inline">Apply to join</span></> : "Get started"}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero (DES-27b): "Find flatmates in [Lagos → London → every city]" with the photo in step. */}
      <HeroCities isBeta={IS_BETA} />

      {/* How it works: illustrated steps, no paragraphs */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-12 md:py-16">
        <SectionHead eyebrow="How it works" title="Four steps to a flatmate" />
        <div className="mt-6">
          <StepCards callStep={IS_BETA} />
        </div>
      </section>

      {/* Matching and the money, shown not told */}
      <section id="habits" className="scroll-mt-28 bg-pastel-soft py-12 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-2">
          <div>
            <SectionHead eyebrow="What we match on" title="Every match says why" body="Dates, area, budget and six living habits." />
            <div className="mt-5"><MatchCard /></div>
          </div>
          <div>
            <SectionHead eyebrow="Before anyone moves in" title="Agree the rent split" body="In writing, in naira, both of you." />
            <div className="mt-5"><AgreementCard /></div>
          </div>
        </div>
      </section>

      {/* Trust: one visual and four short tiles */}
      <section className="mx-auto max-w-6xl px-4 pb-12 md:pb-16">
        <div className="grid items-start gap-6 rounded-sheet bg-white p-5 ring-1 ring-ink-100 sm:p-8 md:grid-cols-[1fr_1.1fr] md:gap-8">
          <div>
            <SectionHead eyebrow="Trust" title="See what's been checked" />
            <div className="mt-5"><ChecksMock isBeta={IS_BETA} /></div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {trust.map(({ Icon, t, d }) => (
              <li key={t} className="rounded-card bg-cream p-4">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-pea-100 text-ink" aria-hidden="true"><Icon size={20} /></span>
                <h3 className="mt-2 text-h3 text-ink">{t}</h3>
                <p className="mt-0.5 text-sm text-ink-700">{d}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-center">
          <Link href="/safety" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-800">
            How we approach safety <IconArrowRight size={16} />
          </Link>
        </p>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-20">
        <div className="relative overflow-hidden rounded-sheet bg-ink px-6 pb-10 pt-8 text-center text-cream sm:py-14">
          <div className="flex justify-center gap-1" aria-hidden="true">
            <Pea size={64} mood="happy" className="animate-bob" />
            <Pea size={64} mood="wink" tone="fresh" className="animate-bob-slow" />
          </div>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-display text-cream md:text-display-md">Find your flatmate</h2>
          <Link href={IS_BETA ? "/join" : "/signin"} className="btn btn-lg mt-6 bg-cream text-ink hover:bg-white focus-visible:ring-cream focus-visible:ring-offset-ink">
            {IS_BETA ? "Apply to join" : "Get started"} <IconArrowRight size={18} />
          </Link>
          {IS_BETA && (
            <p className="mt-3 text-sm text-cream/80">
              Already approved?{" "}
              <Link href="/signin" className="inline-flex min-h-[44px] items-center font-semibold text-cream underline underline-offset-4">Sign in</Link>
            </p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-100 bg-cream">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-ink-600 sm:flex-row">
          <Logo size="sm" />
          <nav className="flex flex-wrap justify-center gap-x-1 gap-y-1" aria-label="Footer">
            <Link href="/safety" className="inline-flex min-h-[44px] items-center rounded-full px-3 hover:text-ink">Safety</Link>
            <Link href="/privacy" className="inline-flex min-h-[44px] items-center rounded-full px-3 hover:text-ink">Privacy</Link>
            <Link href="/terms" className="inline-flex min-h-[44px] items-center rounded-full px-3 hover:text-ink">Terms</Link>
            <FeedbackLink className="inline-flex min-h-[44px] items-center rounded-full px-3 hover:text-ink">Give feedback</FeedbackLink>
          </nav>
        </div>
        {BANNER && <p className="px-4 pb-8 text-center text-xs text-ink-600">{BANNER}</p>}
        {/* Room for the floating Feedback pill on phones, so it never sits on the footer links. */}
        <div className="h-[calc(env(safe-area-inset-bottom)+64px)]" aria-hidden="true" />
      </footer>
    </div>
  );
}
