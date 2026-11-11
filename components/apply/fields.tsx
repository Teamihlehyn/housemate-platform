"use client";

// Shared question primitives for the conversational profile flow (DES-20). Used by /join
// (the application), in-app /onboarding (demo modes) and the section editors on /profile.
// Presentation only: every value and option still comes from lib/constants.

import { RefObject } from "react";
import Pea, { PeaTone } from "@/components/brand/Pea";
import { IconCheck, IconEye, IconLock } from "@/components/icons";
import { QUESTIONNAIRE, Dimension } from "@/lib/constants";

// Conversational wording for the six habits (display only; values come from QUESTIONNAIRE).
export const HABIT_ASK: Record<Dimension, { q: string; accept: string; tone: PeaTone }> = {
  cleaning: { q: "How often do you clean shared spaces?", accept: "Who could you live with?", tone: "pea" },
  quiet: { q: "When should weeknights go quiet?", accept: "Who could you live with?", tone: "fresh" },
  guests: { q: "How often do you have overnight guests?", accept: "Who could you live with?", tone: "sage" },
  smoking: { q: "Do you smoke at home?", accept: "Who could you live with?", tone: "pea" },
  pets: { q: "Do you have a pet?", accept: "Who could you live with?", tone: "fresh" },
  social: { q: "How social do you like home to be?", accept: "Who could you live with?", tone: "sage" },
};

/**
 * The question for a screen. In the flow it's the page's h1 (focus moves to it on each
 * step); in a profile section editor it's a smaller h3.
 */
export function Question({
  children,
  refEl,
  legend,
  htmlFor,
  compact = false,
}: {
  children: React.ReactNode;
  refEl?: RefObject<HTMLHeadingElement | null>;
  legend?: boolean;
  htmlFor?: string;
  compact?: boolean;
}) {
  const inner = htmlFor ? <label htmlFor={htmlFor}>{children}</label> : children;
  const h = compact ? (
    <h3 className="text-h3 text-ink">{inner}</h3>
  ) : (
    <h1 ref={refEl} tabIndex={-1} className="font-display text-display text-ink focus:outline-none md:text-[2.25rem] md:leading-[2.5rem]">
      {inner}
    </h1>
  );
  return legend ? <legend className="w-full">{h}</legend> : h;
}

export function FieldError({ msg, id }: { msg?: string; id?: string }) {
  if (!msg) return null;
  return <p id={id} className="field-error" role="alert">{msg}</p>;
}

export function Reassure({ children, id, icon = "lock" }: { children: React.ReactNode; id?: string; icon?: "lock" | "eye" }) {
  return (
    <p id={id} className="mt-3 flex items-start gap-2 text-sm text-ink-700">
      <span className="mt-0.5 shrink-0 text-ink-600" aria-hidden="true">{icon === "lock" ? <IconLock size={16} /> : <IconEye size={16} />}</span>
      <span>{children}</span>
    </p>
  );
}

export function Tick() {
  return (
    <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-ink text-cream" aria-hidden="true">
      <IconCheck size={14} strokeWidth={3} />
    </span>
  );
}

export function OptionCard({ checked, onClick, title, help, art }: { checked: boolean; onClick: () => void; title: string; help: string; art: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 rounded-card border-2 bg-white p-3 pr-10 text-left transition duration-quick focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${checked ? "border-ink" : "border-transparent ring-1 ring-ink-100 hover:ring-ink-400"}`}
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-panel bg-pea-50">{art}</span>
      <span className="min-w-0">
        <span className="block text-h3 text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-ink-600">{help}</span>
      </span>
      {checked && <Tick />}
    </button>
  );
}

export function JourneyArt({ kind }: { kind: number }) {
  if (kind === 0)
    return (
      <span className="flex -space-x-2" aria-hidden="true">
        <Pea size={28} mood="happy" />
        <Pea size={28} mood="awake" tone="fresh" />
      </span>
    );
  if (kind === 1)
    return (
      <span className="relative" aria-hidden="true">
        <Pea size={32} mood="awake" />
        <span className="absolute -right-2 -top-1 text-base">⌂</span>
      </span>
    );
  return (
    <span className="relative" aria-hidden="true">
      <Pea size={32} mood="wink" tone="sage" />
      <span className="absolute -right-2 -top-1 rounded-full bg-white px-1 text-[10px] font-bold text-ink ring-1 ring-ink-100">+1</span>
    </span>
  );
}

export function RadioRow({ checked, onClick, label, multi = false }: { checked: boolean; onClick: () => void; label: string; multi?: boolean }) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={checked}
      onClick={onClick}
      className={`flex min-h-[52px] w-full items-center gap-3 rounded-field border-2 bg-white px-4 text-left text-body font-medium text-ink transition duration-quick focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${checked ? "border-ink" : "border-transparent ring-1 ring-ink-100 hover:ring-ink-400"}`}
    >
      <span
        aria-hidden="true"
        className={`grid h-5 w-5 shrink-0 place-items-center border-2 ${multi ? "rounded-md" : "rounded-full"} ${checked ? "border-ink bg-ink text-cream" : "border-ink-400"}`}
      >
        {checked && (multi ? <IconCheck size={12} strokeWidth={3.5} /> : <span className="h-2 w-2 rounded-full bg-cream" />)}
      </span>
      {label}
    </button>
  );
}

export function MoneyInput({ id, label, currency, value, onChange, error }: { id: string; label: string; currency: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-ink-600" aria-hidden="true">
          {currency === "NGN" ? "₦" : "£"}
        </span>
        <input
          id={id}
          className="input num pl-9"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
          aria-invalid={!!error}
          aria-label={`${label}, in ${currency === "NGN" ? "naira" : "pounds"}`}
        />
      </div>
      <FieldError msg={error} />
    </div>
  );
}

export function Stepper({ id, label, value, onChange, min, max, error }: { id: string; label: string; value: string; onChange: (v: string) => void; min: number; max: number; error?: string }) {
  const n = parseInt(value) || min;
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-1 rounded-field bg-white p-1 ring-1 ring-ink-400">
        <button type="button" className="btn-icon text-xl" onClick={() => onChange(String(Math.max(min, n - 1)))} aria-label={`${label}: one month fewer`}>−</button>
        <input
          id={id}
          className="num w-full min-w-0 bg-transparent text-center text-lg font-semibold text-ink focus:outline-none"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          aria-invalid={!!error}
          aria-describedby={`${id}-unit`}
        />
        <button type="button" className="btn-icon text-xl" onClick={() => onChange(String(Math.min(max, n + 1)))} aria-label={`${label}: one month more`}>+</button>
      </div>
      <p id={`${id}-unit`} className="mt-1 text-center text-caption text-ink-600">months</p>
      <FieldError msg={error} />
    </div>
  );
}

export function NameTag({ name }: { name: string }) {
  const letters = name.trim().slice(0, 24).split("");
  return (
    <div className="mt-5 flex items-center gap-3" aria-hidden="true">
      <Pea size={64} mood={letters.length ? "happy" : "awake"} tone="fresh" className={letters.length ? "animate-wiggle" : ""} key={letters.length > 0 ? "on" : "off"} />
      <div className="min-w-0 flex-1 overflow-hidden rounded-panel bg-white ring-1 ring-ink-100">
        <p className="bg-ink px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cream">Hello, my name is</p>
        <p className="flex h-12 items-center overflow-hidden whitespace-pre px-3 font-display text-2xl font-extrabold text-ink">
          {letters.length === 0 ? <span className="text-ink-300">…</span> : letters.map((l, i) => (
            <span key={`${i}-${l}`} className="inline-block animate-pop-in">{l}</span>
          ))}
        </p>
      </div>
    </div>
  );
}

/** Six sleeping peas; each habit the person answers wakes one. Counts only their own answers. */
export function HabitPod({ answered, current }: { answered: string[]; current: string }) {
  const n = answered.length;
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-ink-600">Living habits</p>
        <span className="num inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-cream" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${n ? "bg-pea-300" : "bg-ink-400"}`} aria-hidden="true" />
          {n} of 6 peas awake
        </span>
      </div>
      <div className="mt-2 rounded-full bg-brand-600 p-1.5" aria-hidden="true">
        <div className="grid grid-cols-6 justify-items-center rounded-full bg-brand-100 px-1 py-1">
          {QUESTIONNAIRE.map((q) => {
            const on = answered.includes(q.id);
            return (
              <span key={q.id} className={`${on ? "animate-pop-in" : ""} ${q.id === current && !on ? "rounded-full ring-2 ring-pea-500 ring-offset-1 ring-offset-brand-100" : ""}`}>
                <Pea size={40} tone={HABIT_ASK[q.id].tone} mood={on ? "awake" : "sleep"} dim={!on} blink={on} className="h-9 w-9 sm:h-10 sm:w-10" />
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Visible autosave reassurance. Text, not just an icon; announced politely. */
export function SaveStatus({ state, className = "" }: { state: SaveState; className?: string }) {
  return (
    <span className={`inline-flex min-h-[20px] items-center gap-1.5 text-caption font-medium ${state === "error" ? "text-danger-700" : "text-ink-600"} ${className}`} role="status" aria-live="polite">
      {state === "saving" && <><span className="h-2 w-2 animate-pulse rounded-full bg-ink-400" aria-hidden="true" />Saving…</>}
      {state === "saved" && <><span className="grid h-4 w-4 place-items-center rounded-full bg-brand-600 text-white" aria-hidden="true"><IconCheck size={10} strokeWidth={3.5} /></span>Saved</>}
      {state === "error" && <>Not saved yet</>}
    </span>
  );
}
