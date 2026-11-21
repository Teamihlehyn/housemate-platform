"use client";

// DES-27b: "Find flatmates in [Lagos → London → every city]". The city word slides up through a
// fixed-height mask (transform only, so the CTA never moves) and a photo card cross-fades in step.
// Honesty: Lagos is "Open now"; London and "every city" carry "Coming soon" right next to the word.
// Accessibility: screen readers get one static sentence (the rotating part is aria-hidden); a
// visible Pause button (WCAG 2.2.2), pause on hover/focus and when the tab is hidden; reduced
// motion shows the static Lagos state. Performance: Lagos renders on the server and loads eagerly;
// London loads after first paint, from the same 480/720/960 files (phones get ≤ 720 w, ≤ 60 KB).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Pea from "@/components/brand/Pea";
import { CITY_VISUALS } from "@/components/apply/CityCard";
import { IconArrowRight } from "@/components/icons";

type State = { key: "lagos" | "london" | "every"; word: string; tag: string; open: boolean };

const DWELL_MS = 2800;
const SIZES = "(min-width: 768px) 520px, 250px";

export default function HeroCities({ isBeta }: { isBeta: boolean }) {
  const states: State[] = [
    { key: "lagos", word: "Lagos", tag: isBeta ? "Open now" : "Testing", open: true },
    { key: "london", word: "London", tag: isBeta ? "Coming soon" : "Testing", open: !isBeta },
    { key: "every", word: "every city", tag: "Coming soon", open: false },
  ];
  const [i, setI] = useState(0);
  const [running, setRunning] = useState(false); // false until we know motion is OK
  const [userPaused, setUserPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [londonSrc, setLondonSrc] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  // Start only after first paint, and never under reduced motion.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setRunning(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    // Load London after the first paint (idle), so it never competes with the Lagos LCP.
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const t = w.requestIdleCallback ? w.requestIdleCallback(() => setLondonSrc(true)) : window.setTimeout(() => setLondonSrc(true), 1200);
    return () => {
      mq.removeEventListener("change", apply);
      if (!w.requestIdleCallback) clearTimeout(t);
    };
  }, []);

  // Pause when the tab is hidden.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const on = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  const playing = running && !userPaused && !hover && !hidden && londonSrc;
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setI((n) => (n + 1) % states.length), DWELL_MS);
    return () => clearTimeout(t);
  }, [playing, i, states.length]);

  const cur = states[i];
  const lagos = CITY_VISUALS.lagos;
  const london = CITY_VISUALS.london;
  const cta = isBeta ? "/join" : "/signin";

  return (
    <section
      ref={rootRef}
      className="bg-pastel"
      // Hover pauses for mice only: a tap on a phone would otherwise leave it paused for good.
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(true); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(false); }}
      // Keyboard focus inside the hero pauses too, except on the Pause/Play button itself
      // (otherwise pressing Play would do nothing until focus moved).
      onFocusCapture={(e) => setHover(!(e.target as HTMLElement).dataset?.rotatorToggle)}
      onBlurCapture={(e) => { if (!rootRef.current?.contains(e.relatedTarget as Node)) setHover(false); }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 pb-10 pt-5 md:grid-cols-[1.1fr_1fr] md:gap-12 md:pb-16 md:pt-14">
        <div className="text-center md:text-left">
          <p className="text-caption font-semibold uppercase tracking-wide text-brand-700">
            {isBeta ? "Open in Lagos · more cities coming soon" : "Testing in London and Lagos"}
          </p>

          <h1 className="mt-2 font-display text-[2.25rem] font-extrabold leading-[1.08] tracking-tight text-ink min-[400px]:text-display-xl md:text-display-md lg:text-display-xl-md">
            <span className="sr-only">
              {isBeta ? "Find flatmates in Lagos. London and more cities coming soon." : "Find flatmates in Lagos and London. More cities coming soon."}
            </span>
            <span aria-hidden="true">
              <span className="block">Find flatmates in</span>
              {/* One fixed-height line: words stack inside it and slide through, so nothing reflows. */}
              <span className="relative block h-[1.15em] overflow-hidden">
                {states.map((s, n) => {
                  const pos = n === i ? "translate-y-0 opacity-100" : n === (i + states.length - 1) % states.length ? "-translate-y-full opacity-0" : "translate-y-full opacity-0";
                  return (
                    <span
                      key={s.key}
                      className={`absolute inset-x-0 top-0 flex items-center justify-center gap-2 whitespace-nowrap transition-[transform,opacity] duration-[650ms] ease-[cubic-bezier(.2,.8,.2,1)] md:justify-start ${pos}`}
                    >
                      <span className={s.open ? "text-brand-700" : "text-ink"}>{s.word}</span>
                      <span
                        className={`rounded-full px-2.5 py-1 font-sans text-xs font-bold uppercase tracking-wide md:text-sm ${
                          s.open ? "bg-brand-100 text-brand-800" : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {s.tag}
                      </span>
                    </span>
                  );
                })}
              </span>
            </span>
          </h1>

          <p className="mx-auto mt-3 max-w-md text-body-lg text-ink-700 md:mx-0">
            Matched on budget, area and habits. Agree the money stuff first.
          </p>
          <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center md:justify-start">
            <Link href={cta} className="btn-primary btn-lg">
              {isBeta ? "Apply to join" : "Get started"} <IconArrowRight size={18} />
            </Link>
          </div>
          {isBeta && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-ink-700">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-100 text-ink" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="12.5" height="12" rx="2.5" /><path d="m15.5 10.5 5-3v9l-5-3" /></svg>
              </span>
              Everyone meets our team on a 10-minute video call first.
            </p>
          )}
        </div>

        {/* The photo card follows the word. Text never sits on the photo except on solid chips. */}
        <div className="relative mx-auto w-full max-w-md md:max-w-none">
          <div className="relative aspect-[16/10] overflow-hidden rounded-sheet bg-ink-100 shadow-e2 md:aspect-[4/3]">
            {/* Lagos: server-rendered, eager, the first frame. */}
            <img
              src={lagos.src}
              srcSet={lagos.srcSet}
              sizes={SIZES}
              alt=""
              width={480}
              height={300}
              fetchPriority="high"
              decoding="async"
              className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[900ms] ease-out ${cur.key === "lagos" ? "scale-105 opacity-100" : "scale-100 opacity-0"}`}
              style={{ objectPosition: lagos.position }}
            />
            {/* London: loaded after first paint. */}
            <img
              src={londonSrc ? london.src : undefined}
              srcSet={londonSrc ? london.srcSet : undefined}
              sizes={SIZES}
              alt=""
              width={480}
              height={320}
              decoding="async"
              className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[900ms] ease-out ${cur.key === "london" ? "scale-105 opacity-100" : "scale-100 opacity-0"}`}
              style={{ objectPosition: london.position }}
            />
            {/* Every city: the two photos side by side, split on a diagonal, plus "more". */}
            <div className={`absolute inset-0 transition-opacity duration-[900ms] ease-out ${cur.key === "every" ? "opacity-100" : "opacity-0"}`}>
              {/* Same srcset/sizes as above, so these reuse the cached files: no extra download. */}
              {londonSrc && (
                <>
                  <img src={lagos.src} srcSet={lagos.srcSet} sizes={SIZES} alt="" className="absolute inset-0 h-full w-full object-cover [clip-path:polygon(0_0,58%_0,42%_100%,0_100%)]" style={{ objectPosition: "35% 35%" }} />
                  <img src={london.src} srcSet={london.srcSet} sizes={SIZES} alt="" className="absolute inset-0 h-full w-full object-cover [clip-path:polygon(58%_0,100%_0,100%_100%,42%_100%)]" style={{ objectPosition: "80% 40%" }} />
                </>
              )}
              <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white font-display text-lg font-extrabold text-ink shadow-e2">+</span>
            </div>

            {/* Caption chip: solid background, so contrast holds over any photo. */}
            <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-ink shadow-e1" aria-hidden="true">
              {cur.key === "lagos" ? "Lagos · Open now" : cur.key === "london" ? (isBeta ? "London · Coming soon" : "London") : "More cities · Coming soon"}
            </span>

            {/* Pause / play: WCAG 2.2.2 for auto-updating content. */}
            {running && (
              <button
                type="button"
                data-rotator-toggle="true"
                onClick={() => setUserPaused((p) => !p)}
                className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-e1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label={userPaused ? "Play the city animation" : "Pause the city animation"}
              >
                {userPaused ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1" /><rect x="13.5" y="5" width="4" height="14" rx="1" /></svg>
                )}
              </button>
            )}
          </div>
          {/* Pea and Bud peek over the card. */}
          <div className="pointer-events-none absolute -bottom-5 left-4 flex items-end" aria-hidden="true">
            <Pea size={56} mood="happy" className="animate-bob" />
            <Pea size={46} mood="wink" tone="fresh" className="-ml-2 animate-bob-slow" />
          </div>
          <p className="mt-7 text-center font-display text-base font-extrabold text-ink-700 md:text-left md:pl-28">Two peas. One home.</p>
        </div>
      </div>
    </section>
  );
}
