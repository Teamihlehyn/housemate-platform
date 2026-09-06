import Link from "next/link";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold text-brand-700 text-lg">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">H</span>
      Housemate
    </Link>
  );
}

function Nav() {
  return (
    <header className="sticky top-8 z-40 border-b border-stone-200 bg-stone-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium text-stone-600 sm:flex">
          <Link href="/#how" className="hover:text-brand-700">How it works</Link>
          <Link href="/safety" className="hover:text-brand-700">Safety</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/signin" className="btn-ghost">Sign in</Link>
          <Link href="/signin" className="btn-primary">Get started</Link>
        </div>
      </div>
    </header>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Nav />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:pt-24">
        <div className="max-w-3xl">
          <span className="chip bg-brand-100 text-brand-800">London &amp; Lagos pilots</span>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-stone-900 sm:text-5xl">
            Find people whose plans fit yours — and organise a shared home.
          </h1>
          <p className="mt-5 text-lg text-stone-600">
            Match on real living preferences and exact move-in dates, understand what&apos;s been
            verified, and coordinate everything from introduction to move-in. Your household can form
            before you even have a property.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signin" className="btn-primary px-6">Start your search</Link>
            <Link href="/#how" className="btn-secondary px-6">See how it works</Link>
          </div>
          <p className="mt-4 text-sm text-stone-500">
            A prototype with sample people and simulated checks — no real bookings, payments or documents.
          </p>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              t: "Date-aware matching",
              d: "We only surface people whose move-in window actually overlaps yours — down to the day, not just 'sometime soon'.",
            },
            {
              t: "Transparent credibility",
              d: "A demo credibility score shows exactly which checks are complete. It's evidence, never a safety guarantee.",
            },
            {
              t: "One organised journey",
              d: "Introductions, chat, a shared household workspace, viewings and a rental handoff — all in one place.",
            },
          ].map((c) => (
            <div key={c.t} className="card p-6">
              <h3 className="font-semibold text-stone-900">{c.t}</h3>
              <p className="mt-2 text-sm text-stone-600">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold text-stone-900">How it works</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "1", t: "Set your search", d: "Pick your journey, city, areas, budget, move-in dates and living habits." },
            { n: "2", t: "Get verified", d: "Complete core identity and contact checks for a baseline demo credibility of 60." },
            { n: "3", t: "Discover & connect", d: "Browse ranked matches, send an introduction, and chat once accepted." },
            { n: "4", t: "Organise the move", d: "Form a household, shortlist homes, book a viewing, and complete a demo handoff." },
          ].map((s) => (
            <div key={s.n} className="relative card p-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {s.n}
              </span>
              <h3 className="mt-4 font-semibold text-stone-900">{s.t}</h3>
              <p className="mt-2 text-sm text-stone-600">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust band */}
      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid items-center gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold text-stone-900">Trust, shown honestly</h2>
              <p className="mt-3 text-stone-600">
                Every badge says &quot;Demo verified&quot; and every listing says &quot;Sample availability&quot;.
                We never dress a simulated check up as a real one. Failed or pending checks never look
                successful, and private details are never shown to prospective housemates.
              </p>
              <Link href="/safety" className="btn-secondary mt-5">Read the safety approach</Link>
            </div>
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-500">Demo credibility</p>
                  <p className="text-3xl font-bold text-stone-900">80<span className="text-lg text-stone-400">/100</span></p>
                </div>
                <span className="chip bg-brand-100 text-brand-800">Demo verified</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  ["Identity", "40 / 40"],
                  ["Email control", "10 / 10"],
                  ["Phone control", "10 / 10"],
                  ["Reference", "20 / 20"],
                  ["Additional evidence", "0 / 20"],
                ].map(([k, v]) => (
                  <li key={k} className="flex justify-between border-b border-stone-100 pb-1.5 text-stone-600">
                    <span>{k}</span>
                    <span className="font-medium text-stone-800">{v}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-stone-500">Checks completed — not a guarantee of safety.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="text-3xl font-bold text-stone-900">Ready to find your household?</h2>
        <p className="mx-auto mt-3 max-w-xl text-stone-600">
          Sign in with any email — you&apos;ll get a code in the demo sink. Or use a seeded persona to
          jump straight into the experience.
        </p>
        <Link href="/signin" className="btn-primary mt-6 px-8">Get started</Link>
      </section>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-stone-500 sm:flex-row">
          <Logo />
          <p>Prototype — sample people, simulated checks, no real bookings.</p>
        </div>
      </footer>
    </div>
  );
}
