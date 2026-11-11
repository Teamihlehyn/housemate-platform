"use client";

import { useRef, useState } from "react";
import Pea from "@/components/brand/Pea";

// "How it works" as a five-step tablist. Each panel shows a small, clearly-labelled example.

type Step = { t: string; d: string };

export default function HowItWorks({ isBeta }: { isBeta: boolean }) {
  const steps: Step[] = [
    { t: isBeta ? "Apply with your plans" : "Tell us your plans", d: "Your move-in dates, budget, areas, how long you want to stay, and six living habits. One question at a time." },
    { t: "See who fits, and why", d: "Every match explains itself: the dates you share, the areas you both want, the habits you agree on. No swiping, no % scores." },
    { t: "Say hello", d: "Send a short introduction. If they accept, a private chat opens. Report and block are always one tap away." },
    { t: "Agree the money stuff", d: "Rent split, bills and notice if someone leaves, written down. Every change is a new version you both accept." },
    // Homes, viewings and move-in don't exist in beta, so that step is left out there.
    ...(isBeta
      ? []
      : [{ t: "Find a home together", d: "Shortlist sample homes, vote, book a viewing and confirm move-in together. In this test every home is a sample." }]),
  ];
  const [cur, setCur] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: React.KeyboardEvent, i: number) {
    let n = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % steps.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + steps.length) % steps.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = steps.length - 1;
    else return;
    e.preventDefault();
    setCur(n);
    tabs.current[n]?.focus();
  }

  return (
    <div className="rounded-sheet border border-ink-100 bg-white p-4 sm:p-8">
      <div role="tablist" aria-label="How Peabudy works" className={`grid gap-1.5 sm:gap-2 ${steps.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {steps.map((s, i) => {
          const on = i === cur;
          return (
            <button
              key={s.t}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              id={`how-tab-${i}`}
              aria-selected={on}
              aria-controls={`how-panel-${i}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setCur(i)}
              onKeyDown={(e) => onKey(e, i)}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-panel px-1 text-center transition duration-quick focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:min-h-[64px] sm:px-3 ${
                on ? "bg-ink text-cream" : "bg-cream text-ink-700 hover:bg-ink-50"
              }`}
            >
              <span className="num font-display text-base font-extrabold">{i + 1}</span>
              <span className="hidden text-xs font-semibold leading-tight md:block">{s.t}</span>
              <span className="sr-only md:hidden">{s.t}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`how-panel-${cur}`}
        aria-labelledby={`how-tab-${cur}`}
        key={cur}
        className="mt-5 grid animate-rise-in items-center gap-6 md:mt-8 md:grid-cols-2"
      >
        <div>
          <p className="text-caption text-ink-600">Step {cur + 1} of {steps.length}</p>
          <h3 className="mt-1 font-display text-h1 text-ink md:text-h1-md">{steps[cur].t}</h3>
          <p className="mt-2 text-body text-ink-700">{steps[cur].d}</p>
          <div className="mt-5 flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={cur === 0}>
              Back
            </button>
            {cur < steps.length - 1 ? (
              <button type="button" className="btn-primary" onClick={() => setCur((c) => c + 1)}>
                Next step
              </button>
            ) : (
              <a href={isBeta ? "/join" : "/signin"} className="btn-primary">
                {isBeta ? "Apply to join" : "Get started"}
              </a>
            )}
          </div>
        </div>
        <div className="relative rounded-card bg-pastel-soft p-4 sm:p-6">
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink-700">Example</span>
          <Mock step={cur} />
        </div>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 rounded-field bg-white px-3 py-2.5 text-sm ring-1 ring-ink-100">{children}</div>;
}

function Mock({ step }: { step: number }) {
  if (step === 0)
    return (
      <div className="space-y-3 pt-6">
        <div className="flex items-start gap-2">
          <Pea size={40} mood="awake" blink />
          <p className="rounded-panel rounded-tl-md bg-white px-3 py-2 text-sm text-ink ring-1 ring-ink-100">When would you like to move in?</p>
        </div>
        <div className="flex flex-wrap gap-2 pl-12">
          {["Exact date", "Date range"].map((t, i) => (
            <span key={t} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${i === 1 ? "border-ink bg-ink text-cream" : "border-ink-400 bg-white text-ink"}`}>
              {i === 1 && "✓ "}
              {t}
            </span>
          ))}
        </div>
        <div className="ml-12 grid grid-cols-2 gap-2 text-sm">
          <Row>
            <span className="text-ink-600">Earliest</span>
            <span className="font-semibold">1 Mar</span>
          </Row>
          <Row>
            <span className="text-ink-600">Latest</span>
            <span className="font-semibold">15 Apr</span>
          </Row>
        </div>
      </div>
    );
  if (step === 1)
    return (
      <div className="rounded-card bg-white p-4 ring-1 ring-ink-100">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-lilac-100 font-bold text-lilac-800">TA</span>
          <div>
            <p className="font-semibold text-ink">Tolu A.</p>
            <p className="text-xs text-ink-600">Yaba · Surulere</p>
          </div>
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-600">Why you match</p>
        <ul className="mt-1.5 space-y-1.5 text-sm text-ink-700">
          {["Move-in windows overlap by 40 days", "Both looking in Yaba", "Same answer on quiet hours"].map((r) => (
            <li key={r} className="flex gap-2">
              <span className="text-brand-600" aria-hidden="true">✓</span>
              {r}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-600">Worth discussing</p>
        <span className="mt-1.5 inline-block rounded-full bg-apricot-100 px-2.5 py-1 text-xs font-semibold text-apricot-800">Overnight guests</span>
      </div>
    );
  if (step === 2)
    return (
      <div className="space-y-2 pt-6">
        <p className="ml-auto max-w-[85%] rounded-panel rounded-br-md bg-brand-700 px-3 py-2 text-sm text-cream">
          Hi! We&apos;re both after Hackney from March, and I&apos;m quiet on weeknights too. Fancy a chat?
        </p>
        <p className="mx-auto w-fit rounded-full bg-ink-50 px-3 py-1 text-xs font-medium text-ink-700">Ben accepted your intro · chat is open</p>
        <div className="flex items-end gap-2">
          <Pea size={36} mood="happy" tone="fresh" />
          <p className="max-w-[80%] rounded-panel rounded-bl-md bg-white px-3 py-2 text-sm text-ink ring-1 ring-ink-100">Definitely. What are you thinking for bills?</p>
        </div>
      </div>
    );
  if (step === 3)
    return (
      <div className="rounded-card bg-white p-4 ring-1 ring-ink-100">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-ink">Household agreement</p>
            <p className="text-xs text-ink-600">Version 2</p>
          </div>
          <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-800">✓ Agreed by both</span>
        </div>
        <p className="num mt-3 font-display text-money-xl text-ink">
          £950<span className="text-base font-semibold text-ink-600">/mo each</span>
        </p>
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full" aria-hidden="true">
          <span className="w-1/2 bg-pea-400" />
          <span className="w-1/2 bg-sky-300" />
        </div>
        <p className="mt-1 flex justify-between text-xs text-ink-600">
          <span>You 50%</span>
          <span>Ben 50%</span>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Row>
            <span className="text-ink-600">Bills</span>
            <span className="font-semibold">Equal</span>
          </Row>
          <Row>
            <span className="text-ink-600">Notice</span>
            <span className="font-semibold">4 weeks</span>
          </Row>
        </div>
      </div>
    );
  return (
    <div className="space-y-2 pt-6">
      {[
        { t: "2-bed flat, Hackney", s: "Both interested", ok: true },
        { t: "2-bed flat, Camden", s: "Ben is not sure", ok: false },
      ].map((h) => (
        <Row key={h.t}>
          <span className="font-medium text-ink">
            {h.t}
            <span className="ml-1.5 rounded-full bg-ink-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-700">Sample</span>
          </span>
          <span className={`text-xs font-semibold ${h.ok ? "text-brand-700" : "text-ink-600"}`}>
            {h.ok ? "✓ " : ""}
            {h.s}
          </span>
        </Row>
      ))}
      <p className="pt-1 text-center text-xs font-medium text-ink-700">Viewing booked · Sat 10:00</p>
    </div>
  );
}
