"use client";

// DES-37: the one way money is typed in Peabudy.
// - Shows thousands separators as you type (1,000,000) and keeps the caret where you were typing.
//   Backspace or Delete next to a comma removes the digit beyond it, so a comma never gets "stuck".
// - Paste accepts "1,000,000", "₦1,000,000", "£950" and so on: everything but digits is dropped.
// - Shorthand: "1.5m" → 1,500,000 and "500k" → 500,000.
// - Emits a plain digits string in whole currency units (e.g. "1000000"), exactly what the
//   callers already convert to minor units, so no API payload changes.

import { useLayoutEffect, useRef, useState } from "react";

const MAX_DIGITS = 12;

/** "1000000" → "1,000,000". */
export function groupDigits(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Whatever was typed or pasted → digits only (with k/m shorthand), no leading zeros. */
export function parseAmount(raw: string): string {
  const short = /^\s*[₦£]?\s*(\d+(?:[.,]\d+)?)\s*([km])\s*$/i.exec(raw);
  if (short) {
    const n = parseFloat(short[1].replace(",", "."));
    const mult = short[2].toLowerCase() === "m" ? 1_000_000 : 1_000;
    return String(Math.round(n * mult)).slice(0, MAX_DIGITS);
  }
  // Drop pence/kobo after a decimal point: amounts here are whole units.
  const whole = raw.replace(/[.](\d{1,2})\s*$/, "");
  return whole.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITS);
}

export const CURRENCY_SYMBOL: Record<string, string> = { NGN: "₦", GBP: "£" };
const CURRENCY_WORD: Record<string, string> = { NGN: "naira", GBP: "pounds" };

export default function MoneyInput({
  id,
  label,
  currency,
  period,
  value,
  onChange,
  error,
  describedBy,
  hint,
  labelClassName = "label",
}: {
  id: string;
  label: string;
  currency: string;
  /** Spoken with the field: "From, in naira per year". */
  period?: "month" | "year";
  /** Digits only, whole currency units ("" when empty). */
  value: string;
  onChange: (digits: string) => void;
  error?: string;
  describedBy?: string;
  hint?: string;
  labelClassName?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [, rerender] = useState(0); // so a rejected keystroke (same digits) still restores the caret
  const caretDigits = useRef<number | null>(null); // digits to the left of the caret after the next render
  const display = value ? groupDigits(value) : "";

  // Put the caret back after the same number of digits once commas have moved.
  useLayoutEffect(() => {
    const el = ref.current;
    const n = caretDigits.current;
    if (!el || n == null || document.activeElement !== el) return;
    caretDigits.current = null;
    let pos = 0;
    let seen = 0;
    while (pos < display.length && seen < n) {
      if (/\d/.test(display[pos])) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
  }); // every render: a rejected keystroke doesn't change `display` but still needs the caret back

  function handle(raw: string, caret: number) {
    const shorthand = /[km]\s*$/i.test(raw);
    const digits = parseAmount(raw);
    caretDigits.current = shorthand ? digits.length : raw.slice(0, caret).replace(/\D/g, "").replace(/^0+(?=\d)/, "").length;
    onChange(digits);
    rerender((n) => n + 1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const s = el.selectionStart ?? 0;
    if (s !== el.selectionEnd) return;
    // Step over a separator so the key deletes a digit, not the comma it would re-add.
    if (e.key === "Backspace" && display[s - 1] === ",") el.setSelectionRange(s - 1, s - 1);
    if (e.key === "Delete" && display[s] === ",") el.setSelectionRange(s + 1, s + 1);
  }

  const unit = `${CURRENCY_WORD[currency] ?? currency}${period ? ` per ${period}` : ""}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;

  return (
    <div>
      <label className={labelClassName} htmlFor={id}>
        {label}
        <span className="sr-only">, in {unit}</span>
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-ink-600" aria-hidden="true">
          {CURRENCY_SYMBOL[currency] ?? currency}
        </span>
        <input
          ref={ref}
          id={id}
          className="input num pl-9"
          inputMode="numeric"
          pattern="[0-9,]*"
          autoComplete="off"
          enterKeyHint="next"
          value={display}
          placeholder="0"
          onKeyDown={onKeyDown}
          onChange={(e) => handle(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          aria-invalid={!!error}
          aria-describedby={[describedBy, hintId, errId].filter(Boolean).join(" ") || undefined}
        />
      </div>
      {hint && <p id={hintId} className="helper">{hint}</p>}
      {error && <p id={errId} className="field-error" role="alert">{error}</p>}
    </div>
  );
}
