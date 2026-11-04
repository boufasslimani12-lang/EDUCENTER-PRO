import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/lib/i18n";
import { signOut } from "@/app/actions/auth";
import { LocaleSwitcher } from "./locale-switcher";
import { NavLink } from "./nav-link";

export type NavItem = { href: string; label: string; section?: string };

export async function Shell({ brand, subtitle, nav, children, userEmail, banner }: {
  brand: string; subtitle?: ReactNode; nav: NavItem[]; children: ReactNode; userEmail: string; banner?: ReactNode;
}) {
  const { t, locale } = await getT();
  const sections = Array.from(new Set(nav.map((n) => n.section ?? "")));
  const navEl = (
    <nav className="space-y-4">
      {sections.map((s) => (
        <div key={s}>
          {s && <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s}</div>}
          <ul className="space-y-0.5">
            {nav.filter((n) => (n.section ?? "") === s).map((n) => (
              <li key={n.href}><NavLink href={n.href}>{n.label}</NavLink></li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print hidden w-64 shrink-0 border-e border-slate-200 bg-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="border-b border-slate-100 px-5 py-4">
            <Link href="/" className="text-lg font-bold text-brand-700">{t.app.name}</Link>
            <div className="truncate text-xs text-slate-500">{brand}</div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-4">{navEl}</div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur">
          <details className="relative lg:hidden">
            <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-xl leading-none ring-1 ring-slate-200" aria-label="Menu">☰</summary>
            <div className="absolute start-0 top-10 z-20 max-h-[80vh] w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">{navEl}</div>
          </details>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-800 lg:hidden">{brand}</div>
            {subtitle && <div className="truncate text-xs text-slate-500">{subtitle}</div>}
          </div>
          <LocaleSwitcher locale={locale} />
          <span className="hidden max-w-[14rem] truncate text-xs text-slate-500 sm:inline" dir="ltr">{userEmail}</span>
          <form action={signOut}>
            <button className="rounded-lg px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">{t.common.logout}</button>
          </form>
        </header>
        {banner}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
