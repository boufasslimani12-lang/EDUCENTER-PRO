import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { money, date, today, firstOfMonth } from "@/lib/format";
import { PageHeader, Card, Flash, Input, Select, Field, Table, Td, Badge, ButtonLink, Stat, Grid } from "@/components/ui";
import { Submit } from "@/components/client";
import { addMovement } from "../expenses/actions";

export default async function CashPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const from = sp.from ?? firstOfMonth();
  const to = sp.to ?? today();
  let q = supabase.from("cash_movements").select("*").eq("tenant_id", tenant.id).gte("occurred_on", from).lte("occurred_on", to).order("occurred_on", { ascending: false }).order("created_at", { ascending: false });
  if (sp.method) q = q.eq("method", sp.method);
  const [{ data: rows }, { data: all }, { data: methods }] = await Promise.all([
    q,
    supabase.from("cash_movements").select("direction, amount").eq("tenant_id", tenant.id),
    supabase.from("payment_methods").select("name").eq("tenant_id", tenant.id).eq("is_active", true).order("name"),
  ]);
  const list = (rows ?? []) as any[];
  const tin = list.filter((r) => r.direction === "in").reduce((s, r) => s + Number(r.amount), 0);
  const tout = list.filter((r) => r.direction === "out").reduce((s, r) => s + Number(r.amount), 0);
  const balance = (all ?? []).reduce((s, r: any) => s + (r.direction === "in" ? 1 : -1) * Number(r.amount), 0);

  return (
    <>
      <PageHeader title={t.cash.title} actions={<ButtonLink variant="secondary" href={`/t/${slug}/export/cash?from=${from}&to=${to}`}>{t.common.export}</ButtonLink>} />
      <Flash sp={sp} />
      <form className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input type="date" name="from" defaultValue={from} />
        <Input type="date" name="to" defaultValue={to} />
        <Select name="method" defaultValue={sp.method ?? ""}><option value="">{t.common.method}: {t.common.all}</option>{(methods ?? []).map((m: any) => <option key={m.name}>{m.name}</option>)}</Select>
        <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">{t.common.filter}</button>
      </form>
      <Grid cols={4}>
        <Stat label={t.cash.totalIn} value={money(tin, locale)} tone="good" />
        <Stat label={t.cash.totalOut} value={money(tout, locale)} tone="bad" />
        <Stat label={t.common.total} value={money(tin - tout, locale)} />
        <Stat label={t.cash.balance} value={money(balance, locale)} />
      </Grid>
      <Card className="mt-6">
        <Table head={[t.common.date, t.cash.direction, t.common.description, t.common.method, t.common.amount]} empty={!list.length && t.common.empty}>
          {list.map((r) => (
            <tr key={r.id}>
              <Td>{date(r.occurred_on, locale)}</Td>
              <Td><Badge tone={r.direction === "in" ? "green" : "red"}>{r.direction === "in" ? t.cash.inflow : t.cash.outflow}</Badge></Td>
              <Td>{r.description}</Td>
              <Td>{r.method}</Td>
              <Td className={`tabular-nums font-medium ${r.direction === "in" ? "text-emerald-700" : "text-rose-700"}`}>{r.direction === "in" ? "+" : "−"} {money(r.amount, locale)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title={t.cash.newMovement} className="mt-6">
        <form action={addMovement.bind(null, slug)} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <Field label={t.cash.direction}><Select name="direction"><option value="in">{t.cash.inflow}</option><option value="out">{t.cash.outflow}</option></Select></Field>
          <Field label={t.common.amount}><Input name="amount" type="number" step="0.01" min="0.01" required /></Field>
          <Field label={t.common.method}><Select name="method">{(methods ?? []).map((m: any) => <option key={m.name}>{m.name}</option>)}</Select></Field>
          <Field label={t.common.date}><Input name="occurred_on" type="date" defaultValue={today()} /></Field>
          <Field label={t.common.description}><Input name="description" required /></Field>
          <div className="flex items-end"><Submit>{t.common.add}</Submit></div>
        </form>
      </Card>
    </>
  );
}
