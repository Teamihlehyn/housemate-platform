"use client";

import { useEffect, useRef, useState } from "react";
import Pea, { PeaMood } from "@/components/brand/Pea";

// Two mascots in an open pod. Their eyes follow the pointer, and tapping one makes it say
// something true about how Peabudy works. Under reduced motion nothing moves on its own.

const LINES: [string[], string[]] = [
  [
    "Hi, I'm Pea. Tap me again.",
    "We match on plans, not photos.",
    "Every match tells you why. No % scores.",
    "Agree the rent split before anyone moves in.",
  ],
  [
    "I'm Bud. Maybe your future housemate.",
    "Your dealbreakers work both ways.",
    "Report and block are always one tap away.",
    "Your gender and exact address stay private.",
  ],
];

const CHIPS = [
  { text: "Move-in dates overlap", tone: "bg-pea-100", delay: "120ms" },
  { text: "Budgets overlap", tone: "bg-apricot-100", delay: "300ms" },
  { text: "Both quiet before 10pm", tone: "bg-lilac-100", delay: "480ms" },
];

export default function HeroScene() {
  const ref = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [line, setLine] = useState<{ who: 0 | 1; i: number }>({ who: 0, i: -1 });
  const [moods, setMoods] = useState<[PeaMood, PeaMood]>(["awake", "happy"]);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) {
      setLook({ x: 0, y: 0 });
      return;
    }
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.max(1, Math.hypot(dx, dy));
        setLook({ x: (dx / d) * 4, y: (dy / d) * 3 });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduced]);

  function poke(who: 0 | 1) {
    setLine((l) => ({ who, i: l.who === who ? (l.i + 1) % LINES[who].length : 0 }));
    setMoods((m) => {
      const next: [PeaMood, PeaMood] = [...m];
      next[who] = m[who] === "happy" ? "wow" : "happy";
      next[who === 0 ? 1 : 0] = "awake";
      return next;
    });
  }

  const text = line.i < 0 ? "Hi! We're Pea and Bud. Tap either of us." : LINES[line.who][line.i];

  return (
    <div className="mx-auto w-full max-w-[400px]">
    <div ref={ref} className="relative h-[262px] w-full sm:h-[340px]">
      {/* speech bubble */}
      <div className="absolute inset-x-0 top-0 z-20 flex justify-center px-6">
        <p
          aria-live="polite"
          key={`${line.who}-${line.i}`}
          className="relative animate-rise-in rounded-panel border border-ink-100 bg-white px-4 py-2.5 text-center text-sm font-semibold text-ink shadow-e2"
        >
          {text}
          <span
            aria-hidden="true"
            className={`absolute -bottom-[7px] h-3.5 w-3.5 rotate-45 border-b border-r border-ink-100 bg-white ${line.who === 1 && line.i >= 0 ? "right-[34%]" : "left-[34%]"}`}
          />
        </p>
      </div>

      {/* pod */}
      <svg viewBox="0 0 400 200" className="absolute inset-x-0 bottom-2 w-full" aria-hidden="true">
        <path d="M18 110 C70 20 330 20 382 110 C330 190 70 190 18 110 Z" fill="#2f6a5a" />
        <path d="M40 110 C92 46 308 46 360 110 C308 166 92 166 40 110 Z" fill="#dbece4" />
        <path d="M376 100 c18 -10 26 -30 20 -52" stroke="#2f6a5a" strokeWidth="10" strokeLinecap="round" fill="none" />
      </svg>

      {/* the two peas */}
      <div className="absolute inset-x-0 bottom-[30px] z-10 flex items-end justify-center gap-1 sm:bottom-[34px]">
        {([0, 1] as const).map((who) => (
          <button
            key={who}
            type="button"
            onClick={() => poke(who)}
            aria-label={who === 0 ? "Pea. Tap to hear what Pea says" : "Bud. Tap to hear what Bud says"}
            className={`group rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/60 ${who === 0 ? "animate-bob" : "animate-bob-slow"}`}
            style={who === 1 ? { animationDelay: "-1.4s" } : undefined}
          >
            <Pea
              size={132}
              tone={who === 0 ? "pea" : "fresh"}
              mood={moods[who]}
              look={look}
              blink
              className="h-[118px] w-[118px] transition-transform duration-quick group-hover:-translate-y-1 group-active:scale-95 sm:h-[140px] sm:w-[140px]"
            />
          </button>
        ))}
      </div>
    </div>
    {/* example match reasons, below the pod so they never cover it */}
    <div className="mt-1 flex flex-wrap justify-center gap-2" aria-label="Example reasons two people match">
      {CHIPS.map((c) => (
        <span
          key={c.text}
          style={{ animationDelay: c.delay }}
          className={`inline-flex animate-pop-in items-center gap-1.5 rounded-full border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink ${c.tone}`}
        >
          <span aria-hidden="true">✓</span> {c.text}
        </span>
      ))}
    </div>
    </div>
  );
}
