import type { Config } from "tailwindcss";

/**
 * EDUCENTER PRO design tokens.
 * brand  — indigo, primary actions and active states
 * navy   — sidebar surfaces
 * income / expense — finance encodings (validated as a colour-blind-safe pair)
 * accent — cyan, secondary highlight
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc", 400: "#818cf8",
          500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81",
        },
        navy: { 700: "#232a5c", 800: "#1b2150", 900: "#141940", 950: "#0d1130" },
        income: { DEFAULT: "#047857", soft: "#ecfdf5" },
        expense: { DEFAULT: "#fb7185", strong: "#be123c", soft: "#fff1f2" },
        accent: { DEFAULT: "#0891b2", soft: "#ecfeff" },
        surface: "#f6f7fb",
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
        pop: "0 10px 30px -10px rgba(16,24,40,.25), 0 4px 10px -4px rgba(16,24,40,.08)",
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem" },
    },
  },
  plugins: [],
} satisfies Config;
