import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { money, date, monthLabel, pct } from "@/lib/format";
import { Card, KpiCard, EmptyState, Badge, statusTone, ButtonLink, cx } from "./ui";
import { Icon, type IconName } from "./icons";
import { FinanceChart, type MonthPoint } from "./finance-chart";

export type DashboardData = {
  range: 3 | 6 | 12;
  activeStudents: number;
  teachers: number;
  collectedMonth: number;
  expensesMonth: number;
  outstanding: number;
  overdueCount: number;
  cashBalance: number;
  months: MonthPoint[];
  recentPayments: { id: string; student_id: string; student: string; receipt_no: string | null; paid_on: string; method: string; amount: number; voided: boolean }[];
  upcoming: { id: string; student_id: string; student: string; period: string; due_on: string; balance: number; status: string }[];
  attendance: { present: number; late: number; absent: number };
  today: { id: string; time: string; scope: string; subject: string; teacher: string }[];
};

export function AdminDashboard({ t, locale, currency, slug, tenantName, data }: {
  t: Dictionary; locale: Locale; currency: string; slug: string; tenantName: string; data: DashboardData;
}) {
  const b = `/t/${slug}`;
  const m = (n: number) => money(n, locale, currency);
  const periodRevenue = data.months.reduce((s, x) => s + x.revenue, 0);
  const periodExpenses = data.months.reduce((s, x) => s + x.expenses, 0);
  const net = periodRevenue - periodExpenses;
  const att = data.attendance;
  const attTotal = att.present + att.late + att.absent;
  const attRate = attTotal ? ((att.present + att.late) / attTotal) * 100 : null;

  const ranges: { v: 3 | 6 | 12; label: string }[] = [
    { v: 3, label: t.dashboard.months3 }, { v: 6, label: t.dashboard.months6 }, { v: 12, label: t.dashboard.months12 },
  ];
  const quick: { href: string; label: string; icon: IconName; tone: string }[] = [
    { href: `${b}/students/new`, label: t.students.new, icon: "students", tone: "bg-brand-50 text-brand-600" },
    { href: `${b}/payments`, label: t.payments.recordPayment, icon: "card", tone: "bg-income-soft text-income" },
    { href: `${b}/attendance`, label: t.attendance.take, icon: "attendance", tone: "bg-accent-soft text-accent" },
    { href: `${b}/expenses`, label: t.expenses.new, icon: "receipt", tone: "bg-expense-soft text-expense-strong" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 sm:text-2xl">{t.nav.dashboard}</h1>
          <p className="mt-1 text-sm text-slate-500">{t.dashboard.welcome} · <span className="text-slate-700">{tenantName}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`${b}/students/new`} icon="plus">{t.students.new}</ButtonLink>
          <ButtonLink href={`${b}/payments`} variant="secondary" icon="card">{t.payments.recordPayment}</ButtonLink>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label={t.dashboard.activeStudents} value={data.activeStudents} hint={t.dashboard.activeStudentsHint} icon="students" tone="brand" href={`${b}/students`} />
        <KpiCard label={t.dashboard.teachers} value={data.teachers} hint={t.dashboard.teachersHint} icon="teacher" tone="accent" href={`${b}/teachers`} />
        <KpiCard label={t.dashboard.collectedMonth} value={m(data.collectedMonth)} hint={t.dashboard.collectedHint} icon="trendUp" tone="income" href={`${b}/payments`} />
        <KpiCard
          label={t.dashboard.outstanding} value={m(data.outstanding)} icon="clock" tone={data.overdueCount ? "warn" : "neutral"} href={`${b}/payments?open=1`}
          hint={data.overdueCount ? <span className="font-medium text-rose-700">{data.overdueCount} {t.dashboard.outstandingHint}</span> : `0 ${t.dashboard.outstandingHint}`}
        />
        <KpiCard label={t.dashboard.expensesMonth} value={m(data.expensesMonth)} hint={t.dashboard.expensesHint} icon="trendDown" tone="expense" href={`${b}/expenses`} />
        <KpiCard label={t.dashboard.cashBalance} value={m(data.cashBalance)} hint={t.dashboard.cashHint} icon="wallet" tone="neutral" href={`${b}/cash`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={t.dashboard.revenueVsExpenses}
          actions={
            <div role="group" aria-label={t.dashboard.period} className="inline-flex rounded-lg bg-slate-100 p-0.5">
              {ranges.map((r) => (
                <Link
                  key={r.v}
                  href={`${b}?range=${r.v}`}
                  scroll={false}
                  aria-current={data.range === r.v ? "true" : undefined}
                  className={cx("rounded-md px-3 py-1 text-xs font-medium transition", data.range === r.v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
                >
                  {r.label}
                </Link>
              ))}
            </div>
          }
        >
          <FinanceChart
            data={data.months}
            locale={locale}
            currency={currency}
            labels={{ revenue: t.dashboard.revenue, expenses: t.dashboard.expenses, net: t.dashboard.net, showTable: t.dashboard.showTable, month: t.common.period, empty: t.dashboard.noChartData }}
          />
        </Card>

        <Card title={t.dashboard.financialSummary} description={`${ranges.find((r) => r.v === data.range)?.label} · ${t.dashboard.lastNMonths}`}>
          <dl className="space-y-4">
            <SummaryRow icon="trendUp" tone="bg-income-soft text-income" label={t.dashboard.revenue} value={m(periodRevenue)} />
            <SummaryRow icon="trendDown" tone="bg-expense-soft text-expense-strong" label={t.dashboard.expenses} value={m(periodExpenses)} />
            <div className="border-t border-slate-100 pt-4">
              <SummaryRow icon="wallet" tone="bg-brand-50 text-brand-600" label={t.dashboard.net} value={<span className={net < 0 ? "text-rose-700" : "text-slate-900"}>{m(net)}</span>} />
            </div>
          </dl>
          {periodRevenue + periodExpenses > 0 && (
            <div className="mt-5">
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <div className="h-full bg-income" style={{ width: `${(periodRevenue / (periodRevenue + periodExpenses)) * 100}%` }} />
                <div className="h-full border-s-2 border-white bg-expense" style={{ width: `${(periodExpenses / (periodRevenue + periodExpenses)) * 100}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
                <span>{t.dashboard.revenue} {pct((periodRevenue / (periodRevenue + periodExpenses)) * 100)}</span>
                <span>{t.dashboard.expenses} {pct((periodExpenses / (periodRevenue + periodExpenses)) * 100)}</span>
              </div>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink small variant="soft" href={`${b}/reports`} icon="chart">{t.nav.reports}</ButtonLink>
            <ButtonLink small variant="secondary" href={`${b}/cash`} icon="cash">{t.nav.cash}</ButtonLink>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3" title={t.dashboard.recentPayments} actions={<SeeAll href={`${b}/payments`} label={t.dashboard.viewAll} />} bodyClassName="p-0">
          {data.recentPayments.length ? (
            <ul className="divide-y divide-slate-100">
              {data.recentPayments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", p.voided ? "bg-slate-100 text-slate-400" : "bg-income-soft text-income")}><Icon name="card" className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <Link href={`${b}/students/${p.student_id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700">{p.student}</Link>
                    <div className="truncate text-xs text-slate-500">{p.receipt_no} · {date(p.paid_on, locale)} · {p.method}</div>
                  </div>
                  <div className="text-end">
                    <div className={cx("text-sm font-semibold tabular-nums", p.voided ? "text-slate-400 line-through" : "text-income")}>{m(p.amount)}</div>
                    {p.voided && <Badge tone="red">{t.status.voided}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5"><EmptyState icon="card" title={t.dashboard.noPayments} action={<ButtonLink small href={`${b}/payments`}>{t.payments.recordPayment}</ButtonLink>} /></div>
          )}
        </Card>

        <Card className="xl:col-span-2" title={t.dashboard.upcoming} actions={<SeeAll href={`${b}/payments?open=1`} label={t.dashboard.viewAll} />} bodyClassName="p-0">
          {data.upcoming.length ? (
            <ul className="divide-y divide-slate-100">
              {data.upcoming.map((u) => (
                <li key={u.id}>
                  <Link href={`${b}/payments?student=${u.student_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{u.student}</div>
                      <div className="truncate text-xs text-slate-500">{monthLabel(u.period, locale)} · {t.dashboard.dueOn} {date(u.due_on, locale)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">{m(u.balance)}</span>
                      <Badge tone={statusTone(u.status)}>{t.status[u.status as keyof typeof t.status] ?? u.status}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5"><EmptyState icon="check" title={t.dashboard.noUpcoming} /></div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card title={t.dashboard.attendanceOverview} actions={<SeeAll href={`${b}/attendance`} label={t.dashboard.viewAll} />}>
          {attTotal ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{attRate === null ? "—" : pct(attRate)}</span>
                <span className="text-sm text-slate-500">{t.attendance.rate} · {attTotal} {t.dashboard.records}</span>
              </div>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <div className="h-full bg-income" style={{ width: `${(att.present / attTotal) * 100}%` }} />
                <div className="h-full border-s-2 border-white bg-amber-400" style={{ width: `${(att.late / attTotal) * 100}%` }} />
                <div className="h-full border-s-2 border-white bg-rose-500" style={{ width: `${(att.absent / attTotal) * 100}%` }} />
              </div>
              <ul className="mt-4 grid grid-cols-3 gap-2 text-center">
                {([["present", att.present, "bg-income"], ["late", att.late, "bg-amber-400"], ["absent", att.absent, "bg-rose-500"]] as const).map(([k, v, c]) => (
                  <li key={k} className="rounded-xl bg-slate-50 px-2 py-2.5">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500"><span className={cx("h-2 w-2 rounded-full", c)} />{t.status[k]}</div>
                    <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{v}</div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState icon="attendance" title={t.dashboard.noAttendance} action={<ButtonLink small href={`${b}/attendance`}>{t.attendance.take}</ButtonLink>} />
          )}
        </Card>

        <Card title={t.dashboard.todaySchedule} actions={<SeeAll href={`${b}/timetable`} label={t.dashboard.viewAll} />} bodyClassName="p-0">
          {data.today.length ? (
            <ul className="divide-y divide-slate-100">
              {data.today.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="shrink-0 whitespace-nowrap rounded-lg bg-brand-50 px-2.5 py-1 text-center text-xs font-semibold tabular-nums text-brand-700" dir="ltr">{e.time}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">{e.subject}</div>
                    <div className="truncate text-xs text-slate-500">{e.scope} · {e.teacher}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5"><EmptyState icon="calendar" title={t.common.empty} /></div>
          )}
        </Card>

        <Card title={t.dashboard.quickActions} className="lg:col-span-2 xl:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            {quick.map((q) => (
              <Link key={q.href} href={q.href} className="group flex flex-col gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-brand-200 hover:bg-brand-50/40">
                <span className={cx("grid h-9 w-9 place-items-center rounded-lg", q.tone)}><Icon name={q.icon} className="h-[18px] w-[18px]" /></span>
                <span className="text-sm font-medium leading-snug text-slate-800 group-hover:text-brand-700">{q.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({ icon, tone, label, value }: { icon: IconName; tone: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tone)}><Icon name={icon} className="h-4 w-4" /></span>
      <dt className="flex-1 text-sm text-slate-600">{label}</dt>
      <dd className="text-base font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800">
      {label}<Icon name="chevronRight" className="h-3.5 w-3.5 rtl:rotate-180" />
    </Link>
  );
}
