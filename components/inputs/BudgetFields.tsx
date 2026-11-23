"use client";

// DES-37: the rent budget fields, shared by /join, Profile and the Discover edit sheet (through
// StepBody). Period toggle (converts the numbers rather than reinterpreting them), quick-pick
// ranges, two MoneyInputs, the live equivalent line, gentle "does this look right?" notes and a
// clear From/Up to range error. Values stay whole-unit digit strings, as the draft expects.

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";
import MoneyInput from "./MoneyInput";
import { BUDGET_PICKS, Period, convertPeriod, sanityFor } from "./budgetRules";

const money = (units: number, currency: string) => formatMoney(units * 100, currency);

export default function BudgetFields({
  idPrefix,
  currency,
  period,
  setPeriod,
  min,
  max,
  setMin,
  setMax,
  errors,
}: {
  idPrefix: string;
  currency: string;
  period: Period;
  setPeriod: (p: Period) => void;
  min: string;
  max: string;
  setMin: (v: string) => void;
  setMax: (v: string) => void;
  errors: { min?: string; max?: string; period?: string };
}) {
  const [picked, setPicked] = useState<string | null>(null);
  // The draft holds the SOURCE: exactly what the person typed, in the period they typed it in
  // (that's what gets saved, so no rounding reaches the server). `view` is only how it's shown:
  // toggling converts for display, toggling back shows the original exactly, and the source
  // re-anchors to the new period only when they edit a field there.
  const [view, setView] = useState<Period>(period);
  useEffect(() => { setView(period); }, [period, currency]);

  const shown = (v: string) => {
    const n = parseInt(v || "0", 10);
    if (!n) return v;
    return view === period ? v : String(convertPeriod(n, period, view, currency));
  };
  const minShown = shown(min);
  const maxShown = shown(max);
  const lo = parseInt(minShown || "0", 10);
  const hi = parseInt(maxShown || "0", 10);

  function changePeriod(p: Period) {
    setView(p);
    setPicked(null);
  }
  /** Edit in the displayed period: re-anchor the source there if needed, then apply. */
  function edit(which: "min" | "max", v: string) {
    setPicked(null);
    if (view !== period) {
      setPeriod(view);
      if (which === "min") { setMin(v); setMax(maxShown); } else { setMax(v); setMin(minShown); }
      return;
    }
    if (which === "min") setMin(v); else setMax(v);
  }

  const picksCfg = BUDGET_PICKS[currency];
  const picks = picksCfg?.picks.map((x) => ({
    ...x,
    min: convertPeriod(x.min, picksCfg.period, view, currency),
    max: convertPeriod(x.max, picksCfg.period, view, currency),
  }));

  // Gentle notes: never block, always offer the likely fix.
  const sane = sanityFor(currency, view);
  const note = (v: number) => {
    if (!sane || !v) return null;
    const per = view === "year" ? "a year's rent" : "a month's rent";
    if (v < sane.low) return `That looks low for ${per} per person in ${sane.place}. Did you mean ${money(v * 10, currency)}?`;
    if (v > sane.high) return `That looks high for ${per} per person in ${sane.place}. Did you mean ${money(Math.round(v / 10), currency)}?`;
    return null;
  };
  const rangeError = lo > 0 && hi > 0 && hi < lo ? `Make "Up to" at least ${money(lo, currency)}, the same as "From" or more.` : undefined;

  const other: Period = view === "year" ? "month" : "year";
  // Computed from the source, so "a year" is exact when they typed a monthly figure and vice versa.
  const srcLo = parseInt(min || "0", 10);
  const srcHi = parseInt(max || "0", 10);
  const eq = lo > 0 && hi > 0 && !rangeError
    ? `About ${money(convertPeriod(srcLo, period, other, currency), currency)}–${money(convertPeriod(srcHi, period, other, currency), currency)} a ${other}.`
    : null;

  return (
    <div>
      <div className="mt-4 inline-flex rounded-full bg-white p-1 ring-1 ring-ink-100" role="radiogroup" aria-label="Budget period">
        {(currency === "NGN" ? (["year", "month"] as const) : (["month", "year"] as const)).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={view === p} onClick={() => changePeriod(p)}
            className={`min-h-[44px] rounded-full px-5 text-sm font-semibold ${view === p ? "bg-ink text-cream" : "text-ink-700"}`}>
            Per {p}
          </button>
        ))}
      </div>

      {picks && (
        <div className="mt-4">
          <p className="text-caption font-semibold text-ink-600" id={`${idPrefix}picks`}>Quick picks <span className="font-normal">(suggestions, not market prices)</span></p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby={`${idPrefix}picks`}>
            {picks.map((x) => {
              const on = picked === x.label || (lo === x.min && hi === x.max);
              return (
                <button key={x.label} type="button" aria-pressed={on} className="choice-chip num"
                  onClick={() => { if (view !== period) setPeriod(view); setMin(String(x.min)); setMax(String(x.max)); setPicked(x.label); }}>
                  {view === picksCfg.period ? x.label : `${money(x.min, currency)}–${money(x.max, currency)}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MoneyInput id={`${idPrefix}rmin`} label="From" currency={currency} period={view} value={minShown} onChange={(v) => edit("min", v)} error={errors.min} />
        <MoneyInput id={`${idPrefix}rmax`} label="Up to" currency={currency} period={view} value={maxShown} onChange={(v) => edit("max", v)} error={errors.max ?? rangeError} />
      </div>
      <p className="helper">Type the full amount, or shorthand like {currency === "NGN" ? "1.5m or 500k" : "1.2k"}.</p>

      {([["From", note(lo)], ["Up to", note(hi)]] as const).filter(([, n]) => n).map(([k, n]) => (
        <p key={k} className="mt-3 rounded-field bg-caution-50 px-3 py-2 text-sm text-caution-800" role="status">
          <strong className="font-semibold">{k}:</strong> {n}
        </p>
      ))}
      {eq && <p className="num mt-3 text-sm text-ink-700" aria-live="polite">{eq}</p>}
      {errors.period && <p className="field-error" role="alert">{errors.period}</p>}
    </div>
  );
}
