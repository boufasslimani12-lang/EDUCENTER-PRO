import type { ReactNode } from "react";
import Link from "next/link";
import { getWorkspace } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { Shell, type NavItem } from "@/components/shell";
import { Icon } from "@/components/icons";

export default async function WorkspaceLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, role, operational } = await getWorkspace(slug);
  const { t } = await getT();
  const b = `/t/${slug}`;
  const m = tenant.modules ?? {};
  const on = (k: string) => m[k] !== false;
  const isAdmin = role === "admin";

  let nav: NavItem[];
  if (isAdmin) {
    const A = t.nav.sectionAcademic, P = t.nav.sectionTeaching, F = t.nav.sectionFinance, S = t.nav.sectionAdmin;
    nav = [
      { href: b, label: t.nav.dashboard, icon: "dashboard" },
      { href: `${b}/students`, label: t.nav.students, icon: "students", section: A },
      { href: `${b}/structure`, label: t.nav.structure, icon: "layers", section: A },
      { href: `${b}/groups`, label: t.nav.groups, icon: "groups", section: A },
      { href: `${b}/subjects`, label: t.nav.subjects, icon: "book", section: A },
      { href: `${b}/teachers`, label: t.nav.teachers, icon: "teacher", section: P },
      ...(on("timetable") ? [{ href: `${b}/timetable`, label: t.nav.timetable, icon: "calendar" as const, section: P }] : []),
      ...(on("attendance") ? [{ href: `${b}/attendance`, label: t.nav.attendance, icon: "attendance" as const, section: P }] : []),
      ...(on("grades") ? [{ href: `${b}/grades`, label: t.nav.grades, icon: "award" as const, section: P }] : []),
      ...(on("payments") ? [{ href: `${b}/payments`, label: t.nav.payments, icon: "card" as const, section: F }] : []),
      ...(on("remuneration") ? [{ href: `${b}/remuneration`, label: t.nav.remuneration, icon: "wallet" as const, section: F }] : []),
      ...(on("expenses") ? [{ href: `${b}/expenses`, label: t.nav.expenses, icon: "receipt" as const, section: F }] : []),
      { href: `${b}/cash`, label: t.nav.cash, icon: "cash", section: F },
      { href: `${b}/reports`, label: t.nav.reports, icon: "chart", section: S },
      { href: `${b}/settings`, label: t.nav.settings, icon: "settings", section: S },
      { href: `${b}/billing`, label: t.nav.billing, icon: "sparkles", section: S },
      { href: `${b}/audit`, label: t.nav.audit, icon: "shield", section: S },
    ];
  } else {
    nav = [
      { href: b, label: t.nav.dashboard, icon: "dashboard" },
      { href: `${b}/timetable`, label: t.nav.timetable, icon: "calendar" },
      { href: `${b}/attendance`, label: t.nav.attendance, icon: "attendance" },
      { href: `${b}/grades`, label: t.nav.grades, icon: "award" },
      { href: `${b}/remuneration`, label: t.remuneration.mySummary, icon: "wallet" },
    ];
  }
  if (!operational) {
    nav = isAdmin
      ? [{ href: b, label: t.nav.dashboard, icon: "dashboard" }, { href: `${b}/billing`, label: t.nav.billing, icon: "sparkles" }]
      : [{ href: b, label: t.nav.dashboard, icon: "dashboard" }];
  }

  const s = tenant.tenant_effective_status;
  const daysLeft = tenant.trial_ends_at ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0;
  const bannerTone = s === "trial_active" ? "bg-brand-50 text-brand-800 border-brand-100" : "bg-amber-50 text-amber-900 border-amber-100";
  const banner =
    s === "trial_active" || s === "grace_period" || s === "renewal_pending" ? (
      <div className={`no-print flex items-center justify-center gap-2 border-b px-4 py-2 text-center text-[13px] ${bannerTone}`}>
        <Icon name={s === "trial_active" ? "clock" : "alert"} className="h-4 w-4 shrink-0" />
        <span>
          {s === "trial_active" ? <>{t.status.trial_active} · {t.dashboard.trialEnds} <b>{daysLeft}</b> {t.dashboard.days}</> : t.status[s]}
          {isAdmin && <> · <Link className="font-medium underline underline-offset-2" href={`${b}/billing`}>{t.nav.billing}</Link></>}
        </span>
      </div>
    ) : null;

  return (
    <Shell
      brand={tenant.name}
      subtitle={t.types[tenant.type as keyof typeof t.types]}
      homeHref={b}
      nav={nav}
      role={isAdmin ? t.nav.roleAdmin : t.nav.roleTeacher}
      banner={banner}
      tenantId={tenant.id}
      searchHref={isAdmin && operational ? `${b}/students` : undefined}
      settingsHref={isAdmin && operational ? `${b}/settings` : undefined}
      billingHref={isAdmin ? `${b}/billing` : undefined}
    >
      {children}
    </Shell>
  );
}
