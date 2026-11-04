import { cookies } from "next/headers";
import { fr, type Dictionary } from "./fr";
import { ar } from "./ar";

export type Locale = "fr" | "ar";
export const LOCALE_COOKIE = "locale";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  return c === "ar" ? "ar" : "fr";
}

export async function getT(): Promise<{ t: Dictionary; locale: Locale; dir: "rtl" | "ltr" }> {
  const locale = await getLocale();
  return { t: locale === "ar" ? ar : fr, locale, dir: locale === "ar" ? "rtl" : "ltr" };
}

export type { Dictionary };
