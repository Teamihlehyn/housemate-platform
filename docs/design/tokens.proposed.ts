/**
 * HISTORICAL: the original Calm ledger proposal. Applied on 9 Nov 2026 with the Peabudy rename;
 * the source of truth is now tailwind.config.ts and app/globals.css (variables renamed --hm-* → --pb-*).
 *
 * Peabudy (formerly Housemate) design tokens — as proposed.
 * See docs/design/design-system.md. To adopt once approved:
 *
 *   // tailwind.config.ts
 *   import { themeExtend } from "./docs/design/tokens.proposed"; // or move this file to lib/design/
 *   theme: { extend: themeExtend }
 *
 *   // app/globals.css — paste `cssVariables` at the top (after @tailwind directives)
 *
 *   // app/layout.tsx
 *   import { Plus_Jakarta_Sans, Inter } from "next/font/google";
 *   const display = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext", "vietnamese"],
 *     variable: "--font-display", weight: ["500", "600", "700", "800"], display: "swap" });
 *   const sans = Inter({ subsets: ["latin", "latin-ext", "vietnamese"],
 *     variable: "--font-sans", display: "swap" });
 *   // latin-ext carries ₦ and Ṣ; vietnamese carries Ọ/Ẹ precomposed and combining tone marks.
 *
 * Semantic colours read CSS variables (RGB triplets) so a future dark theme only swaps
 * variables; raw scales stay available as hex for one-off use.
 */

const v = (name: string) => `rgb(var(--hm-${name}) / <alpha-value>)`;

export const palette = {
  ink: {
    DEFAULT: "#23221e",
    900: "#23221e",
    700: "#4a4740",
    600: "#5f5b52",
    500: "#6b675e", // lowest text colour: 5.13:1 on canvas
    400: "#8f897c", // control borders/icons: 3.48:1 on white
    300: "#b9b3a5", // decorative / disabled borders only
    100: "#e4e0d6", // hairlines
    50: "#efeae0", // muted fills, sample tag
  },
  paper: "#f6f4ef",
  cream: "#faf9f5",
  brand: {
    50: "#f0f7f4",
    100: "#dbece4",
    200: "#b9d9cd",
    300: "#8dbfae",
    400: "#5e9f8b",
    500: "#3f8471",
    600: "#2f6a5a",
    700: "#28554a",
    800: "#22453d",
    900: "#1e3a33",
  },
  apricot: { 100: "#fbe7d6", 500: "#e7965f", 800: "#8a3f14" },
  lilac: { 100: "#ece6fb", 500: "#9b86e0", 800: "#4f3794" },
  sky: { 100: "#e1ecfa", 500: "#5b8fd6", 800: "#17518f" },
  caution: { 50: "#fdf1d8", 200: "#f0d39a", 800: "#7a4b00" },
  danger: { 50: "#fdecea", 200: "#f5c2bd", 600: "#b42318", 700: "#9f1d14" },
} as const;

export const themeExtend = {
  colors: {
    ...palette,
    // Semantic (theme-aware)
    canvas: v("canvas"),
    surface: { DEFAULT: v("surface"), soft: v("surface-soft") },
    fg: { DEFAULT: v("fg"), muted: v("fg-muted"), subtle: v("fg-subtle") },
    line: { DEFAULT: v("line"), strong: v("line-strong") },
    primary: { DEFAULT: v("primary"), fg: v("primary-fg") },
    confirm: { DEFAULT: v("confirm"), fg: v("confirm-fg") },
    focus: v("focus"),
  },
  fontFamily: {
    sans: ["var(--font-sans)", "system-ui", "sans-serif"],
    display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
  },
  fontSize: {
    caption: ["0.8125rem", { lineHeight: "1.125rem", fontWeight: "500" }],
    "body-sm": ["0.875rem", { lineHeight: "1.25rem" }],
    body: ["1rem", { lineHeight: "1.5rem" }],
    "body-lg": ["1.125rem", { lineHeight: "1.75rem" }],
    h3: ["1.0625rem", { lineHeight: "1.5rem", fontWeight: "600" }],
    h2: ["1.25rem", { lineHeight: "1.625rem", letterSpacing: "-0.015em", fontWeight: "700" }],
    h1: ["1.625rem", { lineHeight: "2rem", letterSpacing: "-0.02em", fontWeight: "700" }],
    display: ["2rem", { lineHeight: "2.25rem", letterSpacing: "-0.03em", fontWeight: "800" }],
    "display-xl": ["2.5rem", { lineHeight: "2.75rem", letterSpacing: "-0.035em", fontWeight: "800" }],
    "money-xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em", fontWeight: "700" }],
    // Desktop steps: use md:text-[...] or the md variants below
    "h1-md": ["2rem", { lineHeight: "2.375rem", letterSpacing: "-0.02em", fontWeight: "700" }],
    "display-md": ["2.75rem", { lineHeight: "3rem", letterSpacing: "-0.03em", fontWeight: "800" }],
    "display-xl-md": ["4rem", { lineHeight: "4.25rem", letterSpacing: "-0.035em", fontWeight: "800" }],
  },
  letterSpacing: { tightest: "-0.045em" }, // kept for the landing page
  // Named radii so Tailwind's default rounded-sm/md/lg/xl keep working during migration.
  // (Tailwind's default rounded-3xl is already 24px = card.)
  borderRadius: {
    tag: "10px",
    field: "14px",
    panel: "20px",
    card: "24px",
    sheet: "32px",
    "4xl": "2rem", // existing
    "5xl": "2.5rem", // existing
  },
  boxShadow: {
    e1: "0 1px 2px rgb(35 34 30 / 0.06)",
    e2: "0 8px 16px -8px rgb(35 34 30 / 0.18)", // max blur 16px — no heavy shadows
  },
  transitionDuration: { instant: "100ms", quick: "160ms", standard: "240ms", gentle: "320ms" },
  transitionTimingFunction: {
    standard: "cubic-bezier(.2,0,0,1)",
    gentle: "cubic-bezier(.3,0,0,1)",
  },
  keyframes: {
    marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
    shimmer: { "0%": { opacity: "0.55" }, "50%": { opacity: "1" }, "100%": { opacity: "0.55" } },
    "rise-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
    "sheet-in": { from: { transform: "translateY(24px)", opacity: "0" }, to: { transform: "none", opacity: "1" } },
    "tick-draw": { from: { strokeDashoffset: "24" }, to: { strokeDashoffset: "0" } },
  },
  animation: {
    marquee: "marquee 32s linear infinite",
    "marquee-slow": "marquee 48s linear infinite",
    shimmer: "shimmer 2.2s ease-in-out infinite",
    "rise-in": "rise-in 240ms cubic-bezier(.2,0,0,1) both",
    "sheet-in": "sheet-in 320ms cubic-bezier(.3,0,0,1) both",
    "tick-draw": "tick-draw 320ms cubic-bezier(.3,0,0,1) both",
  },
} as const;

/** Paste into app/globals.css. RGB triplets so Tailwind opacity modifiers work. */
export const cssVariables = /* css */ `
:root {
  --hm-canvas: 246 244 239;       /* #f6f4ef */
  --hm-surface: 255 255 255;
  --hm-surface-soft: 250 249 245; /* #faf9f5 */
  --hm-fg: 35 34 30;              /* #23221e  14.48:1 on canvas */
  --hm-fg-muted: 74 71 64;        /* #4a4740   8.43:1 */
  --hm-fg-subtle: 107 103 94;     /* #6b675e   5.13:1 */
  --hm-line: 228 224 214;         /* #e4e0d6 decorative */
  --hm-line-strong: 143 137 124;  /* #8f897c  3.48:1 on white (controls) */
  --hm-primary: 35 34 30;         /* ink pill */
  --hm-primary-fg: 250 249 245;   /* 15.11:1 */
  --hm-confirm: 47 106 90;        /* brand-600 */
  --hm-confirm-fg: 255 255 255;   /* 6.31:1 */
  --hm-focus: 63 132 113;         /* brand-500, 4.02:1 on canvas */
}

/* Dark theme — defined, not shipped (see design-system.md §5). */
:root[data-theme="dark"] {
  --hm-canvas: 22 21 18;          /* #161512 */
  --hm-surface: 31 30 26;         /* #1f1e1a */
  --hm-surface-soft: 39 38 33;
  --hm-fg: 243 241 234;           /* 16.16:1 */
  --hm-fg-muted: 181 176 164;     /* 7.71:1 on surface */
  --hm-fg-subtle: 160 155 143;
  --hm-line: 52 50 44;
  --hm-line-strong: 120 115 104;
  --hm-primary: 141 191 174;      /* brand-300 */
  --hm-primary-fg: 22 21 18;      /* 8.87:1 */
  --hm-confirm: 141 191 174;
  --hm-confirm-fg: 22 21 18;
  --hm-focus: 141 191 174;
}

.num { font-variant-numeric: tabular-nums; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  .animate-shimmer, .animate-marquee, .animate-marquee-slow { animation: none !important; }
}
`;
