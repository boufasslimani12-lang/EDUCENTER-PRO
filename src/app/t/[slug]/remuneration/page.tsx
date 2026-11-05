import Link from "next/link";
import { requireOperational, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { money, monthLabel, firstOfMonth, today } from "@/lib/format";
import { PageHeader, Card, Flash, Input, Select, Field, Badge, KpiCard, EmptyState, Avatar, cx } from "@/components/ui";
import { Submit, Dialog, AutoSubmitSelect } from "@/components/client";
import { Icon } from "@/components/icons";
import { addRule, deleteRule, calculate, pay } from "./actions";

export default async function RemunerationPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant, role } = await requireOperational(slug);
  const { t, locale } = await getT();
  const m = (n: unknown) => money(n as number, locale, tenant.currency);
  const b = `/t/${slug}/remuneration`;

  if (role === "teacher") {
    const { data, error } = await supabase.rpc("my_remuneration", { p_tenant: tenant.id });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    const sum = (k: string) => rows.reduce((s, r) => s + Number(r[k]), 0);
    return (
      <>
        <PageHeader title={t.remuneration.mySummary} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label={t.remuneration.calculated} value={m(sum("calculated_amount"))} icon="wallet" tone="brand" />
          <KpiCard label={t.remuneration.paid} value={m(sum("paid_amount"))} icon="check" tone="income" />
          <KpiCard label={t.remuneration.outstanding} value={m(sum("outstanding"))} icon="clock" tone={sum("outstanding") > 0 ? "warn" : "neutral"} />
        </div>
        <Card className="mt-6" title={t.remuneration.statements} bodyClassName="p-0">
          {rows.length ? (
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.period} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="font-medium text-slate-900">{monthLabel(r.period, locale)}</span>
                  <span className="grid grid-cols-3 gap-4 text-end text-xs sm:text-sm">
                    <span><span className="block text-slate-500">{t.remuneration.calculated}</span><span className="tabular-nums">{m(r.calculated_amount)}</span></span>
                    <span><span className="block text-slate-500">{t.remuneration.paid}</span><span className="tabular-nums text-emerald-700">{m(r.paid_amount)}</span></span>
                    <span><span className="block text-slate-500">{t.remuneration.outstanding}</span><span className="font-semibold tabular-nums">{m(r.outstanding)}</span></span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <div className="p-5"><EmptyState icon="wallet" title={t.remuneration.noStatements} /></div>}
        </Card>
      </>
    );
  }

  const view = sp.view === "year" ? "year" : "month";
  const period = /^\d{4}-\d{2}-01$/.test(sp.period ?? "") ? sp.period! : firstOfMonth();
  const year = /^\d{4}$/.test(sp.year ?? "") ? Number(sp.year) : Number(period.slice(0, 4));
  const lk = await lookups(supabase, tenant.id);

  const stmtQ = supabase.from("remuneration_statements")
    .select("id, teacher_id, period, calculated_amount, details, calculated_at, teachers(full_name), remuneration_payments(id, amount, paid_on, method, note)")
    .eq("tenant_id", tenant.id);
  const [stmts, rules] = await Promise.all([
    view === "month" ? stmtQ.eq("period", period) : stmtQ.gte("period", `${year}-01-01`).lte("period", `${year}-12-01`),
    supabase.from("remuneration_rules").select("*, teachers(full_name), classes(name), groups(name)").eq("tenant_id", tenant.id).order("created_at"),
  ]);
  for (const r of [stmts, rules]) if (r.error) throw new Error(r.error.message);

  const rows = ((stmts.data ?? []) as any[]).map((s) => {
    const paid = (s.remuneration_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
    const outstanding = Math.round((Number(s.calculated_amount) - paid) * 100) / 100;
    const revenue = (s.details ?? []).reduce((a: number, d: any) => a + Number(d.revenue ?? 0), 0);
    return { ...s, paid, outstanding, revenue, status: outstanding <= 0 && Number(s.calculated_amount) > 0 ? "paid" : paid > 0 ? "partial" : "unpaid" };
  }).sort((a, b) => String(a.teachers?.full_name).localeCompare(String(b.teachers?.full_name)));
  const tot = rows.reduce((a, r) => ({ calc: a.calc + Number(r.calculated_amount), paid: a.paid + r.paid, out: a.out + Math.max(0, r.outstanding) }), { calc: 0, paid: 0, out: 0 });

  const months: string[] = [];
  for (let i = -11; i <= 1; i++) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i); months.push(firstOfMonth(d)); }
  const shift = (n: number) => { const d = new Date(period + "T00:00:00"); d.setMonth(d.getMonth() + n); return firstOfMonth(d); };
  const statusBadge = (s: string) => s === "paid" ? <Badge tone="green">{t.remuneration.paidFull}</Badge> : s === "partial" ? <Badge tone="amber">{t.remuneration.partialPaid}</Badge> : <Badge>{t.remuneration.unpaid}</Badge>;

  const payDialog = (r: any) => (
    <Dialog trigger={t.remuneration.pay} icon="wallet" variant="primary" small title={t.remuneration.payoutTitle} description={`${r.teachers?.full_name} · ${monthLabel(r.period, locale)}`}>
      <form action={pay.bind(null, slug, period, r.id)} className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
          <div><div className="text-slate-500">{t.remuneration.calculated}</div><div className="tabular-nums">{m(r.calculated_amount)}</div></div>
          <div><div className="text-slate-500">{t.remuneration.paid}</div><div className="tabular-nums text-emerald-700">{m(r.paid)}</div></div>
          <div><div className="text-slate-500">{t.remuneration.outstanding}</div><div className="font-semibold tabular-nums">{m(r.outstanding)}</div></div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={`${t.common.amount} (MAD)`} required hint={`${t.payments.maxAmount}: ${m(r.outstanding)}`}>
            <Input name="amount" type="number" step="0.01" min="0.01" max={r.outstanding} inputMode="decimal" defaultValue={r.outstanding.toFixed(2)} required />
          </Field>
          <Field label={t.common.method} required><Select name="method" required>{lk.methods.map((x) => <option key={x.id}>{x.name}</option>)}</Select></Field>
          <Field label={t.payments.paidOn} required><Input name="paid_on" type="date" defaultValue={today()} max={today()} required /></Field>
          <Field label={t.remuneration.note} hint={t.common.optional}><Input name="note" maxLength={200} /></Field>
        </div>
        <div className="flex justify-end"><Submit icon="check">{t.remuneration.pay}</Submit></div>
      </form>
    </Dialog>
  );
  const breakdownDialog = (r: any) => (
    <Dialog trigger={t.remuneration.breakdown} variant="ghost" small icon="chart" title={t.remuneration.breakdown} description={`${r.teachers?.full_name} · ${monthLabel(r.period, locale)}`}>
      {(r.details ?? []).length ? (
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-500"><th className="py-1 text-start font-medium">{t.teachers.target}</th><th className="py-1 text-end font-medium">{t.remuneration.revenue}</th><th className="py-1 text-end font-medium">%</th><th className="py-1 text-end font-medium">{t.common.amount}</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {(r.details as any[]).map((d, i) => (
              <tr key={i}><td className="py-1.5">{d.label}<div className="text-[11px] text-slate-400">{d.basis === "due" ? t.remuneration.due : t.remuneration.collected}</div></td><td className="py-1.5 text-end tabular-nums">{m(d.revenue)}</td><td className="py-1.5 text-end tabular-nums">{d.percentage}</td><td className="py-1.5 text-end font-medium tabular-nums">{m(d.amount)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr className="font-semibold"><td className="pt-2" colSpan={3}>{t.common.total}</td><td className="pt-2 text-end tabular-nums">{m(r.calculated_amount)}</td></tr></tfoot>
        </table>
      ) : <EmptyState title={t.common.empty} />}
    </Dialog>
  );

  return (
    <>
      <PageHeader
        title={t.remuneration.title}
        subtitle={view === "month" ? monthLabel(period, locale) : `${t.remuneration.yearSummary} ${year}`}
        actions={<>
          <Dialog trigger={t.remuneration.addRule} icon="plus" variant="secondary" title={t.remuneration.addRule} description={t.remuneration.rulesHint}>
            <form action={addRule.bind(null, slug)} className="space-y-4">
              <input type="hidden" name="period" value={period} />
              <Field label={t.common.teacher} required><Select name="teacher_id" required>{lk.teachers.filter((x) => x.is_active).map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</Select></Field>
              <Field label={t.teachers.target}>
                <Select name="target">
                  <option value="">{t.remuneration.defaultRule}</option>
                  <optgroup label={t.structure.classes}>{lk.activeClasses.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>
                  <optgroup label={t.nav.groups}>{lk.activeGroups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}</optgroup>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label={`${t.remuneration.percentage} (%)`} required><Input name="percentage" type="number" step="0.01" min="0" max="100" required inputMode="decimal" /></Field>
                <Field label={t.remuneration.basis}><Select name="basis"><option value="collected">{t.remuneration.collected}</option><option value="due">{t.remuneration.due}</option></Select></Field>
              </div>
              <div className="flex justify-end"><Submit icon="check">{t.common.add}</Submit></div>
            </form>
          </Dialog>
          {view === "month" && (
            <Dialog trigger={t.remuneration.calculate} icon="refresh" variant="primary" title={t.remuneration.calculate} description={monthLabel(period, locale)}>
              <p className="text-sm text-slate-600">{t.remuneration.calculateHelp}</p>
              <form action={calculate.bind(null, slug, period)} className="mt-4 flex justify-end"><Submit icon="check">{t.common.confirm}</Submit></form>
            </Dialog>
          )}
        </>}
      />
      <Flash sp={sp} dismissLabel={t.common.dismiss} />

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        {view === "month" ? (
          <form method="get" action={b} className="flex items-center gap-1.5">
            <Link href={`${b}?period=${shift(-1)}`} aria-label={t.payments.prevMonth} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Icon name="chevronLeft" className="h-4 w-4 rtl:rotate-180" /></Link>
            <div className="w-48"><AutoSubmitSelect name="period" defaultValue={period} aria-label={t.common.period}>{(months.includes(period) ? months : [period, ...months]).map((x) => <option key={x} value={x}>{monthLabel(x, locale)}</option>)}</AutoSubmitSelect></div>
            <Link href={`${b}?period=${shift(1)}`} aria-label={t.payments.nextMonth} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Icon name="chevronRight" className="h-4 w-4 rtl:rotate-180" /></Link>
          </form>
        ) : (
          <form method="get" action={b} className="flex items-center gap-2">
            <input type="hidden" name="view" value="year" />
            <div className="w-32"><AutoSubmitSelect name="year" defaultValue={String(year)} aria-label={t.remuneration.year}>{[0, 1, 2, 3].map((k) => { const y = new Date().getFullYear() - k; return <option key={y} value={y}>{y}</option>; })}</AutoSubmitSelect></div>
          </form>
        )}
        <div role="group" aria-label={t.common.period} className="inline-flex self-start rounded-lg bg-slate-100 p-0.5 sm:self-auto">
          {[{ v: "month", label: t.remuneration.monthView, href: `${b}?period=${period}` }, { v: "year", label: t.remuneration.yearView, href: `${b}?view=year&year=${year}` }].map((o) => (
            <Link key={o.v} href={o.href} aria-current={view === o.v ? "true" : undefined} className={cx("rounded-md px-3 py-1.5 text-xs font-medium transition", view === o.v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>{o.label}</Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t.remuneration.calculated} value={m(tot.calc)} icon="wallet" tone="brand" />
        <KpiCard label={t.remuneration.paid} value={m(tot.paid)} icon="check" tone="income" />
        <KpiCard label={t.remuneration.outstanding} value={m(tot.out)} icon="clock" tone={tot.out > 0 ? "warn" : "neutral"} />
        <KpiCard label={t.nav.teachers} value={new Set(rows.map((r) => r.teacher_id)).size} hint={t.remuneration.teacherCount} icon="teacher" tone="accent" />
      </div>

      {view === "month" ? (
        <Card className="mt-6" title={t.remuneration.statements} description={`${rows.length} ${t.common.results}`} bodyClassName="p-0">
          {rows.length === 0 ? (
            <div className="p-5"><EmptyState icon="wallet" title={t.remuneration.noStatements} action={<span className="max-w-sm text-xs text-slate-500">{t.remuneration.noStatementsHint}</span>} /></div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <Link href={`/t/${slug}/teachers/${r.teacher_id}?tab=pay`} className="flex min-w-0 items-center gap-3 lg:w-64">
                    <Avatar name={r.teachers?.full_name ?? "?"} size="sm" />
                    <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">{r.teachers?.full_name}</span><span className="block text-xs text-slate-500">{t.remuneration.revenue}: {m(r.revenue)}</span></span>
                  </Link>
                  <dl className="grid flex-1 grid-cols-3 gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs lg:bg-transparent lg:p-0 lg:text-sm">
                    <div><dt className="text-slate-500">{t.remuneration.calculated}</dt><dd className="tabular-nums text-slate-900">{m(r.calculated_amount)}</dd></div>
                    <div><dt className="text-slate-500">{t.remuneration.paid}</dt><dd className="tabular-nums text-emerald-700">{m(r.paid)}</dd></div>
                    <div><dt className="text-slate-500">{t.remuneration.outstanding}</dt><dd className="font-semibold tabular-nums text-slate-900">{m(r.outstanding)}</dd></div>
                  </dl>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {statusBadge(r.status)}
                    {r.outstanding > 0 && payDialog(r)}
                    {breakdownDialog(r)}
                    <Link href={`${b}/statement/${r.id}`} title={t.remuneration.printStatement} aria-label={t.remuneration.printStatement} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Icon name="receipt" className="h-4 w-4" /></Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card className="mt-6" title={`${t.remuneration.yearSummary} ${year}`} bodyClassName="p-0">
          {rows.length === 0 ? <div className="p-5"><EmptyState icon="wallet" title={t.remuneration.noStatements} /></div> : (() => {
            const teachers = Array.from(new Map(rows.map((r) => [r.teacher_id, r.teachers?.full_name])).entries());
            const cell = (tid: string, mo: number) => rows.find((r) => r.teacher_id === tid && Number(r.period.slice(5, 7)) === mo);
            return (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead><tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="sticky start-0 bg-slate-50 px-4 py-2.5 text-start font-medium">{t.common.teacher}</th>
                    {Array.from({ length: 12 }, (_, i) => <th key={i} className="px-3 py-2.5 text-end font-medium">{monthLabel(`${year}-${String(i + 1).padStart(2, "0")}-01`, locale).split(" ")[0].slice(0, 4)}</th>)}
                    <th className="px-4 py-2.5 text-end font-medium">{t.common.total}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {teachers.map(([tid, name]) => {
                      const tr = rows.filter((r) => r.teacher_id === tid);
                      return (
                        <tr key={tid}>
                          <td className="sticky start-0 whitespace-nowrap bg-white px-4 py-2 font-medium text-slate-900">{name}</td>
                          {Array.from({ length: 12 }, (_, i) => { const c = cell(tid, i + 1); return <td key={i} className="whitespace-nowrap px-3 py-2 text-end tabular-nums">{c ? <><div>{m(c.calculated_amount)}</div><div className={c.outstanding > 0 ? "text-amber-700" : "text-emerald-700"}>{m(c.paid)}</div></> : <span className="text-slate-300">—</span>}</td>; })}
                          <td className="whitespace-nowrap px-4 py-2 text-end font-semibold tabular-nums">{m(tr.reduce((a, r) => a + Number(r.calculated_amount), 0))}<div className="font-normal text-emerald-700">{m(tr.reduce((a, r) => a + r.paid, 0))}</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="px-4 py-2 text-[11px] text-slate-500">{t.remuneration.calculated} / <span className="text-emerald-700">{t.remuneration.paid}</span></p>
              </div>
            );
          })()}
        </Card>
      )}

      {view === "month" && (
        <Card className="mt-6" title={t.remuneration.rules} description={t.remuneration.rulesHint} bodyClassName="p-0">
          {(rules.data ?? []).length ? (
            <ul className="divide-y divide-slate-100">
              {((rules.data ?? []) as any[]).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{r.teachers?.full_name}</span>
                  <span className="text-slate-600">{r.classes?.name ?? r.groups?.name ?? <Badge tone="blue">{t.remuneration.defaultRule}</Badge>}</span>
                  <Badge>{r.percentage}% · {r.basis === "due" ? t.remuneration.due : t.remuneration.collected}</Badge>
                  <form action={deleteRule.bind(null, slug, r.id)}>
                    <input type="hidden" name="period" value={period} />
                    <Submit small variant="ghost" icon="x" confirm={t.remuneration.deleteRuleConfirm}>{t.common.delete}</Submit>
                  </form>
                </li>
              ))}
            </ul>
          ) : <div className="p-5"><EmptyState icon="wallet" title={t.remuneration.noRules} /></div>}
        </Card>
      )}
    </>
  );
}
