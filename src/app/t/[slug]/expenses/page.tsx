import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { money, date, today, firstOfMonth } from "@/lib/format";
import { PageHeader, Card, Flash, Input, Select, Field, Table, Td, Badge, ButtonLink, Stat } from "@/components/ui";
import { Submit } from "@/components/client";
import { addExpense, voidExpense, addCategory } from "./actions";

export default async function ExpensesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const from = sp.from ?? firstOfMonth();
  const to = sp.to ?? today();
  let q = supabase.from("expenses").select("*, expense_categories(name)").eq("tenant_id", tenant.id).gte("spent_on", from).lte("spent_on", to).order("spent_on", { ascending: false });
  if (sp.category) q = q.eq("category_id", sp.category);
  if (sp.method) q = q.eq("method", sp.method);
  const [{ data: rows }, { data: cats }, { data: methods }] = await Promise.all([
    q,
    supabase.from("expense_categories").select("id, name").eq("tenant_id", tenant.id).eq("is_active", true).order("name"),
    supabase.from("payment_methods").select("name").eq("tenant_id", tenant.id).eq("is_active", true).order("name"),
  ]);
  const total = (rows ?? []).filter((r: any) => !r.voided_at).reduce((s, r: any) => s + Number(r.amount), 0);

  return (
    <>
      <PageHeader title={t.expenses.title} actions={<ButtonLink variant="secondary" href={`/t/${slug}/export/expenses?from=${from}&to=${to}`}>{t.common.export}</ButtonLink>} />
      <Flash sp={sp} />
      <form className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Input type="date" name="from" defaultValue={from} />
        <Input type="date" name="to" defaultValue={to} />
        <Select name="category" defaultValue={sp.category ?? ""}><option value="">{t.expenses.category}: {t.common.all}</option>{(cats ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select name="method" defaultValue={sp.method ?? ""}><option value="">{t.common.method}: {t.common.all}</option>{(methods ?? []).map((m: any) => <option key={m.name}>{m.name}</option>)}</Select>
        <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">{t.common.filter}</button>
      </form>
      <div className="mb-6 max-w-xs"><Stat label={t.common.total} value={money(total, locale)} /></div>
      <Card>
        <Table head={[t.common.date, t.expenses.category, t.expenses.beneficiary, t.common.method, t.common.reference, t.common.amount, ""]} empty={!rows?.length && t.common.empty}>
          {(rows ?? []).map((r: any) => (
            <tr key={r.id} className={r.voided_at ? "opacity-60" : ""}>
              <Td>{date(r.spent_on, locale)}</Td>
              <Td>{r.expense_categories?.name}</Td>
              <Td>{r.beneficiary}<div className="text-xs text-slate-500">{r.description}</div></Td>
              <Td>{r.method}</Td>
              <Td>{r.reference ?? "—"}</Td>
              <Td className="tabular-nums font-medium">{money(r.amount, locale)}</Td>
              <Td>
                {r.voided_at ? <span title={r.void_reason}><Badge tone="red">{t.status.voided}</Badge></span> : (
                  <form action={voidExpense.bind(null, slug, r.id)} className="flex gap-1">
                    <Input name="reason" placeholder={t.common.reason} required minLength={3} className="w-32" />
                    <Submit small variant="ghost" confirm={t.payments.void + " ?"}>{t.payments.void}</Submit>
                  </form>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title={t.expenses.new} className="lg:col-span-2">
          <form action={addExpense.bind(null, slug)} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t.expenses.category}><Select name="category_id" required>{(cats ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label={t.common.amount}><Input name="amount" type="number" step="0.01" min="0.01" required /></Field>
            <Field label={t.common.date}><Input name="spent_on" type="date" defaultValue={today()} required /></Field>
            <Field label={t.expenses.beneficiary}><Input name="beneficiary" required /></Field>
            <Field label={t.common.method}><Select name="method">{(methods ?? []).map((m: any) => <option key={m.name}>{m.name}</option>)}</Select></Field>
            <Field label={t.common.reference}><Input name="reference" /></Field>
            <Field label={t.common.description} className="sm:col-span-2"><Input name="description" /></Field>
            <div className="flex items-end"><Submit>{t.common.add}</Submit></div>
          </form>
        </Card>
        <Card title={t.expenses.categories}>
          <ul className="mb-3 flex flex-wrap gap-1">{(cats ?? []).map((c: any) => <li key={c.id}><Badge>{c.name}</Badge></li>)}</ul>
          <form action={addCategory.bind(null, slug)} className="flex gap-2"><Input name="name" required /><Submit variant="secondary">{t.common.add}</Submit></form>
        </Card>
      </div>
    </>
  );
}
