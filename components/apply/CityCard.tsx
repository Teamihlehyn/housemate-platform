"use client";

// City photo card (founder request, 10 Nov 2026). The photo fills the card; a solid-to-
// transparent gradient at the bottom (no blur) carries the white city name at AA contrast.
// Radio semantics come from the parent radiogroup. Images are small JPEGs in public/cities
// (480 w / 960 w) so the step stays light on mobile data. See docs/design/city-cards.md.

import { IconCheck } from "@/components/icons";
import type { CityId } from "@/lib/constants";

export const CITY_VISUALS: Record<CityId, { name: string; symbol: string; alt: string; position: string; src: string; srcSet: string }> = {
  london: {
    name: "London",
    symbol: "£",
    alt: "Big Ben and the Houses of Parliament by Westminster Bridge, London",
    // Big Ben sits right of centre; keep it in frame on narrow crops.
    position: "72% 40%",
    src: "/cities/london-480.jpg",
    srcSet: "/cities/london-480.jpg 480w, /cities/london-960.jpg 960w",
  },
  lagos: {
    name: "Lagos",
    symbol: "₦",
    alt: "Lagos lagoon and the Civic Centre tower, Lagos",
    // The tower is centre-left, the lagoon to its right.
    position: "50% 35%",
    src: "/cities/lagos-480.jpg",
    srcSet: "/cities/lagos-480.jpg 480w, /cities/lagos-960.jpg 960w",
  },
};

export default function CityCard({
  city,
  checked,
  onClick,
  sub,
  badge,
  id,
}: {
  city: CityId;
  checked: boolean;
  onClick: () => void;
  /** Line under the name, e.g. "Rent usually per year". */
  sub: string;
  /** Optional status chip, e.g. "Opening later — we'll hold your application". */
  badge?: string;
  id?: string;
}) {
  const v = CITY_VISUALS[city];
  return (
    <button
      id={id}
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={`${v.name}. ${sub}${badge ? `. ${badge}` : ""}`}
      onClick={onClick}
      className={`group relative block aspect-[16/10] w-full overflow-hidden rounded-card bg-ink-100 text-left transition duration-quick focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:aspect-[4/3] ${
        checked ? "ring-4 ring-ink ring-offset-2 ring-offset-paper motion-safe:scale-[1.02]" : "ring-1 ring-ink-100 hover:ring-2 hover:ring-ink-400"
      }`}
    >
      <img
        src={v.src}
        srcSet={v.srcSet}
        sizes="(min-width: 640px) 280px, calc(100vw - 32px)"
        alt={v.alt}
        width={480}
        height={300}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: v.position }}
      />
      {/* Solid-to-transparent scrim for the text: no blur, so it's cheap on low-end phones. */}
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-[rgb(20_19_16/0.92)] via-[rgb(20_19_16/0.55)] to-transparent" />

      <span className="absolute left-3 top-3 inline-flex h-8 min-w-[32px] items-center justify-center rounded-full bg-white px-2.5 text-sm font-bold text-ink" aria-hidden="true">
        {v.symbol}
      </span>
      {checked && (
        <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-ink text-cream ring-2 ring-white" aria-hidden="true">
          <IconCheck size={16} strokeWidth={3} />
        </span>
      )}

      <span className="absolute inset-x-0 bottom-0 p-4">
        {badge && (
          <span className="mb-2 inline-block rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold leading-tight text-sky-800">{badge}</span>
        )}
        <span className="block font-display text-2xl font-extrabold leading-tight text-white">{v.name}</span>
        <span className="block text-sm font-medium text-white">{sub}</span>
      </span>
    </button>
  );
}
