"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Pea, { PeaTone } from "@/components/brand/Pea";
import { IconArrowRight, IconBack } from "@/components/icons";

// HM-26: the honest waiting state for a site-wide 429 RATE_LIMITED on sign-in.
// Everything here is true: the countdown comes from Retry-After, nothing claims a queue or
// progress, and the toy only counts the person's own taps. Under reduced motion every loop
// stops (globals.css) and the page still works: the countdown is text, the game is buttons.

const POD: PeaTone[] = ["pea", "fresh", "sage", "pea", "fresh", "sage"];

const CARDS = [
  { t: "Tell us your plans", d: "Move-in dates, budget, areas, how long you'll stay and six living habits. One question at a time." },
  { t: "We check your ID", d: "A short video call with our team before you can see anyone, or anyone can see you. Checks completed — not a guarantee of safety." },
  { t: "See who fits, and why", d: "Every match explains itself: shared dates, areas and habits. No swiping and no % scores." },
  { t: "Agree the money stuff", d: "Rent split, bills and notice in writing. Every change is a new version you both accept." },
];

export function formatCountdown(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return h ? `${h}:${mm}:${String(r).padStart(2, "0")}` : `${mm}:${String(r).padStart(2, "0")}`;
}

/** Seconds left until `until` (ms epoch), ticking every second. */
export function useCountdown(until: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

export default function WaitingRoom({ until, message }: { until: number; message: string }) {
  const left = useCountdown(until);
  const done = left <= 0;
  const at = new Date(until).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <section aria-labelledby="wait-title" className="rounded-card bg-cream p-4 ring-1 ring-ink-100 sm:p-5">
      <Catch done={done} />

      <h2 id="wait-title" className="mt-3 text-center font-display text-h2 text-ink">
        {done ? "You can try again now" : "Sign-in is busy right now"}
      </h2>
      <p className="mt-1.5 text-center text-sm text-ink-700">
        {done ? "Pea and Bud have put the ball down. Press the button below." : message}
      </p>

      {!done && (
        <div className="mt-4 text-center">
          <p className="text-caption text-ink-600">You can try again in</p>
          <p role="timer" aria-live="off" aria-atomic="true" className="num font-display text-money-xl text-ink">
            {formatCountdown(left)}
          </p>
          <p className="text-caption text-ink-600">
            Try again at about {at}. Leave this page open, or come back then.
          </p>
        </div>
      )}
      {/* Announce only the end, not every second. */}
      <p className="sr-only" aria-live="polite">{done ? "The wait is over. You can ask for a code again." : ""}</p>

      {!done && (
        <>
          <p className="mt-3 text-center text-sm text-ink-700">
            New to Peabudy?{" "}
            <Link href="/request-access" className="inline-flex min-h-[44px] items-center font-semibold text-brand-700 underline underline-offset-4">Request an invite</Link>
          </p>
          <WakeGame />
          <HowCards />
        </>
      )}
    </section>
  );
}

/** Pea and Bud tossing a small pea between them. Decorative. */
function Catch({ done }: { done: boolean }) {
  return (
    <div className="relative mx-auto flex h-[92px] max-w-[240px] items-end justify-between" aria-hidden="true">
      <Pea size={64} mood={done ? "happy" : "awake"} blink />
      {!done && (
        <span className="pb-toss absolute left-[52px] top-1 h-4 w-4 rounded-full bg-pea-400 ring-2 ring-pea-500" />
      )}
      <Pea size={56} mood={done ? "wink" : "awake"} tone="fresh" blink />
    </div>
  );
}

/** A tiny tap toy: wake the six sleeping peas. Counts only this person's taps. */
function WakeGame() {
  const [awake, setAwake] = useState<boolean[]>(() => POD.map(() => false));
  const [rounds, setRounds] = useState(0);
  const [last, setLast] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const n = awake.filter(Boolean).length;
  const full = n === POD.length;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // When the whole pod is awake: count the round, then the pod naps again for another go.
  useEffect(() => {
    if (!full) return;
    setRounds((r) => r + 1);
    timer.current = setTimeout(() => { setAwake(POD.map(() => false)); setLast(null); }, 1800);
  }, [full]);

  function tap(i: number) {
    setAwake((prev) => (prev[i] || prev.every(Boolean) ? prev : prev.map((a, j) => (j === i ? true : a))));
    setLast(i);
  }

  return (
    <div className="mt-5 rounded-panel bg-white p-3 ring-1 ring-ink-100 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Meanwhile: wake the pod</p>
        <p className="num text-caption text-ink-600" aria-live="polite">
          {full ? "Whole pod awake" : `${n} of 6 awake`}
          {rounds > 0 && ` · ${rounds} ${rounds === 1 ? "round" : "rounds"}`}
        </p>
      </div>
      <div className="mt-3 rounded-full bg-brand-600 p-1.5">
        <div className="grid grid-cols-6 justify-items-center rounded-full bg-brand-100 px-1 py-1">
          {POD.map((tone, i) => (
            <button
              key={i}
              type="button"
              onClick={() => tap(i)}
              aria-label={awake[i] ? `Pea ${i + 1}, awake` : `Wake pea ${i + 1}`}
              aria-pressed={awake[i]}
              className="grid h-11 w-11 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:h-12 sm:w-12"
            >
              <span className={awake[i] && last === i ? "animate-pop-in" : full ? "animate-wiggle" : ""}>
                <Pea size={40} tone={tone} mood={awake[i] ? (full ? "happy" : "awake") : "sleep"} dim={!awake[i]} className="h-9 w-9 sm:h-10 sm:w-10" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** "How Peabudy works" in four small cards, one at a time. */
function HowCards() {
  const [i, setI] = useState(0);
  const c = CARDS[i];
  return (
    <div className="mt-4 rounded-panel bg-white p-4 ring-1 ring-ink-100" aria-roledescription="carousel" aria-label="How Peabudy works">
      <p className="text-caption font-semibold uppercase tracking-wide text-brand-700">How Peabudy works · {i + 1} of {CARDS.length}</p>
      <div aria-live="polite" className="min-h-[96px]">
        <h3 key={c.t} className="mt-1.5 animate-rise-in text-h3 text-ink">{c.t}</h3>
        <p key={c.d} className="mt-1 animate-rise-in text-sm text-ink-700">{c.d}</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button type="button" className="btn-icon" onClick={() => setI((i - 1 + CARDS.length) % CARDS.length)} aria-label="Previous card">
          <IconBack size={20} />
        </button>
        <div className="flex gap-1.5" aria-hidden="true">
          {CARDS.map((_, j) => (
            <span key={j} className={`h-2 rounded-full transition-all duration-quick ${j === i ? "w-5 bg-ink" : "w-2 bg-ink-300"}`} />
          ))}
        </div>
        <button type="button" className="btn-icon" onClick={() => setI((i + 1) % CARDS.length)} aria-label="Next card">
          <IconArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}
