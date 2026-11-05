"use client";
import { useEffect } from "react";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui";

const copy = {
  fr: { title: "Impossible de charger cette page", body: "Une erreur est survenue lors du chargement des données. Réessayez dans un instant.", retry: "Réessayer" },
  ar: { title: "تعذر تحميل هذه الصفحة", body: "حدث خطأ أثناء تحميل البيانات. أعد المحاولة بعد لحظات.", retry: "إعادة المحاولة" },
};

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const l = typeof document !== "undefined" && document.documentElement.lang === "ar" ? copy.ar : copy.fr;
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-card">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600"><Icon name="alert" className="h-6 w-6" /></span>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">{l.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{l.body}</p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-slate-400" dir="ltr">ref: {error.digest}</p>}
      <button type="button" onClick={reset} className={buttonClass("primary") + " mt-5"}><Icon name="refresh" className="h-4 w-4" />{l.retry}</button>
    </div>
  );
}
