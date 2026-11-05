import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Supabase rows are untyped until generated types are added; allow `any` at data boundaries.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
];

export default config;
