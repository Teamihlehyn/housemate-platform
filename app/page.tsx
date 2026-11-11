import Link from "next/link";
import { BANNER, IS_BETA } from "@/lib/env";
import { FeedbackLink } from "@/components/ResearchTools";
import Logo from "@/components/brand/Logo";
import Pea from "@/components/brand/Pea";
import HeroScene from "@/components/landing/HeroScene";
import HowItWorks from "@/components/landing/HowItWorks";
import WakeThePod from "@/components/landing/WakeThePod";
import CitySwitch from "@/components/landing/CitySwitch";
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
  const trust = [
    {
      Icon: IconShield,
      t: "Evidence, never guarantees",
      d: IS_BETA
        ? "We show which checks someone has completed. It's never a promise that they're safe."
        : "Profiles show which checks are complete. In this test every check is a demo, and it's never a promise that someone is safe.",
    },
    {
      Icon: IconLock,
      t: "Private by default",
      d: "Your gender, email, phone and exact address never appear on your profile. People you match with see your areas and budget range.",
    },
    {
      Icon: IconWallet,
      t: "No money through Peabudy",
      d: IS_BETA
        ? "We never take payments or deposits, and your agreement isn't a tenancy. Never pay anyone before you've seen a home in person."
        : "No payments, deposits or real bookings. Your agreement isn't a tenancy, and the rental step is a demo: no home is reserved.",
    },
    {
      Icon: IconCheck,
      t: "Report and block, one tap away",
      d: "Blocking is instant and the other person isn't told. Reports never change anyone's checks.",
    },
  ];

  return (
    <div className="min-h-screen overflow-x-clip font-sans">
      {/* Nav */}
      <header className="sticky top-[var(--banner-h,33px)] z-40 border-b border-ink-100/70 bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Logo size="sm" />
          <nav className="hidden items-center gap-1 text-sm font-semibold text-ink-700 md:flex" aria-label="Sections">
            <a href="#how" className="inline-flex min-h-[44px] items-center rounded-full px-3 hover:bg-ink-50">How it works</a>
            <a href="#habits" className="inline-flex min-h-[44px] items-center rounded-full px-3 hover:bg-ink-50">What we match on</a>
            <a href="#cities" className="inline-flex min-h-[44px] items-center rounded-full px-3 hover:bg-ink-50">London &amp; Lagos</a>
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

      {/* Hero */}
      <section className="bg-pastel">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-6 md:grid-cols-[1.05fr_1fr] md:gap-12 md:pb-20 md:pt-16">
          <div className="text-center md:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-white px-3.5 py-1.5 text-sm font-semibold text-ink">
              <span className="h-2 w-2 rounded-full bg-pea-500" aria-hidden="true" />
              {IS_BETA ? "Now opening in Lagos, by application" : "Testing now in London and Lagos"}
            </span>
            <h1 className="mt-5 font-display text-display-xl text-ink md:text-display-xl-md">
              Two peas.
              <br />
              One home.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-body-lg text-ink-700 md:mx-0">
              Peabudy finds people whose move-in dates, budget, areas and living habits fit yours. Then it helps
              you both agree rent, bills and notice in writing, before anyone moves in.
            </p>
            <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center md:justify-start">
              <Link href={IS_BETA ? "/join" : "/signin"} className="btn-primary btn-lg">
                {IS_BETA ? "Apply to join" : "Get started"} <IconArrowRight size={18} />
              </Link>
              <a href="#how" className="btn-secondary btn-lg">See how it works</a>
            </div>
            {IS_BETA && (
              <p className="mt-3 text-sm text-ink-700">
                Every application is reviewed by a person, with a short video ID call. Already approved?{" "}
                <Link href="/signin" className="inline-flex min-h-[44px] items-center font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-800">
                  sign in
                </Link>
              </p>
            )}
            <p className="mt-4 text-sm text-ink-600">No swiping. No compatibility scores. Just plans that fit.</p>
          </div>
          <div className="order-first md:order-last"><HeroScene /></div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-14 md:py-20">
        <SectionHead
          eyebrow="How it works"
          title={IS_BETA ? "From first hello to a written agreement" : "From first hello to moving day"}
          body="One journey, and both of you agree at every step that matters."
        />
        <div className="mt-8">
          <HowItWorks isBeta={IS_BETA} />
        </div>
      </section>

      {/* What we match on */}
      <section id="habits" className="scroll-mt-28 bg-pastel-soft py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHead
            center
            eyebrow="What we match on"
            title="Matched on how you actually live"
            body="Dates, budget, areas and stay length first. Then six living habits. Every rule works both ways, and every match tells you why."
          />
          <div className="mt-8">
            <WakeThePod />
          </div>
        </div>
      </section>

      {/* Cities */}
      <section id="cities" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-14 md:py-20">
        <SectionHead
          eyebrow="London & Lagos"
          title="Built for how each city rents"
          body="Pounds and monthly rent in London. Naira and yearly rent in Lagos, with a fair monthly equivalent."
        />
        <div className="mt-8">
          <CitySwitch />
        </div>
      </section>

      {/* Trust */}
      <section className="mx-auto max-w-6xl px-4 pb-14 md:pb-20">
        <div className="grid items-start gap-8 rounded-sheet bg-white p-5 ring-1 ring-ink-100 sm:p-10 md:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHead eyebrow="Trust, shown honestly" title="See what's been checked. Decide for yourself." />
            <div className="mt-6">
              <ChecksMock isBeta={IS_BETA} />
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {trust.map(({ Icon, t, d }) => (
              <li key={t} className="rounded-card bg-cream p-5">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-pea-100 text-ink" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <h3 className="mt-3 text-h3 text-ink">{t}</h3>
                <p className="mt-1.5 text-sm text-ink-700">{d}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-5 text-center">
          <Link href="/safety" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-800">
            Read how we approach safety <IconArrowRight size={16} />
          </Link>
        </p>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-20">
        <div className="relative overflow-hidden rounded-sheet bg-ink px-6 pb-12 pt-10 text-center text-cream sm:py-16">
          <div className="flex justify-center gap-1" aria-hidden="true">
            <Pea size={64} mood="happy" className="animate-bob" />
            <Pea size={64} mood="wink" tone="fresh" className="animate-bob-slow" />
          </div>
          <h2 className="mx-auto mt-5 max-w-2xl font-display text-display text-cream md:text-display-md">Find your other pea</h2>
          <p className="mx-auto mt-3 max-w-lg text-cream/80">
            {IS_BETA
              ? "We're starting small in Lagos. Apply with your plans and living habits, have a short video ID call with our team, and we'll email your invite once you're approved."
              : "Enter any email and your code appears on screen, or try a demo persona in one click."}
          </p>
          <Link href={IS_BETA ? "/join" : "/signin"} className="btn btn-lg mt-7 bg-cream text-ink hover:bg-white focus-visible:ring-cream focus-visible:ring-offset-ink">
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
