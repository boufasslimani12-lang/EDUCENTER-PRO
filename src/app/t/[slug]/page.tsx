import Link from "next/link";
import { getWorkspace, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { money, firstOfMonth, today, monthLabel, pct } from "@/lib/format";
import { PageHeader, Stat, Card, Grid, Bars, ButtonLink, Badge, Table, Td } from "@/components/ui";

export default async function Dashboard({ params }: Props) {
  const { slug } = await params;
  const { supabase, tenant, role, operational, teacherId } = await getWorkspace(slug);
  const { t, locale } = await getT();
  const b = `/t/${slug}`;

  if (!operational) {
    return (
      <Card title={t.dashboard.suspendedTitle}>
        <p className="text-sm text-slate-600">{t.dashboard.suspendedBody}</p>
        {role === "admin" && <div className="mt-4"><ButtonLink href={`${b}/billing`}>{t.nav.billing}</ButtonLink></div>}
      </Card>
    );
  }

  const weekday = ((new Date().getDay() + 6) % 7) + 1;
  let ttQuery = supabase
    .from("timetable_entries")
    .select("id, starts_at, ends_at, classes(name), groups(name), subjects(name), teachers(full_name)")
    .eq("tenant_id", tenant.id).eq("weekday", weekday).order("starts_at");
  if (role === "teacher" && teacherId) ttQuery = ttQuery.eq("teacher_id", teacherId);
  const { data: todays } = await ttQuery;

  const scheduleCard = (
    <Card title={t.dashboard.todaySchedule}>
      <Table head={[t.timetable.start, t.common.class + " / " + t.common.group, t.common.subject, t.common.teacher]} empty={!todays?.length && t.common.empty}>
        {(todays ?? []).map((e: any) => (
          <tr key={e.id}>
            <Td className="tabular-nums">{e.starts_at.slice(0, 5)}–{e.ends_at.slice(0, 5)}</Td>
            <Td>{e.classes?.name ?? e.groups?.name}</Td>
            <Td>{e.subjects?.name}</Td>
            <Td>{e.teachers?.full_name}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );

  if (role === "teacher") {
    const { data: rem } = await supabase.rpc("my_remuneration", { p_tenant: tenant.id });
    const last = (rem ?? [])[0] as any;
    return (
      <>
        <PageHeader title={t.nav.dashboard} subtitle={tenant.name} />
        <Grid cols={3}>
          <Stat label={t.remuneration.calculated} value={money(last?.calculated_amount, locale)} hint={last ? monthLabel(last.period, locale) : undefined} />
          <Stat label={t.remuneration.paid} value={money(last?.paid_amount, locale)} />
          <Stat label={t.remuneration.outstanding} value={money(last?.outstanding, locale)} tone={Number(last?.outstanding) > 0 ? "warn" : "default"} />
        </Grid>
        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href={`${b}/attendance`}>{t.attendance.take}</ButtonLink>
          <ButtonLink variant="secondary" href={`${b}/grades`}>{t.grades.enter}</ButtonLink>
        </div>
        <div className="mt-6">{scheduleCard}</div>
      </>
    );
  }

  const month = firstOfMonth();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const start6 = firstOfMonth(sixMonthsAgo);

  const [students, teachers, balances, payments, expenses, att, cash] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).is("archived_at", null),
    supabase.from("teachers").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("is_active", true),
    supabase.from("installment_balances").select("balance, payment_status").eq("tenant_id", tenant.id).gt("balance", 0),
    supabase.from("payments").select("amount, paid_on").eq("tenant_id", tenant.id).is("voided_at", null).gte("paid_on", start6),
    supabase.from("expenses").select("amount").eq("tenant_id", tenant.id).is("voided_at", null).gte("spent_on", month),
    supabase.from("attendance_records").select("status").eq("tenant_id", tenant.id).gte("session_date", since30),
    supabase.from("cash_movements").select("direction, amount").eq("tenant_id", tenant.id),
  ]);

  const outstanding = (balances.data ?? []).reduce((s, r: any) => s + Number(r.balance), 0);
  const overdue = (balances.data ?? []).filter((r: any) => String(r.payment_status).startsWith("overdue")).length;
  const pays = payments.data ?? [];
  const collectedMonth = pays.filter((p: any) => p.paid_on >= month).reduce((s, p: any) => s + Number(p.amount), 0);
  const expMonth = (expenses.data ?? []).reduce((s, e: any) => s + Number(e.amount), 0);
  const attRows = att.data ?? [];
  const attRate = attRows.length ? (attRows.filter((a: any) => a.status !== "absent").length / attRows.length) * 100 : null;
  const cashBal = (cash.data ?? []).reduce((s, c: any) => s + (c.direction === "in" ? 1 : -1) * Number(c.amount), 0);

  const trend: { label: string; value: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo); d.setMonth(sixMonthsAgo.getMonth() + i);
    const key = firstOfMonth(d).slice(0, 7);
    trend.push({ label: monthLabel(key + "-01", locale).split(" ")[0].slice(0, 4), value: pays.filter((p: any) => p.paid_on.startsWith(key)).reduce((s, p: any) => s + Number(p.amount), 0) });
  }

  return (
    <>
      <PageHeader title={t.nav.dashboard} subtitle={<>{tenant.name} · <Badge tone="blue">{t.status[tenant.tenant_effective_status]}</Badge></>} />
      <Grid cols={4}>
        <Stat label={t.dashboard.activeStudents} value={students.count ?? 0} />
        <Stat label={t.dashboard.teachers} value={teachers.count ?? 0} />
        <Stat label={t.dashboard.collectedMonth} value={money(collectedMonth, locale)} tone="good" />
        <Stat label={t.dashboard.outstanding} value={money(outstanding, locale)} tone={outstanding > 0 ? "warn" : "default"} />
        <Stat label={t.dashboard.overdue} value={overdue} tone={overdue > 0 ? "bad" : "default"} />
        <Stat label={t.dashboard.expensesMonth} value={money(expMonth, locale)} />
        <Stat label={t.dashboard.attendanceRate} value={attRate === null ? "—" : pct(attRate)} />
        <Stat label={t.dashboard.cashBalance} value={money(cashBal, locale)} />
      </Grid>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={t.dashboard.revenueTrend}><Bars data={trend} format={(n) => money(n, locale).replace(/\s?MAD|د\.م\.‏?/, "").trim()} /></Card>
        <Card title={t.dashboard.quickActions}>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`${b}/students/new`}>{t.students.new}</ButtonLink>
            <ButtonLink variant="secondary" href={`${b}/payments`}>{t.payments.recordPayment}</ButtonLink>
            <ButtonLink variant="secondary" href={`${b}/attendance`}>{t.attendance.take}</ButtonLink>
            <ButtonLink variant="secondary" href={`${b}/expenses`}>{t.expenses.new}</ButtonLink>
            <ButtonLink variant="secondary" href={`${b}/reports`}>{t.nav.reports}</ButtonLink>
          </div>
          <p className="mt-4 text-xs text-slate-500">{today()} · <Link className="underline" href={`${b}/payments?period=${month}`}>{monthLabel(month, locale)}</Link></p>
        </Card>
      </div>
      <div className="mt-6">{scheduleCard}</div>
    </>
  );
}
