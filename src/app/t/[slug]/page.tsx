import { getWorkspace, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { money, firstOfMonth, monthLabel } from "@/lib/format";
import { Card, KpiCard, ButtonLink, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { AdminDashboard, type DashboardData } from "@/components/dashboard";

function must<T>(r: { data: T | null; error: { message: string } | null; count?: number | null }) {
  if (r.error) throw new Error(r.error.message);
  return r;
}

const studentName = (s: { first_name?: string; last_name?: string } | null | undefined) => (s ? `${s.last_name ?? ""} ${s.first_name ?? ""}`.trim() : "—");

export default async function Dashboard({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant, role, operational, teacherId } = await getWorkspace(slug);
  const { t, locale } = await getT();
  const b = `/t/${slug}`;

  if (!operational) {
    return (
      <Card>
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Icon name="alert" /></span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{t.dashboard.suspendedTitle}</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-600">{t.dashboard.suspendedBody}</p>
            {role === "admin" && <div className="mt-4"><ButtonLink href={`${b}/billing`} icon="sparkles">{t.nav.billing}</ButtonLink></div>}
          </div>
        </div>
      </Card>
    );
  }

  const weekday = ((new Date().getDay() + 6) % 7) + 1;
  let ttQuery = supabase
    .from("timetable_entries")
    .select("id, starts_at, ends_at, classes(name), groups(name), subjects(name), teachers(full_name)")
    .eq("tenant_id", tenant.id).eq("weekday", weekday).order("starts_at");
  if (role === "teacher") ttQuery = ttQuery.eq("teacher_id", teacherId ?? "00000000-0000-0000-0000-000000000000");
  const todays = (must(await ttQuery).data ?? []) as any[];
  const today = todays.map((e) => ({
    id: e.id, time: `${e.starts_at.slice(0, 5)}–${e.ends_at.slice(0, 5)}`,
    scope: e.classes?.name ?? e.groups?.name ?? "—", subject: e.subjects?.name ?? "—", teacher: e.teachers?.full_name ?? "—",
  }));

  if (role === "teacher") {
    const rem = must(await supabase.rpc("my_remuneration", { p_tenant: tenant.id })).data as any[] | null;
    const last = (rem ?? [])[0];
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 sm:text-2xl">{t.nav.dashboard}</h1>
          <p className="mt-1 text-sm text-slate-500">{tenant.name}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label={t.remuneration.calculated} value={money(last?.calculated_amount, locale, tenant.currency)} hint={last ? monthLabel(last.period, locale) : undefined} icon="wallet" tone="brand" href={`${b}/remuneration`} />
          <KpiCard label={t.remuneration.paid} value={money(last?.paid_amount, locale, tenant.currency)} icon="check" tone="income" />
          <KpiCard label={t.remuneration.outstanding} value={money(last?.outstanding, locale, tenant.currency)} icon="clock" tone={Number(last?.outstanding) > 0 ? "warn" : "neutral"} />
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`${b}/attendance`} icon="attendance">{t.attendance.take}</ButtonLink>
          <ButtonLink variant="secondary" href={`${b}/grades`} icon="award">{t.grades.enter}</ButtonLink>
        </div>
        <Card title={t.dashboard.todaySchedule} bodyClassName="p-0">
          {today.length ? (
            <ul className="divide-y divide-slate-100">
              {today.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="shrink-0 whitespace-nowrap rounded-lg bg-brand-50 px-2.5 py-1 text-center text-xs font-semibold tabular-nums text-brand-700" dir="ltr">{e.time}</span>
                  <div className="min-w-0"><div className="truncate text-sm font-medium text-slate-800">{e.subject}</div><div className="truncate text-xs text-slate-500">{e.scope}</div></div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5"><EmptyState icon="calendar" title={t.common.empty} /></div>
          )}
        </Card>
      </div>
    );
  }

  // ── Administration dashboard: every figure below comes from the tenant's own rows (RLS-scoped). ──
  const range = (["3", "12"].includes(sp.range ?? "") ? Number(sp.range) : 6) as 3 | 6 | 12;
  const now = new Date();
  const month = firstOfMonth(now);
  const startDate = new Date(now.getFullYear(), now.getMonth() - (range - 1), 1);
  const start = firstOfMonth(startDate);
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [students, teachers, payments, expenses, balances, recent, att, cash] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).is("archived_at", null),
    supabase.from("teachers").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("is_active", true),
    supabase.from("payments").select("amount, paid_on").eq("tenant_id", tenant.id).is("voided_at", null).gte("paid_on", start),
    supabase.from("expenses").select("amount, spent_on").eq("tenant_id", tenant.id).is("voided_at", null).gte("spent_on", start),
    supabase.from("installment_balances").select("id, student_id, period, due_on, balance, payment_status, students(first_name, last_name)").eq("tenant_id", tenant.id).gt("balance", 0).order("due_on"),
    supabase.from("payments").select("id, student_id, receipt_no, paid_on, method, amount, voided_at, students(first_name, last_name)").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("attendance_records").select("status").eq("tenant_id", tenant.id).gte("session_date", since30),
    supabase.from("cash_movements").select("direction, amount").eq("tenant_id", tenant.id),
  ]);
  for (const r of [students, teachers, payments, expenses, balances, recent, att, cash]) if (r.error) throw new Error(r.error.message);

  const pays = (payments.data ?? []) as { amount: number; paid_on: string }[];
  const exps = (expenses.data ?? []) as { amount: number; spent_on: string }[];
  const bal = (balances.data ?? []) as any[];
  const attRows = (att.data ?? []) as { status: string }[];

  const months = Array.from({ length: range }, (_, i) => {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const key = firstOfMonth(d).slice(0, 7);
    const label = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { month: "short", numberingSystem: "latn" }).format(d);
    return {
      key, label,
      revenue: pays.filter((p) => p.paid_on.startsWith(key)).reduce((s, p) => s + Number(p.amount), 0),
      expenses: exps.filter((e) => e.spent_on.startsWith(key)).reduce((s, e) => s + Number(e.amount), 0),
    };
  });

  const data: DashboardData = {
    range,
    activeStudents: students.count ?? 0,
    teachers: teachers.count ?? 0,
    collectedMonth: pays.filter((p) => p.paid_on >= month).reduce((s, p) => s + Number(p.amount), 0),
    expensesMonth: exps.filter((e) => e.spent_on >= month).reduce((s, e) => s + Number(e.amount), 0),
    outstanding: bal.reduce((s, r) => s + Number(r.balance), 0),
    overdueCount: bal.filter((r) => String(r.payment_status).startsWith("overdue")).length,
    cashBalance: ((cash.data ?? []) as any[]).reduce((s, c) => s + (c.direction === "in" ? 1 : -1) * Number(c.amount), 0),
    months,
    recentPayments: ((recent.data ?? []) as any[]).map((p) => ({
      id: p.id, student_id: p.student_id, student: studentName(p.students), receipt_no: p.receipt_no, paid_on: p.paid_on,
      method: p.method, amount: Number(p.amount), voided: !!p.voided_at,
    })),
    upcoming: bal.slice(0, 6).map((r) => ({
      id: r.id, student_id: r.student_id, student: studentName(r.students), period: r.period, due_on: r.due_on, balance: Number(r.balance), status: r.payment_status,
    })),
    attendance: {
      present: attRows.filter((a) => a.status === "present").length,
      late: attRows.filter((a) => a.status === "late").length,
      absent: attRows.filter((a) => a.status === "absent").length,
    },
    today,
  };

  return <AdminDashboard t={t} locale={locale} currency={tenant.currency} slug={slug} tenantName={tenant.name} data={data} />;
}
