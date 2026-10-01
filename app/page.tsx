import Link from "next/link";
import { BANNER, IS_BETA } from "@/lib/env";

/* ---------------------------------- bits ---------------------------------- */

function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 font-display text-xl font-semibold tracking-tightest text-ink ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">H</span>
      Housemate
    </Link>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-1.5 text-sm font-medium text-ink shadow-sm">
      {children}
    </span>
  );
}

function CtaPrimary({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Link
      href="/signin"
      className={`inline-flex min-h-[52px] items-center justify-center rounded-full bg-ink px-7 text-base font-medium text-cream transition hover:bg-black ${className}`}
    >
      {children}
    </Link>
  );
}

function CtaSecondary({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-ink/15 bg-white px-7 text-base font-medium text-ink transition hover:bg-ink/5"
    >
      {children}
    </Link>
  );
}

/* --------------------------------- mockups -------------------------------- */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[300px] max-w-full">
      <div className="rounded-[2.8rem] border border-ink/10 bg-white p-3 shadow-[0_30px_80px_-30px_rgba(35,34,30,0.45)]">
        <div className="relative overflow-hidden rounded-[2.1rem] bg-cream">
          <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-ink/90" />
          {children}
        </div>
      </div>
    </div>
  );
}

function MatchCardMock() {
  return (
    <div className="px-4 pb-5 pt-10">
      <p className="text-center text-xs font-medium text-ink/40">Discover</p>
      <div className="mt-3 rounded-3xl border border-ink/10 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-100 font-semibold text-brand-700">BC</span>
            <div>
              <p className="font-semibold text-ink">Ben Carter</p>
              <p className="text-xs text-ink/50">Hackney · Camden</p>
            </div>
          </div>
          <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-800">Demo 80</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/60">
          <span>£850–1,150/mo</span>
          <span>· 1 Nov – 10 Dec</span>
        </div>
        <ul className="mt-3 space-y-1.5 text-xs text-ink/70">
          <li className="flex gap-1.5"><span className="text-brand-600">✓</span> Shared move-in window (40 days)</li>
          <li className="flex gap-1.5"><span className="text-brand-600">✓</span> Both want Hackney</li>
          <li className="flex gap-1.5"><span className="text-brand-600">✓</span> Same answer on quiet weeknights</li>
        </ul>
        <div className="mt-4 flex gap-2">
          <span className="flex-1 rounded-full border border-ink/15 py-2 text-center text-xs font-medium text-ink">Profile</span>
          <span className="flex-1 rounded-full bg-ink py-2 text-center text-xs font-medium text-cream">Introduce</span>
        </div>
      </div>
      <p className="mt-4 text-center text-xs font-medium text-ink/40 animate-shimmer">Finding people who fit your dates…</p>
    </div>
  );
}

function FloatingChip({ className = "", dot, label, value }: { className?: string; dot: string; label: string; value: string }) {
  return (
    <div className={`absolute hidden items-center gap-2 rounded-2xl border border-ink/10 bg-white/90 px-3 py-2 shadow-lg backdrop-blur sm:flex ${className}`}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
      <div className="leading-tight">
        <p className="text-[10px] font-medium uppercase tracking-wide text-ink/40">{label}</p>
        <p className="text-sm font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}

/* ---------------------------------- data ---------------------------------- */

const MATCH_CHIPS = [
  { label: "Move-in dates", dot: "#45b87c" },
  { label: "Budget", dot: "#e4a33a" },
  { label: "Areas", dot: "#5b8fd6" },
  { label: "Cleaning", dot: "#8b7bd6" },
  { label: "Quiet hours", dot: "#ff90b8" },
  { label: "Overnight guests", dot: "#45b87c" },
  { label: "Pets", dot: "#e4a33a" },
  { label: "Smoking", dot: "#5b8fd6" },
  { label: "Social vibe", dot: "#8b7bd6" },
  { label: "Stay length", dot: "#ff90b8" },
];

const AREAS_ROW_1 = ["Hackney", "Islington", "Camden", "Lewisham", "Walthamstow", "Brixton"];
const AREAS_ROW_2 = ["Yaba", "Lekki", "Ikeja", "Surulere", "Gbagada", "Ikoyi"];

const STAGES = [
  { n: "01", t: "Introduce", d: "Send a short intro to someone whose dates and habits fit." },
  { n: "02", t: "Chat", d: "Message privately and arrange a quick video meet." },
  { n: "03", t: "Household", d: "Agree a plan together — dates, budget split, stay length." },
  { n: "04", t: "Shortlist & view", d: "Add sample homes, vote, and book a viewing." },
  { n: "05", t: "Move in", d: "Complete a demo handoff and confirm your move-in." },
];

const TRUST = [
  { t: "Grounded in research", d: "Built on housing research across the UK and Nigeria — explicit dates, verified evidence and household coordination, not another listings feed." },
  { t: "Evidence, never guarantees", d: "The credibility score shows which checks are complete, always beside the breakdown. It is never a promise that someone is safe." },
  { t: "Private by default", d: "Legal identity, contacts and exact addresses never appear on profile cards. Precise location is never shown on a map." },
  { t: "No real money", d: "No payments, deposits or binding agreements. The rental handoff is a demo — no home is reserved." },
];

const SCENARIOS = [
  { who: "Two students, London", quote: "We matched on the exact same move-in week and both wanted Hackney. Forming a household before we even found a flat just made sense.", tag: "Find together" },
  { who: "Relocating professional, Lagos", quote: "It showed the annual rent as a monthly equivalent and spelled out the agency and caution fees up front. No surprises.", tag: "Candidate home" },
  { who: "Room host, Lekki", quote: "I offered my spare room, authority got reviewed, and the address only unlocked once we'd both agreed a viewing.", tag: "Existing room" },
];

/* ---------------------------------- page ---------------------------------- */

export default function Landing() {
  return (
    <div className="min-h-screen font-sans">
      {/* Nav */}
      <header className="sticky top-8 z-40 border-b border-ink/5 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-medium text-ink/70 sm:flex">
            <Link href="/#how" className="hover:text-ink">How it works</Link>
            <Link href="/#match" className="hover:text-ink">What we match on</Link>
            <Link href="/safety" className="hover:text-ink">Safety</Link>
          </nav>
          <CtaPrimary className="!min-h-[44px] px-5 text-sm">Get started</CtaPrimary>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-10 pt-14 text-center sm:pt-20">
        <div className="flex justify-center">
          <Pill>
            <span className="text-brand-600">✦</span> London &amp; Lagos pilots
          </Pill>
        </div>
        <h1 className="mx-auto mt-7 max-w-4xl font-display text-[2.7rem] font-normal leading-[0.98] tracking-tightest text-ink sm:text-6xl md:text-7xl">
          Find people whose
          <br className="hidden sm:block" /> plans fit yours
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink/60">
          Match on real living preferences and exact move-in dates, see what&apos;s been verified, and
          organise a shared home — all the way to moving day.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <CtaPrimary>Start your search</CtaPrimary>
          <CtaSecondary href="/#how">See how it works</CtaSecondary>
        </div>

        {/* Hero mockup */}
        <div className="relative mx-auto mt-14 max-w-xl">
          <FloatingChip className="-left-2 top-10 md:-left-10" dot="#45b87c" label="Dates" value="40-day overlap" />
          <FloatingChip className="-right-2 top-24 md:-right-12" dot="#e4a33a" label="Budget" value="£850–1,150" />
          <FloatingChip className="-left-4 bottom-10 md:-left-16" dot="#5b8fd6" label="Verified" value="Demo 80/100" />
          <PhoneFrame>
            <MatchCardMock />
          </PhoneFrame>
        </div>
      </section>

      {/* What we match on */}
      <section id="match" className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-5xl bg-white p-8 shadow-sm ring-1 ring-ink/5 sm:p-14">
          <div className="flex flex-wrap justify-center gap-3">
            {MATCH_CHIPS.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-cream px-4 py-2 text-sm font-medium text-ink">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.dot }} />
                {c.label}
              </span>
            ))}
          </div>
          <h2 className="mx-auto mt-10 max-w-2xl text-center font-display text-3xl font-normal leading-tight tracking-tightest text-ink sm:text-4xl">
            Matched on what actually matters
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-ink/60">
            A deterministic, explainable match — overlapping dates, shared areas, compatible habits and
            budgets. No swiping, no mystery algorithm, no compatibility percentage dressed up as science.
          </p>
        </div>
      </section>

      {/* Two-up features */}
      <section className="mx-auto grid max-w-6xl gap-5 px-4 md:grid-cols-2">
        {/* Reasons */}
        <div className="rounded-4xl bg-white p-8 shadow-sm ring-1 ring-ink/5">
          <div className="rounded-3xl bg-cream p-5">
            <p className="text-xs font-medium text-ink/40">Why you match</p>
            <ul className="mt-3 space-y-2.5 text-sm">
              {["Shared move-in window: 1 Nov → 10 Dec (40 days)", "Both want to live in Hackney", "Same answer on “Quiet before 10pm”"].map((r) => (
                <li key={r} className="flex items-start gap-2 rounded-2xl bg-white px-3 py-2.5 text-ink/80 ring-1 ring-ink/5">
                  <span className="mt-0.5 text-brand-600">✓</span> {r}
                </li>
              ))}
              <li className="flex items-start gap-2 rounded-2xl bg-white px-3 py-2.5 text-ink/50 ring-1 ring-ink/5">
                <span className="mt-0.5">💬</span> Discuss: overnight guests
              </li>
            </ul>
          </div>
          <h3 className="mt-7 font-display text-2xl font-normal tracking-tightest text-ink">See exactly why you match</h3>
          <p className="mt-2 text-ink/60">Every recommendation explains itself — the dates, the areas, the habits you share, and the topics worth talking through.</p>
        </div>

        {/* Credibility */}
        <div className="rounded-4xl bg-white p-8 shadow-sm ring-1 ring-ink/5">
          <div className="rounded-3xl bg-cream p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-ink/40">Demo credibility</p>
                <p className="font-display text-4xl font-normal tracking-tightest text-ink">80<span className="text-xl text-ink/30">/100</span></p>
              </div>
              <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">Demo verified</span>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm">
              {[["Identity", "40 / 40"], ["Email", "10 / 10"], ["Phone", "10 / 10"], ["Reference", "20 / 20"], ["Additional evidence", "0 / 20"]].map(([k, v]) => (
                <li key={k} className="flex justify-between border-b border-ink/5 pb-1.5 text-ink/60">
                  <span>{k}</span><span className="font-medium text-ink">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <h3 className="mt-7 font-display text-2xl font-normal tracking-tightest text-ink">Trust, shown honestly</h3>
          <p className="mt-2 text-ink/60">A transparent score with the full evidence breakdown. &ldquo;Checks completed — not a guarantee of safety.&rdquo;</p>
        </div>
      </section>

      {/* Timeline / how it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="max-w-2xl font-display text-3xl font-normal leading-tight tracking-tightest text-ink sm:text-5xl">
          From first hello
          <br /> to moving day
        </h2>
        <p className="mt-4 max-w-xl text-ink/60">One organised journey, with both people agreeing at every step that matters.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STAGES.map((s) => (
            <div key={s.n} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink/5">
              <span className="font-display text-sm font-medium text-brand-600">{s.n}</span>
              <h3 className="mt-3 text-lg font-semibold text-ink">{s.t}</h3>
              <p className="mt-1.5 text-sm text-ink/60">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Areas marquee */}
      <section className="py-8">
        <p className="mb-6 text-center text-sm font-medium uppercase tracking-wide text-ink/40">Seeded neighbourhoods across both pilots</p>
        <div className="marquee-mask space-y-3 overflow-hidden">
          <div className="flex w-max animate-marquee gap-3">
            {[...AREAS_ROW_1, ...AREAS_ROW_1, ...AREAS_ROW_1].map((a, i) => (
              <span key={`${a}-${i}`} className="rounded-full border border-ink/10 bg-white px-5 py-2.5 text-sm font-medium text-ink/70">{a}</span>
            ))}
          </div>
          <div className="flex w-max animate-marquee-slow gap-3" style={{ animationDirection: "reverse" }}>
            {[...AREAS_ROW_2, ...AREAS_ROW_2, ...AREAS_ROW_2].map((a, i) => (
              <span key={`${a}-${i}`} className="rounded-full border border-ink/10 bg-white px-5 py-2.5 text-sm font-medium text-ink/70">{a}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / built honestly */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="text-center">
          <Pill><span className="text-brand-600">✦</span> Built honestly</Pill>
          <h2 className="mx-auto mt-6 max-w-2xl font-display text-3xl font-normal leading-tight tracking-tightest text-ink sm:text-5xl">
            Trust &amp; safety, by design
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((c) => (
            <div key={c.t} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink/5">
              <h3 className="font-semibold text-ink">{c.t}</h3>
              <p className="mt-2 text-sm text-ink/60">{c.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 text-center">
          <Link href="/safety" className="text-sm font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800">Read the full safety approach →</Link>
        </div>
      </section>

      {/* Scenarios (illustrative) */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="max-w-2xl font-display text-3xl font-normal leading-tight tracking-tightest text-ink sm:text-4xl">
          Designed around real moving stories
        </h2>
        <p className="mt-3 max-w-xl text-ink/60">Three journeys, one coherent flow. <span className="italic text-ink/40">{IS_BETA ? "Illustrative scenarios — checks are still simulated." : "Illustrative scenarios — this is a prototype with sample people."}</span></p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {SCENARIOS.map((s) => (
            <figure key={s.who} className="flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink/5">
              <span className="chip w-fit bg-brand-50 text-brand-700">{s.tag}</span>
              <blockquote className="mt-4 flex-1 text-ink/80">&ldquo;{s.quote}&rdquo;</blockquote>
              <figcaption className="mt-5 text-sm font-medium text-ink/50">{s.who}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-5xl bg-ink px-6 py-16 text-center text-cream sm:py-20">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-normal leading-tight tracking-tightest sm:text-5xl">
            Ready to find your household?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-cream/70">
            Sign in with any email — your code appears in the demo sink. Or jump in as a seeded persona
            and explore the whole journey.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/signin" className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-cream px-8 text-base font-medium text-ink transition hover:bg-white">
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink/10 bg-cream">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-10 text-sm text-ink/50 sm:flex-row">
          <Logo />
          <p>{BANNER}</p>
        </div>
      </footer>
    </div>
  );
}
