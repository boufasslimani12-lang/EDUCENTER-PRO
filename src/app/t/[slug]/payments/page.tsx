import Link from "next/link";
import { randomUUID } from "crypto";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { money, date, monthLabel, firstOfMonth, today } from "@/lib/format";
import { PageHeader, Card, Flash, Input, Select, Table, Td, Badge, statusTone, Stat, Grid, ButtonLink } from "@/components/ui";
import { Submit } from "@/components/client";
import { generate, recordPayment, voidPayment, setDiscount } from "./actions";

export default async function PaymentsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const period = /^\d{4}-\d{2}-01$/.test(sp.period ?? "") ? sp.period! : firstOfMonth();

  let q = supabase.from("installment_balances").select("*, students(first_name, last_name, code)").eq("tenant_id", tenant.id).order("created_at");
  if (sp.student) q = q.eq("student_id", sp.student);
  else q = q.eq("period", period);
  if (sp.open === "1") q = q.gt("balance", 0);
  const [{ data: rows }, { data: methods }, { data: recent }] = await Promise.all([
    q,
    supabase.from("payment_methods").select("name").eq("tenant_id", tenant.id).eq("is_active", true).order("name"),
    supabase.from("payments").select("*, students(first_name, last_name)").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(15),
  ]);
  const list = (rows ?? []) as any[];
  const totals = list.reduce((a, r) => ({ due: a.due + Number(r.amount_due) - Number(r.discount), paid: a.paid + Number(r.amount_paid), bal: a.bal + Number(r.balance) }), { due: 0, paid: 0, bal: 0 });
  const back = `/t/${slug}/payments?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !["ok", "error"].includes(k)) as [string, string][])}`;

  const months: string[] = [];
  for (let i = -9; i <= 2; i++) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i); months.push(firstOfMonth(d)); }

  return (
    <>
      <PageHeader
        title={t.payments.title}
        subtitle={sp.student ? list[0] && `${list[0].students?.last_name} ${list[0].students?.first_name}` : monthLabel(period, locale)}
        actions={<>
          <ButtonLink variant="secondary" href={`/t/${slug}/export/installments?period=${period}`}>{t.common.export}</ButtonLink>
          {!sp.student && <form action={generate.bind(null, slug, period)}><Submit>{t.payments.generate}</Submit></form>}
        </>}
      />
      <Flash sp={sp} />
      <form className="mb-4 flex flex-wrap items-center gap-3">
        <Select name="period" defaultValue={period} className="w-48">
          {months.map((m) => <option key={m} value={m}>{monthLabel(m, locale)}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="open" value="1" defaultChecked={sp.open === "1"} />{t.payments.onlyOutstanding}</label>
        <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">{t.common.filter}</button>
        {sp.student && <Link className="text-sm text-brand-700 underline" href={`/t/${slug}/payments`}>{t.common.all}</Link>}
      </form>
      <Grid cols={3}>
        <Stat label={t.payments.due} value={money(totals.due, locale)} />
        <Stat label={t.payments.paid} value={money(totals.paid, locale)} tone="good" />
        <Stat label={t.payments.balance} value={money(totals.bal, locale)} tone={totals.bal > 0 ? "warn" : "default"} />
      </Grid>
      <Card className="mt-6">
        <Table head={[t.common.student, t.common.period, t.payments.due, t.common.discount, t.payments.paid, t.payments.balance, t.common.status, t.payments.record]} empty={!list.length && t.common.empty}>
          {list.map((r) => (
            <tr key={r.id} className="align-top">
              <Td><Link className="font-medium text-brand-700 hover:underline" href={`/t/${slug}/students/${r.student_id}`}>{r.students?.last_name} {r.students?.first_name}</Link></Td>
              <Td>{monthLabel(r.period, locale)}<div className="text-xs text-slate-400">{r.invoice_no}</div></Td>
              <Td className="tabular-nums">{money(r.amount_due, locale)}</Td>
              <Td>
                {Number(r.amount_paid) === 0 ? (
                  <form action={setDiscount.bind(null, slug, back, r.id)} className="flex gap-1">
                    <Input name="discount" type="number" step="0.01" min="0" max={r.amount_due} defaultValue={r.discount} className="w-24" />
                    <Submit small variant="ghost">✓</Submit>
                  </form>
                ) : money(r.discount, locale)}
              </Td>
              <Td className="tabular-nums">{money(r.amount_paid, locale)}</Td>
              <Td className="tabular-nums font-semibold">{money(r.balance, locale)}</Td>
              <Td><Badge tone={statusTone(r.payment_status)}>{t.status[r.payment_status as keyof typeof t.status]}</Badge></Td>
              <Td>
                {Number(r.balance) > 0 ? (
                  <form action={recordPayment.bind(null, slug, back)} className="flex flex-wrap gap-1">
                    <input type="hidden" name="installment_id" value={r.id} />
                    <input type="hidden" name="student_id" value={r.student_id} />
                    <input type="hidden" name="idempotency_key" value={randomUUID()} />
                    <input type="hidden" name="paid_on" value={today()} />
                    <Input name="amount" type="number" step="0.01" min="0.01" max={r.balance} defaultValue={r.balance} className="w-24" required />
                    <Select name="method" className="w-28">{(methods ?? []).map((m: any) => <option key={m.name}>{m.name}</option>)}</Select>
                    <Submit small>{t.payments.record}</Submit>
                  </form>
                ) : (
                  <Link className="text-xs text-brand-700 hover:underline" href={`/t/${slug}/documents/invoice/${r.id}`}>{t.payments.invoice}</Link>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title={t.students.paymentHistory} className="mt-6">
        <Table head={[t.payments.receiptNo, t.common.student, t.payments.paidOn, t.common.amount, t.common.method, t.common.status, t.payments.void]} empty={!recent?.length && t.common.empty}>
          {(recent ?? []).map((p: any) => (
            <tr key={p.id}>
              <Td><Link className="text-brand-700 hover:underline" href={`/t/${slug}/documents/receipt/${p.id}`}>{p.receipt_no}</Link></Td>
              <Td>{p.students?.last_name} {p.students?.first_name}</Td>
              <Td>{date(p.paid_on, locale)}</Td>
              <Td className="tabular-nums">{money(p.amount, locale)}</Td>
              <Td>{p.method}</Td>
              <Td>{p.voided_at ? <span title={p.void_reason}><Badge tone="red">{t.status.voided}</Badge></span> : <Badge tone="green">{t.status.paid}</Badge>}</Td>
              <Td>
                {!p.voided_at && (
                  <form action={voidPayment.bind(null, slug, back, p.id)} className="flex gap-1">
                    <Input name="reason" placeholder={t.payments.voidReason} required minLength={3} className="w-40" />
                    <Submit small variant="danger" confirm={t.payments.void + " ?"}>{t.payments.void}</Submit>
                  </form>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
