import type { ReactNode } from "react";
import { getT } from "@/lib/i18n";
import { LocaleSwitcher } from "./locale-switcher";

export async function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  const { t, locale } = await getT();
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold tracking-tight text-brand-700">{t.app.name}</div>
          <p className="mt-1 text-sm text-slate-500">{t.app.tagline}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-lg font-semibold">{title}</h1>
          {children}
        </div>
        <div className="mt-4 flex justify-center"><LocaleSwitcher locale={locale} /></div>
      </div>
    </main>
  );
}
