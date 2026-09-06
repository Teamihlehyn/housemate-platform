import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
