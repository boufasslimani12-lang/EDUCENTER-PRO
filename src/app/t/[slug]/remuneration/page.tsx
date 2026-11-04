import { requireOperational, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { money, monthLabel, firstOfMonth, today } from "@/lib/format";
import { PageHeader, Card, Flash, Input, Select, Field, Table, Td, Badge, Stat, Grid } from "@/components/ui";
import { Submit } from "@/components/client";
import { addRule, deleteRule, calculate, pay } from "./actions";

export default async function RemunerationPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant, role } = await requireOperational(slug);
  const { t, locale } = await getT();

  if (role === "teacher") {
    const { data } = await supabase.rpc("my_remuneration", { p_tenant: tenant.id });
    const rows = (data ?? []) as any[];
    const sum = (k: string) => rows.reduce((s, r) => s + Number(r[k]), 0);
    return (
      <>
        <PageHeader title={t.remuneration.mySummary} />
        <Grid cols={3}>
          <Stat label={t.remuneration.calculated} value={money(sum("calculated_amount"), locale)} />
          <Stat label={t.remuneration.paid} value={money(sum("paid_amount"), locale)} tone="good" />
          <Stat label={t.remuneration.outstanding} value={money(sum("outstanding"), locale)} tone="warn" />
        </Grid>
        <Card className="mt-6">
          <Table head={[t.common.period, t.remuneration.calculated, t.remuneration.paid, t.remuneration.outstanding]} empty={!rows.length && t.common.empty}>
            {rows.map((r) => (
              <tr key={r.period}><Td>{monthLabel(r.period, locale)}</Td><Td className="tabular-nums">{money(r.calculated_amount, locale)}</Td><Td className="tabular-nums">{money(r.paid_amount, locale)}</Td><Td className="tabular-nums font-medium">{money(r.outstanding, locale)}</Td></tr>
            ))}
          </Table>
        </Card>
      </>
    );
  }

  const lk = await lookups(supabase, tenant.id);
  const period = /^\d{4}-\d{2}-01$/.test(sp.period ?? "") ? sp.period! : firstOfMonth();
  const [{ data: rules }, { data: stmts }] = await Promise.all([
    supabase.from("remuneration_rules").select("*, teachers(full_name), classes(name), groups(name)").eq("tenant_id", tenant.id).order("created_at"),
    supabase.from("remuneration_statements").select("*, teachers(full_name), remuneration_payments(amount)").eq("tenant_id", tenant.id).eq("period", period),
  ]);
  const months: string[] = [];
  for (let i = -11; i <= 0; i++) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i); months.push(firstOfMonth(d)); }

  return (
    <>
      <PageHeader title={t.remuneration.title} />
      <Flash sp={sp} />
      <Card title={t.remuneration.statements} actions={
        <div className="flex gap-2">
          <form className="flex gap-2"><Select name="period" defaultValue={period}>{months.map((m) => <option key={m} value={m}>{monthLabel(m, locale)}</option>)}</Select><button className="rounded-lg bg-slate-800 px-3 text-sm text-white">{t.common.filter}</button></form>
          <form action={calculate.bind(null, slug, period)}><Submit>{t.remuneration.calculate}</Submit></form>
        </div>
      }>
        <Table head={[t.common.teacher, t.remuneration.calculated, t.remuneration.paid, t.remuneration.outstanding, t.common.details, t.remuneration.pay]} empty={!stmts?.length && t.common.empty}>
          {(stmts ?? []).map((s: any) => {
            const paid = (s.remuneration_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
            const out = Number(s.calculated_amount) - paid;
            return (
              <tr key={s.id} className="align-top">
                <Td className="font-medium">{s.teachers?.full_name}</Td>
                <Td className="tabular-nums">{money(s.calculated_amount, locale)}</Td>
                <Td className="tabular-nums">{money(paid, locale)}</Td>
                <Td className="tabular-nums font-semibold">{money(out, locale)}</Td>
                <Td>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-brand-700">{(s.details ?? []).length}</summary>
                    <ul className="mt-1 space-y-0.5">
                      {(s.details ?? []).map((d: any, i: number) => (
                        <li key={i}>{d.label}: {d.percentage}% × {money(d.revenue, locale)} ({d.basis === "due" ? t.remuneration.due : t.remuneration.collected}) = <b>{money(d.amount, locale)}</b></li>
                      ))}
                    </ul>
                  </details>
                </Td>
                <Td>
                  {out > 0 && (
                    <form action={pay.bind(null, slug, period, s.id)} className="flex gap-1">
                      <Input name="amount" type="number" step="0.01" min="0.01" max={out} defaultValue={out.toFixed(2)} className="w-24" />
                      <Select name="method" className="w-28">{lk.methods.map((m) => <option key={m.id}>{m.name}</option>)}</Select>
                      <input type="hidden" name="paid_on" value={today()} />
                      <Submit small>{t.remuneration.pay}</Submit>
                    </form>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Card title={t.remuneration.rules} className="mt-6">
        <Table head={[t.common.teacher, t.teachers.target, t.remuneration.percentage, t.remuneration.basis, ""]} empty={!rules?.length && t.common.empty}>
          {(rules ?? []).map((r: any) => (
            <tr key={r.id}>
              <Td className="font-medium">{r.teachers?.full_name}</Td>
              <Td>{r.classes?.name ?? r.groups?.name ?? <Badge tone="blue">{t.remuneration.defaultRule}</Badge>}</Td>
              <Td className="tabular-nums">{r.percentage}%</Td>
              <Td>{r.basis === "due" ? t.remuneration.due : t.remuneration.collected}</Td>
              <Td><form action={deleteRule.bind(null, slug, r.id)}><Submit small variant="ghost" confirm={t.common.delete + " ?"}>{t.common.delete}</Submit></form></Td>
            </tr>
          ))}
        </Table>
        <form action={addRule.bind(null, slug)} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <Field label={t.common.teacher}><Select name="teacher_id" required>{lk.teachers.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</Select></Field>
          <Field label={t.teachers.target}>
            <Select name="target">
              <option value="">{t.remuneration.defaultRule}</option>
              <optgroup label={t.structure.classes}>{lk.activeClasses.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>
              <optgroup label={t.nav.groups}>{lk.activeGroups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}</optgroup>
            </Select>
          </Field>
          <Field label={t.remuneration.percentage}><Input name="percentage" type="number" step="0.01" min="0" max="100" required /></Field>
          <Field label={t.remuneration.basis}><Select name="basis"><option value="collected">{t.remuneration.collected}</option><option value="due">{t.remuneration.due}</option></Select></Field>
          <div className="flex items-end"><Submit>{t.common.add}</Submit></div>
        </form>
      </Card>
    </>
  );
}
