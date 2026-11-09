import type { Config } from "tailwindcss";

// Peabudy design tokens ("Calm ledger" system, applied Nov 2026).
// Spec: docs/design/design-system.md. Semantic colours read CSS variables (RGB triplets in
// app/globals.css) so a future dark theme only swaps variables.
const v = (name: string) => `rgb(var(--pb-${name}) / <alpha-value>)`;

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm neutrals. `ink` stays the default text colour; ink-500 is the lowest text colour.
        ink: {
          DEFAULT: "#23221e",
          900: "#23221e",
          700: "#4a4740",
          600: "#5f5b52",
          500: "#6b675e", // 5.13:1 on paper — minimum for text
          400: "#8f897c", // control borders / icons only (3.48:1 on white)
          300: "#b9b3a5", // decorative / disabled borders only
          100: "#e4e0d6", // hairlines
          50: "#efeae0", // muted fills
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
        // Mascot greens: illustration only, never text on light backgrounds.
        pea: {
          50: "#f3f9ea",
          100: "#e6f3d6",
          200: "#cde7ad",
          300: "#b3da86",
          400: "#97c964",
          500: "#7cb24a",
          600: "#5f9136",
          700: "#46702a",
        },
        apricot: { 100: "#fbe7d6", 300: "#f3be95", 500: "#e7965f", 800: "#8a3f14" },
        lilac: { 100: "#ece6fb", 300: "#c8b9f1", 500: "#9b86e0", 800: "#4f3794" },
        sky: { 100: "#e1ecfa", 300: "#a9c6ee", 500: "#5b8fd6", 800: "#17518f" },
        caution: { 50: "#fdf1d8", 200: "#f0d39a", 800: "#7a4b00" },
        danger: { 50: "#fdecea", 200: "#f5c2bd", 600: "#b42318", 700: "#9f1d14" },
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
        "h1-md": ["2rem", { lineHeight: "2.375rem", letterSpacing: "-0.02em", fontWeight: "700" }],
        display: ["2rem", { lineHeight: "2.25rem", letterSpacing: "-0.03em", fontWeight: "800" }],
        "display-md": ["2.75rem", { lineHeight: "3rem", letterSpacing: "-0.03em", fontWeight: "800" }],
        "display-xl": ["2.625rem", { lineHeight: "2.875rem", letterSpacing: "-0.035em", fontWeight: "800" }],
        "display-xl-md": ["4.25rem", { lineHeight: "4.375rem", letterSpacing: "-0.04em", fontWeight: "800" }],
        "money-xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em", fontWeight: "700" }],
      },
      letterSpacing: { tightest: "-0.045em" },
      // Named radii so Tailwind's default rounded-sm/md/lg/xl keep working.
      borderRadius: {
        tag: "10px",
        field: "14px",
        panel: "20px",
        card: "24px",
        sheet: "32px",
        "4xl": "2rem",
        "5xl": "2.5rem",
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
        // Mascot motion: opacity/transform only, gentle amplitudes.
        bob: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(.6) translateY(6px)" },
          "70%": { opacity: "1", transform: "scale(1.06)" },
          "100%": { opacity: "1", transform: "none" },
        },
        wiggle: { "0%,100%": { transform: "rotate(0)" }, "30%": { transform: "rotate(-6deg)" }, "60%": { transform: "rotate(5deg)" } },
        blink: { "0%,92%,100%": { transform: "scaleY(1)" }, "95%": { transform: "scaleY(.1)" } },
      },
      animation: {
        marquee: "marquee 32s linear infinite",
        "marquee-slow": "marquee 48s linear infinite",
        shimmer: "shimmer 2.2s ease-in-out infinite",
        "rise-in": "rise-in 240ms cubic-bezier(.2,0,0,1) both",
        "sheet-in": "sheet-in 320ms cubic-bezier(.3,0,0,1) both",
        "tick-draw": "tick-draw 320ms cubic-bezier(.3,0,0,1) both",
        bob: "bob 3.2s ease-in-out infinite",
        "bob-slow": "bob 4.4s ease-in-out infinite",
        "pop-in": "pop-in 420ms cubic-bezier(.3,0,0,1) both",
        wiggle: "wiggle 520ms ease-in-out both",
        blink: "blink 4.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
