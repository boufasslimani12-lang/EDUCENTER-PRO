import type { Locale } from "./i18n";

const tag = (l: Locale) => (l === "ar" ? "ar-MA" : "fr-MA");

export function money(v: number | string | null | undefined, locale: Locale, currency = "MAD") {
  const n = Number(v ?? 0);
  return new Intl.NumberFormat(tag(locale), { style: "currency", currency, minimumFractionDigits: 2, numberingSystem: "latn" }).format(n);
}

export function date(v: string | Date | null | undefined, locale: Locale) {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v.length === 10 ? v + "T00:00:00" : v) : v;
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: "medium", numberingSystem: "latn" }).format(d);
}

export function monthLabel(period: string, locale: Locale) {
  const d = new Date(period.slice(0, 7) + "-01T00:00:00");
  return new Intl.DateTimeFormat(tag(locale), { month: "long", year: "numeric", numberingSystem: "latn" }).format(d);
}

export function pct(v: number) {
  return `${Math.round(v * 10) / 10}%`;
}

export function firstOfMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
