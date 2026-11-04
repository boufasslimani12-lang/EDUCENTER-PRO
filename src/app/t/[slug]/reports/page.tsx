import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { money, pct, today, firstOfMonth } from "@/lib/format";
import { PageHeader, Card, Input, Table, Td, ButtonLink, Stat, Grid } from "@/components/ui";

export default async function ReportsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const lk = await lookups(supabase, tenant.id);
  const yStart = new Date(); yStart.setMonth(0, 1);
  const from = sp.from ?? firstOfMonth(yStart);
  const to = sp.to ?? today();

  const [enr, att, pays, exps, bal, stmts, assess] = await Promise.all([
    supabase.from("enrollments").select("class_id, student_groups(group_id)").eq("tenant_id", tenant.id).eq("status", "active").eq("academic_year_id", lk.activeYear?.id ?? ""),
    supabase.from("attendance_records").select("class_id, group_id, status").eq("tenant_id", tenant.id).gte("session_date", from).lte("session_date", to),
    supabase.from("payments").select("amount, method").eq("tenant_id", tenant.id).is("voided_at", null).gte("paid_on", from).lte("paid_on", to),
    supabase.from("expenses").select("amount, expense_categories(name)").eq("tenant_id", tenant.id).is("voided_at", null).gte("spent_on", from).lte("spent_on", to),
    supabase.from("installment_balances").select("balance, payment_status, enrollments(class_id)").eq("tenant_id", tenant.id).gt("balance", 0),
    supabase.from("remuneration_statements").select("calculated_amount, teachers(full_name), remuneration_payments(amount)").eq("tenant_id", tenant.id).gte("period", from.slice(0, 7) + "-01").lte("period", to),
    supabase.from("assessments").select("title, max_score, subjects(name), classes(name), groups(name), grades(score)").eq("tenant_id", tenant.id).gte("held_on", from).lte("held_on", to).order("held_on", { ascending: false }).limit(30),
  ]);

  const enrolled = (enr.data ?? []) as any[];
  const attRows = (att.data ?? []) as any[];
  const collected = (pays.data ?? []).reduce((s, p: any) => s + Number(p.amount), 0);
  const spent = (exps.data ?? []).reduce((s, p: any) => s + Number(p.amount), 0);
  const outstanding = (bal.data ?? []).reduce((s, p: any) => s + Number(p.balance), 0);
  const byMethod = new Map<string, number>();
  (pays.data ?? []).forEach((p: any) => byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount)));
  const byCat = new Map<string, number>();
  (exps.data ?? []).forEach((e: any) => byCat.set(e.expense_categories?.name ?? "?", (byCat.get(e.expense_categories?.name ?? "?") ?? 0) + Number(e.amount)));

  const scopes = [
    ...lk.activeClasses.map((c) => ({ id: c.id, name: c.name, kind: "c" as const })),
    ...lk.activeGroups.map((g) => ({ id: g.id, name: g.name, kind: "g" as const })),
  ];
  const qs = `from=${from}&to=${to}`;

  return (
    <>
      <PageHeader title={t.reports.title} />
      <form className="mb-6 flex flex-wrap items-end gap-2">
        <label className="text-sm">{t.common.from}<Input type="date" name="from" defaultValue={from} /></label>
        <label className="text-sm">{t.common.to}<Input type="date" name="to" defaultValue={to} /></label>
        <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">{t.common.filter}</button>
      </form>

      <Grid cols={4}>
        <Stat label={t.dashboard.collectedMonth.split(" ")[0]} value={money(collected, locale)} tone="good" />
        <Stat label={t.expenses.title} value={money(spent, locale)} tone="bad" />
        <Stat label={t.common.total} value={money(collected - spent, locale)} />
        <Stat label={t.reports.outstanding} value={money(outstanding, locale)} tone="warn" />
      </Grid>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title={t.reports.enrollment} actions={<ButtonLink small variant="secondary" href={`/t/${slug}/export/students`}>{t.common.export}</ButtonLink>}>
          <Table head={[t.common.class + " / " + t.common.group, t.structure.studentsCount, t.reports.outstanding]}>
            {scopes.map((s) => {
              const n = s.kind === "c" ? enrolled.filter((e) => e.class_id === s.id).length : enrolled.filter((e) => (e.student_groups ?? []).some((g: any) => g.group_id === s.id)).length;
              const o = s.kind === "c" ? (bal.data ?? []).filter((b: any) => b.enrollments?.class_id === s.id).reduce((a, b: any) => a + Number(b.balance), 0) : null;
              return <tr key={s.kind + s.id}><Td>{s.name}</Td><Td className="tabular-nums">{n}</Td><Td className="tabular-nums">{o === null ? "—" : money(o, locale)}</Td></tr>;
            })}
            <tr className="font-semibold"><Td>{t.common.total}</Td><Td>{enrolled.length}</Td><Td /></tr>
          </Table>
        </Card>

        <Card title={t.reports.attendance} actions={<ButtonLink small variant="secondary" href={`/t/${slug}/export/attendance?${qs}`}>{t.common.export}</ButtonLink>}>
          <Table head={[t.common.class + " / " + t.common.group, t.status.absent, t.status.late, t.attendance.rate]}>
            {scopes.map((s) => {
              const r = attRows.filter((a) => (s.kind === "c" ? a.class_id : a.group_id) === s.id);
              if (!r.length) return null;
              const abs = r.filter((a) => a.status === "absent").length;
              return <tr key={s.kind + s.id}><Td>{s.name}</Td><Td>{abs}</Td><Td>{r.filter((a) => a.status === "late").length}</Td><Td>{pct(((r.length - abs) / r.length) * 100)}</Td></tr>;
            })}
          </Table>
        </Card>

        <Card title={t.reports.finance} actions={<div className="flex gap-1"><ButtonLink small variant="secondary" href={`/t/${slug}/export/payments?${qs}`}>{t.nav.payments}</ButtonLink><ButtonLink small variant="secondary" href={`/t/${slug}/export/expenses?${qs}`}>{t.nav.expenses}</ButtonLink><ButtonLink small variant="secondary" href={`/t/${slug}/export/cash?${qs}`}>{t.nav.cash}</ButtonLink></div>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Table head={[t.common.method, t.common.amount]}>
              {Array.from(byMethod).map(([k, v]) => <tr key={k}><Td>{k}</Td><Td className="tabular-nums">{money(v, locale)}</Td></tr>)}
            </Table>
            <Table head={[t.expenses.category, t.common.amount]}>
              {Array.from(byCat).map(([k, v]) => <tr key={k}><Td>{k}</Td><Td className="tabular-nums">{money(v, locale)}</Td></tr>)}
            </Table>
          </div>
        </Card>

        <Card title={t.reports.teacherPay}>
          <Table head={[t.common.teacher, t.remuneration.calculated, t.remuneration.paid]}>
            {Object.entries(((stmts.data ?? []) as any[]).reduce((m: Record<string, { c: number; p: number }>, s) => {
              const k = s.teachers?.full_name ?? "?";
              m[k] ??= { c: 0, p: 0 };
              m[k].c += Number(s.calculated_amount);
              m[k].p += (s.remuneration_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
              return m;
            }, {})).map(([k, v]) => <tr key={k}><Td>{k}</Td><Td className="tabular-nums">{money(v.c, locale)}</Td><Td className="tabular-nums">{money(v.p, locale)}</Td></tr>)}
          </Table>
        </Card>

        <Card title={t.reports.grades} className="xl:col-span-2">
          <Table head={[t.grades.assessment, t.common.subject, t.common.class + " / " + t.common.group, t.grades.average]}>
            {((assess.data ?? []) as any[]).map((a, i) => {
              const s = (a.grades ?? []).map((g: any) => g.score).filter((x: any) => x !== null).map(Number);
              return <tr key={i}><Td>{a.title}</Td><Td>{a.subjects?.name}</Td><Td>{a.classes?.name ?? a.groups?.name}</Td><Td className="tabular-nums">{s.length ? (s.reduce((x: number, y: number) => x + y, 0) / s.length).toFixed(2) : "—"}/{a.max_score}</Td></tr>;
            })}
          </Table>
        </Card>
      </div>
    </>
  );
}
