"use client";

import { useState } from "react";
import Pea, { PeaTone } from "@/components/brand/Pea";

// A toy that teaches the six living-habit questions: tap a habit, a pea wakes up.

const HABITS: { id: string; label: string; ask: string; tone: PeaTone }[] = [
  { id: "cleaning", label: "Cleaning", ask: "How often do you clean shared spaces?", tone: "pea" },
  { id: "quiet", label: "Quiet hours", ask: "When does the home go quiet on weeknights?", tone: "fresh" },
  { id: "guests", label: "Overnight guests", ask: "How often do guests stay over?", tone: "sage" },
  { id: "smoking", label: "Smoking", ask: "Does anyone smoke at home?", tone: "pea" },
  { id: "pets", label: "Pets", ask: "Any pets?", tone: "fresh" },
  { id: "social", label: "Social home", ask: "Mostly private, balanced or mostly social?", tone: "sage" },
];

export default function WakeThePod() {
  const [awake, setAwake] = useState<string[]>([]);
  const [last, setLast] = useState<string | null>(null);
  const n = awake.length;

  function toggle(id: string) {
    setAwake((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
    setLast(id);
  }

  const lastHabit = HABITS.find((h) => h.id === last);

  return (
    <div className="rounded-sheet bg-white p-5 ring-1 ring-ink-100 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-caption text-ink-600">Try it: tap a habit</p>
        <span aria-live="polite" className="num inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream">
          <span className={`h-2 w-2 rounded-full ${n ? "bg-pea-300" : "bg-ink-400"}`} aria-hidden="true" />
          {n} of 6 peas awake
        </span>
      </div>

      {/* the pod */}
      <div className="relative mx-auto mt-5 max-w-xl">
        <div className="rounded-full bg-brand-600 p-2 sm:p-3">
          <div className="grid grid-cols-6 items-center justify-items-center rounded-full bg-brand-100 px-1.5 py-2 sm:px-4 sm:py-3">
            {HABITS.map((h) => {
              const on = awake.includes(h.id);
              return (
                <span key={h.id} className={on ? "animate-pop-in" : ""}>
                  <Pea
                    size={56}
                    tone={h.tone}
                    mood={on ? (last === h.id ? "happy" : "awake") : "sleep"}
                    dim={!on}
                    blink={on}
                    className="h-11 w-11 sm:h-16 sm:w-16"
                  />
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {HABITS.map((h) => (
          <button key={h.id} type="button" aria-pressed={awake.includes(h.id)} onClick={() => toggle(h.id)} className="choice-chip">
            {awake.includes(h.id) && <span aria-hidden="true">✓</span>}
            {h.label}
          </button>
        ))}
      </div>

      <p className="mx-auto mt-5 min-h-[3rem] max-w-md text-center text-sm text-ink-700" aria-live="polite">
        {n === 6
          ? "That's the full pod. You answer what you do and what you'd accept, and a match has to work for both of you."
          : lastHabit && awake.includes(lastHabit.id)
            ? `We'd ask: “${lastHabit.ask}” Then: what would you accept in a housemate?`
            : "Six living habits, each asked two ways: what you do, and what you'd accept."}
      </p>
    </div>
  );
}
