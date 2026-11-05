import Link from "next/link";
import { randomUUID } from "crypto";
import { requireAdmin, type Props } from "@/lib/session";
import { getT, type Dictionary } from "@/lib/i18n";
import { money, date, monthLabel, firstOfMonth, today, pct } from "@/lib/format";
import { PageHeader, Card, Flash, Input, Select, Field, Textarea, Badge, statusTone, KpiCard, ButtonLink, EmptyState, Avatar, buttonClass, cx } from "@/components/ui";
import { Submit, Dialog, AutoSubmitSelect } from "@/components/client";
import { Icon } from "@/components/icons";
import { generate, recordPayment, voidPayment, setDiscount } from "./actions";

const studentName = (s: any) => (s ? `${s.last_name ?? ""} ${s.first_name ?? ""}`.trim() : "—");

export default async function PaymentsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const period = /^\d{4}-\d{2}-01$/.test(sp.period ?? "") ? sp.period! : firstOfMonth();
  const b = `/t/${slug}/payments`;

  let q = supabase.from("installment_balances").select("*, students(first_name, last_name, code)").eq("tenant_id", tenant.id).order("created_at");
  if (sp.student) q = q.eq("student_id", sp.student);
  else q = q.eq("period", period);
  if (sp.open === "1") q = q.gt("balance", 0);
  let recentQ = supabase.from("payments").select("*, students(first_name, last_name)").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(15);
  if (sp.student) recentQ = recentQ.eq("student_id", sp.student);
  const [rows, methods, recent, student] = await Promise.all([
    q,
    supabase.from("payment_methods").select("name").eq("tenant_id", tenant.id).eq("is_active", true).order("name"),
    recentQ,
    sp.student ? supabase.from("students").select("id, first_name, last_name, code").eq("tenant_id", tenant.id).eq("id", sp.student).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  for (const r of [rows, methods, recent, student]) if (r.error) throw new Error(r.error.message);

  const list = (rows.data ?? []) as any[];
  const methodNames = ((methods.data ?? []) as any[]).map((x) => x.name as string);
  const recentList = (recent.data ?? []) as any[];
  const totals = list.reduce((a, r) => ({ due: a.due + Number(r.amount_due) - Number(r.discount), paid: a.paid + Number(r.amount_paid), bal: a.bal + Number(r.balance) }), { due: 0, paid: 0, bal: 0 });
  const keep = (extra: Record<string, string | undefined>) => {
    const base = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && !["ok", "error"].includes(k))) as Record<string, string>;
    const merged = { ...base, ...extra };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]);
    return qs.size ? `${b}?${qs}` : b;
  };
  const back = keep({});
  const m = (n: unknown) => money(n as number, locale, tenant.currency);

  const months: string[] = [];
  for (let i = -9; i <= 2; i++) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i); months.push(firstOfMonth(d)); }
  const shift = (n: number) => { const d = new Date(period + "T00:00:00"); d.setMonth(d.getMonth() + n); return firstOfMonth(d); };
  const studentLabel = student.data ? `${studentName(student.data)}${student.data.code ? ` · ${student.data.code}` : ""}` : null;

  const actions = (r: any) => (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {Number(r.balance) > 0 && (
        <Dialog trigger={t.payments.record} icon="card" variant="primary" small title={t.payments.collectFor} description={`${studentName(r.students)} · ${monthLabel(r.period, locale)}`}>
          <PayForm t={t} r={r} back={back} slug={slug} methods={methodNames} m={m} />
        </Dialog>
      )}
      {Number(r.amount_paid) === 0 && (
        <Dialog trigger={t.common.discount} icon="receipt" variant="ghost" small title={t.payments.editDiscount} description={`${studentName(r.students)} · ${monthLabel(r.period, locale)}`}>
          <form action={setDiscount.bind(null, slug, back, r.id)} className="space-y-4">
            <Field label={`${t.common.discount} (MAD)`} hint={`${t.payments.maxAmount}: ${m(r.amount_due)}`}>
              <Input name="discount" type="number" step="0.01" min="0" max={r.amount_due} inputMode="decimal" defaultValue={r.discount} required />
            </Field>
            <div className="flex justify-end"><Submit icon="check">{t.common.save}</Submit></div>
          </form>
        </Dialog>
      )}
      <Link href={`/t/${slug}/documents/invoice/${r.id}`} title={t.payments.invoice} aria-label={t.payments.invoice} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        <Icon name="receipt" className="h-4 w-4" />
      </Link>
    </div>
  );

  return (
    <>
      <PageHeader
        title={t.payments.title}
        subtitle={studentLabel ?? monthLabel(period, locale)}
        actions={<>
          <ButtonLink variant="secondary" href={`/t/${slug}/export/installments?period=${period}${sp.open === "1" ? "&open=1" : ""}`} icon="arrowUpRight">{t.common.export}</ButtonLink>
          {!sp.student && (
            <Dialog trigger={t.payments.generate} icon="plus" variant="primary" title={t.payments.generate} description={monthLabel(period, locale)}>
              <p className="text-sm text-slate-600">{t.payments.generateHelp}</p>
              <form action={generate.bind(null, slug, period)} className="mt-4 flex justify-end"><Submit icon="check">{t.common.confirm}</Submit></form>
            </Dialog>
          )}
        </>}
      />
      <Flash sp={sp} dismissLabel={t.common.dismiss} />

      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        {studentLabel ? (
          <div className="flex items-center gap-3 px-1">
            <Avatar name={studentName(student.data)} size="sm" />
            <div className="min-w-0">
              <div className="text-xs text-slate-500">{t.payments.forStudent}</div>
              <Link href={`/t/${slug}/students/${sp.student}`} className="truncate text-sm font-medium text-slate-900 hover:text-brand-700">{studentLabel}</Link>
            </div>
            <Link href={b} className={cx(buttonClass("ghost", true), "ms-2")}><Icon name="x" className="h-3.5 w-3.5" />{t.common.all}</Link>
          </div>
        ) : (
          <form method="get" action={b} className="flex items-center gap-1.5">
            {sp.open === "1" && <input type="hidden" name="open" value="1" />}
            <Link href={keep({ period: shift(-1) })} aria-label={t.payments.prevMonth} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Icon name="chevronLeft" className="h-4 w-4 rtl:rotate-180" /></Link>
            <div className="w-48">
              <AutoSubmitSelect name="period" defaultValue={period} aria-label={t.common.period}>
                {(months.includes(period) ? months : [period, ...months]).map((x) => <option key={x} value={x}>{monthLabel(x, locale)}</option>)}
              </AutoSubmitSelect>
            </div>
            <Link href={keep({ period: shift(1) })} aria-label={t.payments.nextMonth} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Icon name="chevronRight" className="h-4 w-4 rtl:rotate-180" /></Link>
          </form>
        )}
        <div role="group" aria-label={t.payments.statusFilter} className="inline-flex self-start rounded-lg bg-slate-100 p-0.5 sm:self-auto">
          {[{ v: undefined, label: t.payments.allStatuses }, { v: "1", label: t.payments.onlyOutstanding }].map((o) => {
            const active = (sp.open === "1") === (o.v === "1");
            return (
              <Link key={o.label} href={keep({ open: o.v })} aria-current={active ? "true" : undefined} className={cx("rounded-md px-3 py-1.5 text-xs font-medium transition", active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
                {o.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t.payments.due} value={m(totals.due)} icon="receipt" tone="neutral" />
        <KpiCard label={t.payments.paid} value={m(totals.paid)} icon="trendUp" tone="income" />
        <KpiCard label={t.payments.balance} value={m(totals.bal)} icon="clock" tone={totals.bal > 0 ? "warn" : "neutral"} />
        <KpiCard label={t.payments.recoveryRate} value={totals.due > 0 ? pct((totals.paid / totals.due) * 100) : "—"} icon="chart" tone="brand" />
      </div>

      <Card className="mt-6" title={t.payments.installments} description={`${list.length} ${t.common.results}`} bodyClassName="p-0">
        {list.length === 0 ? (
          <div className="p-5">
            <EmptyState icon="receipt" title={t.payments.noInstallments} action={!sp.student && sp.open !== "1" ? <span className="text-xs text-slate-500">{t.payments.noInstallmentsHint}</span> : undefined} />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-2.5 text-start font-medium">{t.common.student}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.common.period}</th>
                    <th className="px-4 py-2.5 text-end font-medium">{t.payments.due}</th>
                    <th className="px-4 py-2.5 text-end font-medium">{t.payments.paid}</th>
                    <th className="px-4 py-2.5 text-end font-medium">{t.payments.balance}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.common.status}</th>
                    <th className="px-5 py-2.5 text-end font-medium">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <Link href={`/t/${slug}/students/${r.student_id}`} className="flex items-center gap-3">
                          <Avatar name={studentName(r.students)} size="sm" />
                          <span className="min-w-0"><span className="block truncate font-medium text-slate-900 hover:text-brand-700">{studentName(r.students)}</span><span className="block text-xs text-slate-500">{r.students?.code ?? "—"}</span></span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3"><div className="text-slate-800">{monthLabel(r.period, locale)}</div><div className="text-xs text-slate-400">{r.invoice_no}</div></td>
                      <td className="whitespace-nowrap px-4 py-3 text-end tabular-nums">
                        <div className="text-slate-800">{m(Number(r.amount_due) - Number(r.discount))}</div>
                        {Number(r.discount) > 0 && <div className="text-xs text-slate-400">−{m(r.discount)}</div>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-end tabular-nums text-emerald-700">{m(r.amount_paid)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-end font-semibold tabular-nums text-slate-900">{m(r.balance)}</td>
                      <td className="whitespace-nowrap px-4 py-3"><Badge tone={statusTone(r.payment_status)}>{t.status[r.payment_status as keyof typeof t.status]}</Badge></td>
                      <td className="px-5 py-3">{actions(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 lg:hidden">
              {list.map((r) => (
                <li key={r.id} className="space-y-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/t/${slug}/students/${r.student_id}`} className="flex min-w-0 items-center gap-3">
                      <Avatar name={studentName(r.students)} size="sm" />
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{studentName(r.students)}</span><span className="block text-xs text-slate-500">{monthLabel(r.period, locale)} · {r.invoice_no}</span></span>
                    </Link>
                    <Badge tone={statusTone(r.payment_status)}>{t.status[r.payment_status as keyof typeof t.status]}</Badge>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <div><dt className="text-slate-500">{t.payments.due}</dt><dd className="tabular-nums text-slate-800">{m(Number(r.amount_due) - Number(r.discount))}</dd></div>
                    <div><dt className="text-slate-500">{t.payments.paid}</dt><dd className="tabular-nums text-emerald-700">{m(r.amount_paid)}</dd></div>
                    <div><dt className="text-slate-500">{t.payments.balance}</dt><dd className="font-semibold tabular-nums text-slate-900">{m(r.balance)}</dd></div>
                  </dl>
                  {actions(r)}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card className="mt-6" title={t.students.paymentHistory} bodyClassName="p-0">
        {recentList.length === 0 ? (
          <div className="p-5"><EmptyState icon="card" title={t.payments.noRecent} /></div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentList.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", p.voided_at ? "bg-slate-100 text-slate-400" : "bg-income-soft text-income")}><Icon name="card" className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">{studentName(p.students)}</div>
                  <div className="truncate text-xs text-slate-500">
                    <Link className="text-brand-700 hover:underline" href={`/t/${slug}/documents/receipt/${p.id}`}>{p.receipt_no}</Link> · {date(p.paid_on, locale)} · {p.method}
                    {p.voided_at && p.void_reason ? ` · ${p.void_reason}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-end">
                    <div className={cx("text-sm font-semibold tabular-nums", p.voided_at ? "text-slate-400 line-through" : "text-income")}>{m(p.amount)}</div>
                    {p.voided_at && <Badge tone="red">{t.status.voided}</Badge>}
                  </div>
                  {!p.voided_at && (
                    <Dialog trigger={t.payments.void} variant="ghost" small icon="refresh" title={t.payments.voidTitle} description={`${p.receipt_no} · ${m(p.amount)}`}>
                      <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{t.payments.voidHelp}</p>
                      <form action={voidPayment.bind(null, slug, back, p.id)} className="space-y-4">
                        <Field label={t.payments.voidReason} required>
                          <Textarea name="reason" required minLength={3} maxLength={300} rows={3} />
                        </Field>
                        <div className="flex justify-end"><Submit variant="danger" icon="refresh">{t.payments.void}</Submit></div>
                      </form>
                    </Dialog>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/** Payment form for one installment. A fresh idempotency key per render prevents double submission. */
function PayForm({ t, r, back, slug, methods, m }: { t: Dictionary; r: any; back: string; slug: string; methods: string[]; m: (n: unknown) => string }) {
  return (
    <form action={recordPayment.bind(null, slug, back)} className="space-y-4">
      <input type="hidden" name="installment_id" value={r.id} />
      <input type="hidden" name="student_id" value={r.student_id} />
      <input type="hidden" name="idempotency_key" value={randomUUID()} />
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
        <div><div className="text-slate-500">{t.payments.due}</div><div className="tabular-nums text-slate-800">{m(Number(r.amount_due) - Number(r.discount))}</div></div>
        <div><div className="text-slate-500">{t.payments.paid}</div><div className="tabular-nums text-emerald-700">{m(r.amount_paid)}</div></div>
        <div><div className="text-slate-500">{t.payments.balance}</div><div className="font-semibold tabular-nums text-slate-900">{m(r.balance)}</div></div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={`${t.common.amount} (MAD)`} required hint={`${t.payments.maxAmount}: ${m(r.balance)}`}>
          <Input name="amount" type="number" step="0.01" min="0.01" max={r.balance} inputMode="decimal" defaultValue={r.balance} required />
        </Field>
        <Field label={t.common.method} required>
          <Select name="method" required>{methods.map((x) => <option key={x}>{x}</option>)}</Select>
        </Field>
        <Field label={t.payments.paidOn} required><Input name="paid_on" type="date" defaultValue={today()} max={today()} required /></Field>
        <Field label={t.common.reference} hint={t.common.optional}><Input name="reference" maxLength={80} /></Field>
      </div>
      <div className="flex justify-end"><Submit icon="check">{t.payments.record}</Submit></div>
    </form>
  );
}
