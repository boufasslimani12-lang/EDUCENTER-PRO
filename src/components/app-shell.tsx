"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { LocaleSwitcher } from "./locale-switcher";
import { cx } from "./ui";
import { signOut } from "@/app/actions/auth";
import { markNotificationsRead } from "@/app/actions/notifications";

export type NavItem = { href: string; label: string; icon: IconName; section?: string };
export type NotificationItem = { id: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null };

export type ShellLabels = {
  appName: string; notifications: string; noNotifications: string; markAllRead: string; collapse: string; expand: string;
  openMenu: string; closeMenu: string; profile: string; logout: string; search: string; settings: string; billing: string;
};

type Props = {
  brand: string; subtitle?: string; homeHref: string; nav: NavItem[]; labels: ShellLabels; locale: "fr" | "ar";
  user: { email: string; role: string }; searchHref?: string; settingsHref?: string; billingHref?: string;
  notifications: NotificationItem[]; initialCollapsed: boolean; banner?: ReactNode; children: ReactNode;
};

function isActive(path: string, href: string, homeHref: string) {
  return href === homeHref ? path === href : path === href || path.startsWith(href + "/");
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

function SidebarNav({ nav, path, homeHref, collapsed, onNavigate }: { nav: NavItem[]; path: string; homeHref: string; collapsed: boolean; onNavigate?: () => void }) {
  const sections = Array.from(new Set(nav.map((n) => n.section ?? "")));
  return (
    <nav className="space-y-5">
      {sections.map((s) => (
        <div key={s}>
          {s && !collapsed && <div className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-indigo-200/50">{s}</div>}
          {s && collapsed && <div className="mx-auto mb-2 h-px w-6 bg-white/10" />}
          <ul className="space-y-0.5">
            {nav.filter((n) => (n.section ?? "") === s).map((n) => {
              const active = isActive(path, n.href, homeHref);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={onNavigate}
                    title={collapsed ? n.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors",
                      collapsed && "justify-center px-0",
                      active ? "bg-white/[0.09] font-medium text-white" : "text-indigo-100/70 hover:bg-white/[0.05] hover:text-white",
                    )}
                  >
                    {active && <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-cyan-400" />}
                    <Icon name={n.icon} className={cx("h-[18px] w-[18px] shrink-0", active ? "text-cyan-300" : "text-indigo-200/60 group-hover:text-indigo-100")} />
                    {!collapsed && <span className="truncate">{n.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ brand, subtitle, collapsed, homeHref, appName }: { brand: string; subtitle?: string; collapsed: boolean; homeHref: string; appName: string }) {
  return (
    <Link href={homeHref} className={cx("flex items-center gap-3", collapsed && "justify-center")}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-cyan-500 text-sm font-bold text-white shadow-lg shadow-brand-900/40">E</span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block text-[13px] font-semibold tracking-wide text-white">{appName}</span>
          <span className="block truncate text-xs text-indigo-200/70" title={subtitle ? `${brand} · ${subtitle}` : brand}>{brand}</span>
        </span>
      )}
    </Link>
  );
}

export function AppShell(p: Props) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(p.initialCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState<null | "notif" | "user">(null);
  const close = useCallback(() => setMenu(null), []);
  const notifRef = useDismiss(menu === "notif", close);
  const userRef = useDismiss(menu === "user", close);
  const unread = p.notifications.filter((n) => !n.read_at).length;

  useEffect(() => { setDrawer(false); setMenu(null); }, [path]);
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawer]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sidebar=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  };

  const current = [...p.nav].sort((a, b) => b.href.length - a.href.length).find((n) => isActive(path, n.href, p.homeHref));
  const fmt = new Intl.DateTimeFormat(p.locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "short", timeStyle: "short", numberingSystem: "latn" });

  return (
    <div className="min-h-screen bg-surface lg:flex">
      {/* Desktop sidebar */}
      <aside className={cx("no-print sticky top-0 hidden h-screen shrink-0 flex-col bg-gradient-to-b from-navy-800 via-navy-900 to-navy-950 transition-[width] duration-200 lg:flex", collapsed ? "w-[76px]" : "w-64")}>
        <div className={cx("flex h-16 items-center border-b border-white/[0.06]", collapsed ? "justify-center px-2" : "px-5")}>
          <Brand brand={p.brand} subtitle={p.subtitle} collapsed={collapsed} homeHref={p.homeHref} appName={p.labels.appName} />
        </div>
        <div className={cx("flex-1 overflow-y-auto py-5", collapsed ? "px-2" : "px-3")}>
          <SidebarNav nav={p.nav} path={path} homeHref={p.homeHref} collapsed={collapsed} />
        </div>
        <div className="border-t border-white/[0.06] p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? p.labels.expand : p.labels.collapse}
            title={collapsed ? p.labels.expand : p.labels.collapse}
            className={cx("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-indigo-200/70 hover:bg-white/[0.05] hover:text-white", collapsed && "justify-center px-0")}
          >
            <Icon name={collapsed ? "chevronRight" : "chevronLeft"} className="h-4 w-4 rtl:rotate-180" />
            {!collapsed && <span>{p.labels.collapse}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div className={cx("no-print fixed inset-0 z-40 lg:hidden", drawer ? "" : "pointer-events-none")} aria-hidden={!drawer}>
        <div className={cx("absolute inset-0 bg-slate-900/50 transition-opacity", drawer ? "opacity-100" : "opacity-0")} onClick={() => setDrawer(false)} />
        <aside
          role="dialog"
          aria-modal="true"
          className={cx(
            "absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-gradient-to-b from-navy-800 via-navy-900 to-navy-950 shadow-2xl transition-transform duration-200",
            drawer ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full",
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-5">
            <Brand brand={p.brand} subtitle={p.subtitle} collapsed={false} homeHref={p.homeHref} appName={p.labels.appName} />
            <button type="button" onClick={() => setDrawer(false)} aria-label={p.labels.closeMenu} className="rounded-lg p-1.5 text-indigo-200 hover:bg-white/10">
              <Icon name="x" className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-5">
            <SidebarNav nav={p.nav} path={path} homeHref={p.homeHref} collapsed={false} onNavigate={() => setDrawer(false)} />
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur lg:px-8">
          <button type="button" onClick={() => setDrawer(true)} aria-label={p.labels.openMenu} className="-ms-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
            <Icon name="menu" className="h-5 w-5" />
          </button>

          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex items-center gap-1.5 text-sm">
              <li className="hidden min-w-0 sm:block">
                <Link href={p.homeHref} className="block max-w-[14rem] truncate text-slate-500 hover:text-slate-800">{p.brand}</Link>
              </li>
              {current && current.href !== p.homeHref && (
                <>
                  <li className="hidden text-slate-300 sm:block"><Icon name="chevronRight" className="h-3.5 w-3.5 rtl:rotate-180" /></li>
                  <li className="truncate font-medium text-slate-900">{current.label}</li>
                </>
              )}
              {(!current || current.href === p.homeHref) && (
                <li className="truncate font-medium text-slate-900 sm:hidden">{current?.label ?? p.brand}</li>
              )}
            </ol>
          </nav>

          {p.searchHref && (
            <form
              role="search"
              className="relative hidden md:block"
              onSubmit={(e) => {
                e.preventDefault();
                const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
                router.push(q ? `${p.searchHref}?q=${encodeURIComponent(q)}` : p.searchHref!);
              }}
            >
              <Icon name="search" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                type="search"
                placeholder={p.labels.search}
                aria-label={p.labels.search}
                className="h-9 w-56 rounded-lg border border-slate-200 bg-slate-50 ps-9 pe-3 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/15 xl:w-72"
              />
            </form>
          )}

          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => setMenu(menu === "notif" ? null : "notif")}
              aria-label={p.labels.notifications}
              aria-expanded={menu === "notif"}
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <Icon name="bell" className="h-5 w-5" />
              {unread > 0 && <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-expense-strong ring-2 ring-white" />}
            </button>
            {menu === "notif" && (
              <div className="absolute end-0 top-11 z-40 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-900">{p.labels.notifications}</span>
                  {unread > 0 && (
                    <form action={markNotificationsRead}>
                      <button className="text-xs font-medium text-brand-600 hover:underline">{p.labels.markAllRead}</button>
                    </form>
                  )}
                </div>
                <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                  {p.notifications.map((n) => {
                    const body = (
                      <div className="flex gap-3 px-4 py-3 hover:bg-slate-50">
                        <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-slate-200" : "bg-brand-500")} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800">{n.title}</div>
                          {n.body && <div className="line-clamp-2 text-xs text-slate-500">{n.body}</div>}
                          <div className="mt-0.5 text-[11px] text-slate-400">{fmt.format(new Date(n.created_at))}</div>
                        </div>
                      </div>
                    );
                    return <li key={n.id}>{n.link ? <Link href={n.link}>{body}</Link> : body}</li>;
                  })}
                  {!p.notifications.length && (
                    <li className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-slate-500">
                      <Icon name="inbox" className="h-6 w-6 text-slate-300" />
                      {p.labels.noNotifications}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div className="hidden sm:block"><LocaleSwitcher locale={p.locale} /></div>

          <div ref={userRef} className="relative">
            <button
              type="button"
              onClick={() => setMenu(menu === "user" ? null : "user")}
              aria-label={p.labels.profile}
              aria-expanded={menu === "user"}
              className="flex items-center gap-2 rounded-lg p-1 pe-2 hover:bg-slate-100"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-semibold uppercase text-brand-700">{p.user.email.slice(0, 2)}</span>
              <Icon name="chevronDown" className="hidden h-4 w-4 text-slate-400 sm:block" />
            </button>
            {menu === "user" && (
              <div className="absolute end-0 top-11 z-40 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="truncate text-sm font-medium text-slate-900" dir="ltr">{p.user.email}</div>
                  <div className="text-xs text-slate-500">{p.user.role}</div>
                </div>
                <div className="p-1.5">
                  <div className="px-2.5 py-2 sm:hidden"><LocaleSwitcher locale={p.locale} /></div>
                  {p.settingsHref && (
                    <Link href={p.settingsHref} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <Icon name="settings" className="h-4 w-4 text-slate-400" />{p.labels.settings}
                    </Link>
                  )}
                  {p.billingHref && (
                    <Link href={p.billingHref} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <Icon name="sparkles" className="h-4 w-4 text-slate-400" />{p.labels.billing}
                    </Link>
                  )}
                  <form action={signOut}>
                    <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-rose-700 hover:bg-rose-50">
                      <Icon name="logout" className="h-4 w-4 rtl:rotate-180" />{p.labels.logout}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </header>
        {p.banner}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{p.children}</main>
      </div>
    </div>
  );
}
