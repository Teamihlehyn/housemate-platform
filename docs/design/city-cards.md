# City photo cards (DES-24): handoff for the product manager and engineer

Founder request (10 Nov 2026): replace the £ / ₦ symbol cards on the "Which city?" step with
photos of London and Lagos. Built by the designer, uncommitted.

## What changed

| Where | Change |
|---|---|
| `components/apply/CityCard.tsx` (new) | The photo card. Exports `CITY_VISUALS` (photo, alt text, crop) so every city visual uses one source |
| `components/apply/StepBody.tsx` | The city step uses `CityCard`: stacked on phones, side by side from 640 px. A city with a status chip sorts last, so in the Lagos pilot Lagos comes first |
| `app/join/page.tsx` | London carries the chip "Opening later — we'll hold your application" (F4). It stays selectable; choosing it shows a short note, and submit returns `waitlisted` |
| `app/(app)/onboarding/page.tsx` | Same cards, without the chip (demo modes) |
| `components/landing/CitySwitch.tsx` | A 16:9 photo above each city's text |
| `app/(app)/profile/page.tsx` | A short photo banner (decorative) on the profile header |

## The card

- The photo fills the card (`object-fit: cover`), 16:10 on phones and 4:3 from 640 px.
- A solid-to-transparent gradient at the bottom (`rgb(20 19 16 / .92)` → `.55` → transparent, no blur)
  carries the white city name (24 px, 800) and "Rent usually per month/year" (14 px, 500). White
  on the scrim's lower half is above 4.5:1 in both photos.
- A white currency chip (£ / ₦) at the top left. The optional status chip (sky-100 on sky-800) sits
  above the name.
- Selected: a 4 px ink ring with a 2 px offset, an ink check badge at the top right, and a 2 %
  scale-up that's `motion-safe:` only. Unselected cards keep full colour: they're never greyed out.
- `role="radio"` inside a `role="radiogroup"`; the button's accessible name is "Lagos. Rent usually
  per year" (plus the chip text when there is one). The photo keeps its alt text for anything that
  reads images. Focus ring: 4 px brand-500.
- Crop: London `object-position: 72% 40%` keeps Big Ben in frame; Lagos `50% 35%` keeps the
  Civic Centre tower and the lagoon. Checked at 320, 360, 390, 430, 768 and 1280 px.

Alt text:
- London: "Big Ben and the Houses of Parliament by Westminster Bridge, London"
- Lagos: "Lagos lagoon and the Civic Centre tower, Lagos"

## Assets (in `public/cities/`)

| File | Size | Bytes |
|---|---|---|
| `london-480.jpg` | 480 × 320 | 35 KB |
| `london-960.jpg` | 960 × 640 | 85 KB |
| `lagos-480.jpg` | 480 × 270 | 40 KB |
| `lagos-960.jpg` | 960 × 540 | 102 KB |

All under the budget (≤ 60 KB at 480 w, ≤ 120 KB at 960 w). Made with macOS `sips` from the
founder's AVIF originals (quality 62 at 480 w, 48 at 960 w). The originals were not changed.

**JPEG only, no AVIF/WebP.** `sips` reads AVIF and WebP but can't write them, and there's no
`cwebp`, `avifenc` or ImageMagick on this machine. The pages use a plain `<img srcset sizes>`
(no `next/image`), so a phone at 360 px downloads the 480 w file (35–40 KB) and a 2× screen the
960 w one. Images are `loading="lazy"` and `decoding="async"`; the city step is screen 3, so
they load as it opens.

## Engineer requests (optional, not blocking)

1. **AVIF copies (saves about 40 %).** If you have a build tool that writes AVIF, add
   `london-480.avif` etc. at the same sizes and I'll switch `CityCard` to a `<picture>` with an
   AVIF `<source>` and the JPEG fallback. No change is needed in `next.config.ts` for the current
   approach.
2. **Caching:** Vercel serves `public/` with `cache-control: public, max-age=0, must-revalidate`
   by default. These files never change in place (a new photo gets a new name), so a
   `headers()` rule in `next.config.ts` for `/cities/:path*` with
   `public, max-age=31536000, immutable` would save repeat downloads on mobile data.
3. **Prefetch (nice to have):** no change needed; the files are small enough.

## For the product manager

- **Rights: unknown.** Photo credit and licence for both images are not recorded. The founder
  must confirm Peabudy has the right to use them (own photos, a licence, or a free-to-use source
  with any attribution it requires) before launch. If attribution is required, I'll add a small
  credit line on the landing page.
- The Lagos photo shows a real street and buildings with cars; no person is identifiable at these
  sizes. The London photo shows crowds on Westminster Bridge at a distance; no one is identifiable.
- Honesty check: the photos are illustrations of the city, not homes. They never appear next to
  a listing or a person's profile in a way that could suggest "this is where they live" (the
  profile banner is decorative and shows only the city the person chose).
