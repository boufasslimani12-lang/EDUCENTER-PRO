import { setLocale } from "@/app/actions/locale";

export function LocaleSwitcher({ locale }: { locale: "fr" | "ar" }) {
  return (
    <form action={setLocale} className="flex overflow-hidden rounded-lg ring-1 ring-slate-300">
      {(["fr", "ar"] as const).map((l) => (
        <button
          key={l}
          name="locale"
          value={l}
          aria-pressed={l === locale}
          className={`px-2.5 py-1 text-xs font-medium ${l === locale ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          {l === "fr" ? "FR" : "عربي"}
        </button>
      ))}
    </form>
  );
}
