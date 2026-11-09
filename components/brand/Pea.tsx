// Peabudy's mascots: round, friendly peas. Pure SVG, no state, safe in server components.
// Decorative by default (aria-hidden). Pass `label` when the pea carries meaning.

export type PeaMood = "sleep" | "awake" | "happy" | "wow" | "wink";
export type PeaTone = "pea" | "fresh" | "sage" | "apricot" | "lilac" | "sky";

const TONES: Record<PeaTone, { body: string; shade: string; light: string }> = {
  pea: { body: "#97c964", shade: "#7cb24a", light: "#d3ecb4" },
  fresh: { body: "#b3da86", shade: "#97c964", light: "#e6f3d6" },
  sage: { body: "#8dbfae", shade: "#5e9f8b", light: "#dbece4" },
  apricot: { body: "#f3be95", shade: "#e7965f", light: "#fbe7d6" },
  lilac: { body: "#c8b9f1", shade: "#9b86e0", light: "#ece6fb" },
  sky: { body: "#a9c6ee", shade: "#5b8fd6", light: "#e1ecfa" },
};

const INK = "#23221e";

export default function Pea({
  size = 64,
  mood = "awake",
  tone = "pea",
  blink = false,
  dim = false,
  label,
  className = "",
  look = { x: 0, y: 0 },
}: {
  size?: number;
  mood?: PeaMood;
  tone?: PeaTone;
  /** Idle blink (stops under reduced motion). */
  blink?: boolean;
  /** Sleeping peas are drawn a little paler. */
  dim?: boolean;
  label?: string;
  className?: string;
  /** Pupil offset in px of the 100-unit box, clamp to ±4. */
  look?: { x: number; y: number };
}) {
  const t = TONES[tone];
  const lx = Math.max(-4, Math.min(4, look.x));
  const ly = Math.max(-4, Math.min(4, look.y));
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={dim ? { opacity: 0.72 } : undefined}
      focusable="false"
      {...a11y}
    >
      {/* soft ground shadow (no blur) */}
      <ellipse cx="50" cy="95" rx="26" ry="3.5" fill={INK} opacity="0.08" />
      {/* body */}
      <circle cx="50" cy="50" r="42" fill={t.shade} />
      <circle cx="47" cy="47" r="39" fill={t.body} />
      <ellipse cx="34" cy="28" rx="11" ry="7" fill={t.light} opacity="0.8" transform="rotate(-30 34 28)" />
      {/* cheeks */}
      <ellipse cx="27" cy="60" rx="7" ry="4.5" fill="#f28b8b" opacity={mood === "sleep" ? 0.25 : 0.45} />
      <ellipse cx="71" cy="60" rx="7" ry="4.5" fill="#f28b8b" opacity={mood === "sleep" ? 0.25 : 0.45} />

      {/* eyes */}
      {mood === "sleep" && (
        <g stroke={INK} strokeWidth="3.6" strokeLinecap="round" fill="none">
          <path d="M31 50 q6 5 12 0" />
          <path d="M57 50 q6 5 12 0" />
        </g>
      )}
      {mood === "happy" && (
        <g stroke={INK} strokeWidth="3.6" strokeLinecap="round" fill="none">
          <path d="M31 51 q6 -7 12 0" />
          <path d="M57 51 q6 -7 12 0" />
        </g>
      )}
      {(mood === "awake" || mood === "wow") && (
        <g className={`pea-eyes ${blink ? "animate-blink" : ""}`}>
          <ellipse cx={37 + lx} cy={48 + ly} rx="4.6" ry="6" fill={INK} />
          <ellipse cx={63 + lx} cy={48 + ly} rx="4.6" ry="6" fill={INK} />
          <circle cx={38.6 + lx} cy={45.6 + ly} r="1.6" fill="#fff" />
          <circle cx={64.6 + lx} cy={45.6 + ly} r="1.6" fill="#fff" />
        </g>
      )}
      {mood === "wink" && (
        <g>
          <ellipse cx="37" cy="48" rx="4.6" ry="6" fill={INK} />
          <circle cx="38.6" cy="45.6" r="1.6" fill="#fff" />
          <path d="M57 50 q6 -6 12 0" stroke={INK} strokeWidth="3.6" strokeLinecap="round" fill="none" />
        </g>
      )}

      {/* mouth */}
      {mood === "sleep" && <path d="M46 66 h8" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
      {(mood === "awake" || mood === "wink") && (
        <path d="M43 63 q7 7 14 0" stroke={INK} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      )}
      {mood === "happy" && <path d="M41 61 q9 12 18 0 z" fill={INK} />}
      {mood === "wow" && <ellipse cx="50" cy="66" rx="5" ry="6" fill={INK} />}

      {/* sleepy z */}
      {mood === "sleep" && (
        <text x="76" y="26" fontSize="14" fontWeight="700" fill={INK} opacity="0.45" fontFamily="system-ui, sans-serif">
          z
        </text>
      )}
    </svg>
  );
}
