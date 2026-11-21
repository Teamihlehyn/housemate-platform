"use client";

// DES-31: your search, visible and editable on Discover. Chips show the areas, budget and dates
// that decide who you see; "Edit" opens a sheet for areas and budget (the city is locked after
// approval; dates and habits stay on Profile). Saving uses the same PATCH /me/search as
// everywhere else (a SearchVersion is written), then Discover reloads in place.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { CITIES, CityId } from "@/lib/constants";
import StepBody from "@/components/apply/StepBody";
import { useProfileDraft } from "@/components/apply/useProfileDraft";
import { IconCalendar, IconPin, IconWallet } from "@/components/icons";

type Search = {
  cityId: CityId | null;
  areas: string[];
  rentMinMinor: number | null;
  rentMaxMinor: number | null;
  currency: string;
  rentPeriod: "month" | "year";
  earliestDate: string | null;
  latestDate: string | null;
};

/** "₦1.5m", "₦850k", "£800": short enough for a chip. */
export function shortMoney(minor: number, currency: string) {
  const v = minor / 100;
  const sym = currency === "NGN" ? "₦" : "£";
  if (v >= 1_000_000) return `${sym}${+(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}m`;
  if (v >= 10_000) return `${sym}${Math.round(v / 1000)}k`;
  return `${sym}${v.toLocaleString("en-GB")}`;
}

function monthSpan(a: string | null, b: string | null) {
  if (!a) return "Dates not set";
  const f = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const fy = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  if (!b || a.slice(0, 7) === b.slice(0, 7)) return fy(a);
  return a.slice(0, 4) === b.slice(0, 4) ? `${f(a)}–${fy(b)}` : `${fy(a)}–${fy(b)}`;
}

export default function SearchChips({
  onSaved,
  openSignal,
}: {
  /** Reload Discover; resolves to the number of people who now fit. */
  onSaved: () => Promise<number>;
  /** Increment to open the sheet from elsewhere (e.g. the empty state). */
  openSignal?: number;
}) {
  const [me, setMe] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const d = useProfileDraft();
  const { hydrate } = d;
  const editRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (open) titleRef.current?.focus(); }, [open]);

  // ENG-59: GET /me/search returns ready-made chip labels; /me fills the editor.
  const [chips, setChips] = useState<{ areas?: string; budget?: string; dates?: string } | null>(null);
  const load = useCallback(
    () =>
      Promise.all([
        api<any>("/me").then((m) => { setMe(m); hydrate(m); }).catch(() => {}),
        api<{ chips?: { areas?: string; budget?: string; dates?: string } }>("/me/search").then((r) => setChips(r.chips ?? null)).catch(() => setChips(null)),
      ]),
    [hydrate],
  );
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (openSignal) { hydrate(me); setOpen(true); } }, [openSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  const s: Search | null = me?.search ?? null;
  if (!s?.cityId) return null;
  const city = CITIES[s.cityId];
  const areaText = s.areas.map((a) => city.areas.find((x) => x.id === a)?.label ?? a).join(", ") || "No areas";
  const budget =
    s.rentMinMinor != null && s.rentMaxMinor != null
      ? `${shortMoney(s.rentMinMinor, s.currency)}–${shortMoney(s.rentMaxMinor, s.currency).replace(/^[₦£]/, "")}/${s.rentPeriod === "year" ? "yr" : "mo"}`
      : "No budget";

  function close() {
    setOpen(false);
    d.setErrors({});
    hydrate(me);
    editRef.current?.focus();
  }

  async function save() {
    const r = await d.save(["areas", "budget"]);
    if (!r.ok) return;
    await load();
    const n = await onSaved();
    setOpen(false);
    setResult(n === 0 ? "Saved. No one fits these yet: try another area or a wider budget." : `Saved. ${n} ${n === 1 ? "person fits" : "people fit"} now.`);
    editRef.current?.focus();
  }

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-2" aria-label="Your search">
        <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-ink ring-1 ring-ink-100">
          <IconPin size={16} className="shrink-0 text-ink-600" />
          <span className="sr-only">Areas: </span>
          <span className="max-w-[14rem] truncate">{chips?.areas ?? `${city.label.replace(/ pilot$/, "")} · ${areaText}`}</span>
        </span>
        <span className="num inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-ink ring-1 ring-ink-100">
          <IconWallet size={16} className="shrink-0 text-ink-600" />
          <span className="sr-only">Budget per person: </span>{chips?.budget ?? budget}
        </span>
        <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-ink ring-1 ring-ink-100">
          <IconCalendar size={16} className="shrink-0 text-ink-600" />
          <span className="sr-only">Move-in: </span>{chips?.dates ?? monthSpan(s.earliestDate, s.latestDate)}
        </span>
        <button ref={editRef} type="button" className="btn-secondary min-h-[44px] px-4" onClick={() => { hydrate(me); setResult(null); setOpen(true); }}>
          Edit<span className="sr-only"> areas and budget</span>
        </button>
      </div>
      {result && <p role="status" className="mt-2 text-sm font-medium text-brand-800">{result}</p>}

      {open && (
        <div className="fixed inset-0 z-50 grid items-end bg-black/40 sm:place-items-center sm:p-4" onClick={close} onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sc-title"
            className="flex max-h-[90dvh] w-full animate-sheet-in flex-col rounded-t-sheet bg-white sm:max-w-lg sm:rounded-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto p-5 sm:p-6">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink-100 sm:hidden" aria-hidden="true" />
              <h2 id="sc-title" className="text-h2 text-ink" tabIndex={-1} ref={titleRef}>Change areas and budget</h2>
              <p className="mt-1 text-sm text-ink-600">
                In {city.label.replace(/ pilot$/, "")}. Discover updates as soon as you save. Dates and habits are on your{" "}
                <Link href="/profile" className="font-semibold text-brand-700 underline underline-offset-2">profile</Link>.
              </p>
              <div className="mt-5 space-y-6">
                <StepBody screen="areas" d={d} compact idPrefix="sc-" />
                <StepBody screen="budget" d={d} compact idPrefix="sc-" />
              </div>
            </div>
            {/* Actions stay in reach of the thumb, above the home bar. */}
            <div className="flex flex-col-reverse gap-2 border-t border-ink-100 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:flex-row sm:justify-end sm:px-6">
              <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={save} aria-busy={d.saveState === "saving"}>
                {d.saveState === "saving" ? "Saving…" : "Save and update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
