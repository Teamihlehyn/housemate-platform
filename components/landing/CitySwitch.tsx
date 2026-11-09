"use client";

import { useState } from "react";
import { CITIES, CityId } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

// London/Lagos switch: shows how each city works (currency, rent period, areas) with an
// example split. Lagos rent is usually yearly, so we show the monthly equivalent too.

const INFO: Record<CityId, { name: string; rent: string; example: { totalMinor: number; period: "month" | "year" } }> = {
  london: {
    name: "London",
    rent: "Rent is usually paid monthly, in pounds. You set a monthly budget per person.",
    example: { totalMinor: 1900_00, period: "month" },
  },
  lagos: {
    name: "Lagos",
    rent: "Rent is usually paid yearly, in naira. We show a monthly equivalent too, so splits stay fair.",
    example: { totalMinor: 4800000_00, period: "year" },
  },
};

export default function CitySwitch() {
  const [city, setCity] = useState<CityId>("london");
  const cfg = CITIES[city];
  const info = INFO[city];
  const total = info.example.totalMinor;
  const each = total / 2;

  return (
    <div className="rounded-sheet bg-white p-5 ring-1 ring-ink-100 sm:p-10">
      <div role="radiogroup" aria-label="Choose a city" className="mx-auto flex w-fit rounded-full bg-ink-50 p-1">
        {(Object.keys(CITIES) as CityId[]).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={city === c}
            onClick={() => setCity(c)}
            className={`min-h-[44px] min-w-[120px] rounded-full px-5 text-sm font-semibold transition duration-quick focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              city === c ? "bg-ink text-cream" : "text-ink-700 hover:bg-white"
            }`}
          >
            {INFO[c].name}
          </button>
        ))}
      </div>

      <div key={city} className="mt-6 grid animate-rise-in gap-6 md:grid-cols-2 md:gap-10">
        <div>
          <h3 className="font-display text-h1 text-ink md:text-h1-md">{info.name}</h3>
          <p className="mt-2 text-ink-700">{info.rent}</p>
          <p className="mt-5 text-caption text-ink-600">Areas you can choose from (up to 5)</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {cfg.areas.map((a) => (
              <li key={a.id} className="rounded-full border border-ink-100 bg-cream px-3.5 py-1.5 text-sm font-medium text-ink">
                {a.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative rounded-card bg-pastel-soft p-4 sm:p-6">
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink-700">Example</span>
          <p className="text-sm font-semibold text-ink">A 50/50 rent split</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-field bg-white px-4 py-3 ring-1 ring-ink-100">
              <p className="text-xs text-ink-600">Rent for the home</p>
              <p className="num font-display text-h2 text-ink">
                {formatMoney(total, cfg.currency)}
                <span className="text-sm font-semibold text-ink-600">/{info.example.period === "year" ? "yr" : "mo"}</span>
              </p>
            </div>
            <div className="rounded-field bg-white px-4 py-3 ring-1 ring-ink-100">
              <p className="text-xs text-ink-600">Each person pays</p>
              <p className="num font-display text-money-xl text-ink">
                {formatMoney(info.example.period === "year" ? each / 12 : each, cfg.currency)}
                <span className="text-base font-semibold text-ink-600">/mo{info.example.period === "year" ? " equivalent" : ""}</span>
              </p>
              {info.example.period === "year" && <p className="num text-sm text-ink-600">{formatMoney(each, cfg.currency)} a year each</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
