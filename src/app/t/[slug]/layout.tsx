import type { ReactNode } from "react";
import Link from "next/link";
import { getWorkspace } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { Shell, type NavItem } from "@/components/shell";

export default async function WorkspaceLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, role, user, operational } = await getWorkspace(slug);
  const { t } = await getT();
  const b = `/t/${slug}`;
  const m = tenant.modules ?? {};
  const on = (k: string) => m[k] !== false;

  let nav: NavItem[];
  if (role === "admin") {
    nav = [
      { href: b, label: t.nav.dashboard },
      { href: `${b}/students`, label: t.nav.students, section: t.common.student },
      { href: `${b}/structure`, label: t.nav.structure, section: t.common.student },
      { href: `${b}/groups`, label: t.nav.groups, section: t.common.student },
      { href: `${b}/subjects`, label: t.nav.subjects, section: t.common.student },
      { href: `${b}/teachers`, label: t.nav.teachers, section: t.common.teacher },
      ...(on("timetable") ? [{ href: `${b}/timetable`, label: t.nav.timetable, section: t.common.teacher }] : []),
      ...(on("attendance") ? [{ href: `${b}/attendance`, label: t.nav.attendance, section: t.common.teacher }] : []),
      ...(on("grades") ? [{ href: `${b}/grades`, label: t.nav.grades, section: t.common.teacher }] : []),
      ...(on("payments") ? [{ href: `${b}/payments`, label: t.nav.payments, section: "Finance" }] : []),
      ...(on("remuneration") ? [{ href: `${b}/remuneration`, label: t.nav.remuneration, section: "Finance" }] : []),
      ...(on("expenses") ? [{ href: `${b}/expenses`, label: t.nav.expenses, section: "Finance" }] : []),
      { href: `${b}/cash`, label: t.nav.cash, section: "Finance" },
      { href: `${b}/reports`, label: t.nav.reports, section: t.nav.reports },
      { href: `${b}/audit`, label: t.nav.audit, section: t.nav.settings },
      { href: `${b}/settings`, label: t.nav.settings, section: t.nav.settings },
      { href: `${b}/billing`, label: t.nav.billing, section: t.nav.settings },
    ];
  } else {
    nav = [
      { href: b, label: t.nav.dashboard },
      { href: `${b}/timetable`, label: t.nav.timetable },
      { href: `${b}/attendance`, label: t.nav.attendance },
      { href: `${b}/grades`, label: t.nav.grades },
      { href: `${b}/remuneration`, label: t.remuneration.mySummary },
    ];
  }
  if (!operational) nav = role === "admin" ? [{ href: b, label: t.nav.dashboard }, { href: `${b}/billing`, label: t.nav.billing }] : [{ href: b, label: t.nav.dashboard }];

  const s = tenant.tenant_effective_status;
  const daysLeft = tenant.trial_ends_at ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0;
  const banner =
    s === "trial_active" ? (
      <div className="no-print bg-blue-50 px-4 py-2 text-center text-sm text-blue-800">
        {t.status.trial_active} · {t.dashboard.trialEnds} {daysLeft} {t.dashboard.days}
        {role === "admin" && <> · <Link className="font-medium underline" href={`${b}/billing`}>{t.nav.billing}</Link></>}
      </div>
    ) : s === "grace_period" || s === "renewal_pending" ? (
      <div className="no-print bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
        {t.status[s]}
        {role === "admin" && <> · <Link className="font-medium underline" href={`${b}/billing`}>{t.nav.billing}</Link></>}
      </div>
    ) : null;

  return (
    <Shell brand={tenant.name} subtitle={t.types[tenant.type as keyof typeof t.types]} nav={nav} userEmail={user.email ?? ""} banner={banner}>
      {children}
    </Shell>
  );
}
