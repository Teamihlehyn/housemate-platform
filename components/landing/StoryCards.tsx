"use client";

// Landing visuals that do the talking (founder, DES-27): illustrated steps, an animated match
// card, an animated agreement card in naira, and the two city photos. All CSS/SVG, transform
// and opacity only. Animations play once when scrolled into view; under reduced motion (or
// before JS) everything is simply shown. One Lagos example throughout: Tolu in Yaba.

import { useEffect, useRef, useState } from "react";
import Pea, { PeaTone } from "@/components/brand/Pea";
import { CITY_VISUALS } from "@/components/apply/CityCard";
import { IconChat, IconCheck, IconDiscover, IconWallet } from "@/components/icons";

/** Plays children's animations once, the first time they scroll into view. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"static" | "armed" | "play">("static");
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const below = el.getBoundingClientRect().top > window.innerHeight;
    if (!below) return; // already on screen: leave it still, nothing to catch the eye
    setState("armed");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setState("play");
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // armed: hidden until it plays; play: animate; static: just show.
  // (Tailwind can't see dynamic class names, so the delay is an inline style.)
  const anim = (delayMs: number, kind: "pop" | "rise" = "pop") => ({
    className: state === "armed" ? "opacity-0" : state === "play" ? (kind === "pop" ? "animate-pop-in" : "animate-rise-in") : "",
    style: state === "play" ? { animationDelay: `${delayMs}ms` } : undefined,
  });
  return { ref, state, anim };
}

/* ------------------------------ How it works ------------------------------ */

function VideoIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="12.5" height="12" rx="2.5" />
      <path d="m15.5 10.5 5-3v9l-5-3" />
    </svg>
  );
}

const STEPS: { title: string; line: string; tone: PeaTone; Icon: (p: { size?: number }) => React.ReactNode; bg: string }[] = [
  { title: "Apply", line: "Your dates, budget, area.", tone: "pea", Icon: ({ size }) => <IconDiscover size={size} />, bg: "bg-pea-100" },
  { title: "10-minute call", line: "We meet everyone and check ID.", tone: "sky", Icon: VideoIcon, bg: "bg-sky-100" },
  { title: "See who fits", line: "Every match says why.", tone: "lilac", Icon: ({ size }) => <IconChat size={size} />, bg: "bg-lilac-100" },
  { title: "Agree the money", line: "Rent split, in writing.", tone: "apricot", Icon: ({ size }) => <IconWallet size={size} />, bg: "bg-apricot-100" },
];

export function StepCards({ callStep = true }: { callStep?: boolean }) {
  const { ref, anim } = useReveal<HTMLOListElement>();
  const steps = callStep ? STEPS : STEPS.filter((s) => s.title !== "10-minute call");
  return (
    <ol ref={ref} className={`grid grid-cols-2 gap-3 ${steps.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
      {steps.map((s, i) => (
        <li key={s.title} className={`relative rounded-card bg-white p-4 ring-1 ring-ink-100 sm:p-5 ${anim(i * 120, "rise").className}`} style={anim(i * 120, "rise").style}>
          <span className="num absolute right-3 top-3 text-caption font-bold text-ink-600" aria-hidden="true">{i + 1}</span>
          <div className="relative h-14 w-16" aria-hidden="true">
            <Pea size={52} tone={s.tone} mood={i === steps.length - 1 ? "happy" : "awake"} />
            <span className={`absolute -right-1 bottom-0 grid h-8 w-8 place-items-center rounded-full ${s.bg} text-ink ring-2 ring-white`}>
              <s.Icon size={16} />
            </span>
          </div>
          <h3 className="mt-3 text-h3 text-ink"><span className="sr-only">Step {i + 1}: </span>{s.title}</h3>
          <p className="mt-0.5 text-sm text-ink-700">{s.line}</p>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------- Match card ------------------------------- */

const REASONS = [
  { t: "Dates overlap", tone: "bg-pea-100" },
  { t: "Both want Yaba", tone: "bg-sky-100" },
  { t: "Budgets overlap", tone: "bg-apricot-100" },
  { t: "Quiet weeknights", tone: "bg-lilac-100" },
];

export function MatchCard() {
  const { ref, anim } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="relative rounded-card bg-white p-5 ring-1 ring-ink-100">
      <span className="absolute right-4 top-4 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-700">Example</span>
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-lilac-100 font-bold text-lilac-800" aria-hidden="true">TA</span>
        <div>
          <p className="font-semibold text-ink">Tolu A.</p>
          <p className="text-sm text-ink-600">Yaba · from January</p>
        </div>
      </div>
      <p className="mt-4 text-caption font-semibold uppercase tracking-wide text-ink-600">Why you match</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {REASONS.map((r, i) => (
          <li key={r.t} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink ${r.tone} ${anim(250 + i * 160).className}`} style={anim(250 + i * 160).style}>
            <IconCheck size={14} strokeWidth={3} />
            {r.t}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------- Agreement card ----------------------------- */

export function AgreementCard() {
  const { ref, state, anim } = useReveal<HTMLDivElement>();
  const grow = state === "armed" ? "scale-x-0" : "scale-x-100";
  return (
    <div ref={ref} className="relative rounded-card bg-white p-5 ring-1 ring-ink-100">
      <span className="absolute right-4 top-4 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-700">Example</span>
      <p className="font-semibold text-ink">Household agreement</p>
      <p className="text-xs text-ink-600">You and Tolu · version 1</p>
      <p className="num mt-4 font-display text-h1 text-ink">
        ₦1,800,000<span className="whitespace-nowrap text-base font-semibold text-ink-600"> a year each</span>
      </p>
      <p className="num text-sm text-ink-600">About ₦150,000 a month</p>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-ink-50" aria-hidden="true">
        <span className={`w-1/2 origin-left bg-pea-400 transition-transform duration-700 ease-out ${grow}`} />
        <span className={`w-1/2 origin-left bg-sky-300 transition-transform delay-300 duration-700 ease-out ${grow}`} />
      </div>
      <p className="mt-1 flex justify-between text-xs font-medium text-ink-600">
        <span>You 50%</span>
        <span>Tolu 50%</span>
      </p>
      <p className={`mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1.5 text-sm font-semibold text-brand-800 ${anim(900).className}`} style={anim(900).style}>
        <IconCheck size={14} strokeWidth={3} /> Agreed by both
      </p>
    </div>
  );
}

/* --------------------------------- Cities --------------------------------- */

export function CityTiles({ isBeta }: { isBeta: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["lagos", "london"] as const).map((c) => {
        const v = CITY_VISUALS[c];
        const open = !isBeta || c === "lagos";
        return (
          <figure key={c} className="relative aspect-[16/10] overflow-hidden rounded-card bg-ink-100">
            <img
              src={v.src}
              srcSet={v.srcSet}
              sizes="(min-width: 640px) 560px, 250px"
              alt={v.alt}
              width={480}
              height={300}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              style={{ objectPosition: v.position }}
            />
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[rgb(20_19_16/0.9)] via-[rgb(20_19_16/0.5)] to-transparent" />
            <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
              <span>
                <span className="block font-display text-2xl font-extrabold text-white">{v.name}</span>
                <span className="block text-sm font-medium text-white">{c === "lagos" ? "Naira, rent per year" : "Pounds, rent per month"}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${open ? "bg-brand-100 text-brand-800" : "bg-sky-100 text-sky-800"}`}>
                {open ? "Open now" : "Opening later"}
              </span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
