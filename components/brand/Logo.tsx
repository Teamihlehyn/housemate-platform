import Link from "next/link";

// Peabudy logo: the "Pod" mark (two peas, one pod = two housemates, one home) plus a
// custom monoline wordmark drawn from circles and stems, so it needs no font file and stays
// identical in the app, the favicon and public/peabudy-logo.svg.

const POD = "#2f6a5a"; // brand-600
const POD_INNER = "#dbece4"; // brand-100
const PEA = "#97c964"; // pea-400
const PEA_SHADE = "#7cb24a"; // pea-500

export function PodMark({ size = 32, faces = true, className = "" }: { size?: number; faces?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="18" fill={POD} />
      {/* open pod */}
      <path d="M8 34 C16 18 48 18 56 34 C48 46 16 46 8 34 Z" fill={POD_INNER} />
      {/* stem */}
      <path d="M54 30 c4 -3 6 -7 5 -12" stroke={POD_INNER} strokeWidth="3.2" strokeLinecap="round" fill="none" />
      {/* two peas */}
      <circle cx="23.5" cy="33" r="9.5" fill={PEA_SHADE} />
      <circle cx="22.8" cy="32.3" r="8.7" fill={PEA} />
      <circle cx="40.5" cy="33" r="9.5" fill={PEA_SHADE} />
      <circle cx="39.8" cy="32.3" r="8.7" fill={PEA} />
      {faces && (
        <g fill="#23221e">
          <circle cx="20.2" cy="31.4" r="1.35" />
          <circle cx="25.6" cy="31.4" r="1.35" />
          <circle cx="37.2" cy="31.4" r="1.35" />
          <circle cx="42.6" cy="31.4" r="1.35" />
          <path d="M21 35.2 q1.9 1.8 3.8 0" stroke="#23221e" strokeWidth="1.1" strokeLinecap="round" fill="none" />
          <path d="M38 35.2 q1.9 1.8 3.8 0" stroke="#23221e" strokeWidth="1.1" strokeLinecap="round" fill="none" />
        </g>
      )}
    </svg>
  );
}

/** Monoline wordmark "peabudy". Glyphs: x-height 40, stroke 9, 46-unit advance. */
export const WORDMARK_PATHS = [
  // p
  "M4.5 4.5V57.5M4.5 20a15.5 15.5 0 1 0 31 0a15.5 15.5 0 1 0 -31 0",
  // e
  "M50.5 20H81.5A15.5 15.5 0 1 0 77 31",
  // a
  "M96.5 20a15.5 15.5 0 1 0 31 0a15.5 15.5 0 1 0 -31 0M127.5 4.5V35.5",
  // b
  "M142.5 -17.5V35.5M142.5 20a15.5 15.5 0 1 0 31 0a15.5 15.5 0 1 0 -31 0",
  // u
  "M188.5 4.5V20A15.5 15.5 0 0 0 219.5 20M219.5 4.5V35.5",
  // d
  "M234.5 20a15.5 15.5 0 1 0 31 0a15.5 15.5 0 1 0 -31 0M265.5 -17.5V35.5",
  // y
  "M280.5 4.5V20A15.5 15.5 0 0 0 311.5 20M311.5 4.5V45A13 13 0 0 1 298.5 58H287",
];

export function Wordmark({ height = 22, className = "", color = "currentColor" }: { height?: number; className?: string; color?: string }) {
  // viewBox: x 0..316, y -22..62 (84 tall)
  const width = (316 / 84) * height;
  return (
    <svg width={width} height={height} viewBox="0 -22 316 84" className={className} aria-hidden="true" focusable="false">
      <g fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        {WORDMARK_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

export default function Logo({
  href = "/",
  size = "md",
  className = "",
  tone = "ink",
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  tone?: "ink" | "cream";
}) {
  const mark = size === "lg" ? 40 : size === "sm" ? 28 : 34;
  const word = size === "lg" ? 26 : size === "sm" ? 18 : 21;
  return (
    <Link
      href={href}
      aria-label="Peabudy home"
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${tone === "cream" ? "text-cream" : "text-ink"} ${className}`}
    >
      <PodMark size={mark} />
      <Wordmark height={word} className="mt-[3px]" />
    </Link>
  );
}
