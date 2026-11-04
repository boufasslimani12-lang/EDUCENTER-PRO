import { requireAdminAny, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { money, date } from "@/lib/format";
import { PageHeader, Card, Flash, Input, Select, Field, Table, Td, Badge, statusTone, Stat, Grid } from "@/components/ui";
import { Submit } from "@/components/client";
import { declarePayment } from "../settings/actions";

export default async function BillingPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdminAny(slug);
  const { t, locale } = await getT();
  const { data: history } = await supabase.from("subscription_payments").select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false });
  const s = tenant.tenant_effective_status;
  return (
    <>
      <PageHeader title={t.billing.title} />
      <Flash sp={sp} />
      <Grid cols={3}>
        <Stat label={t.billing.current} value={<Badge tone={statusTone(s)}>{t.status[s]}</Badge>} />
        <Stat label={t.billing.trialEnd} value={date(tenant.trial_ends_at, locale)} />
        <Stat label={t.billing.periodEnd} value={date(tenant.current_period_end, locale)} hint={`+${tenant.grace_days} j`} />
      </Grid>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={`${t.billing.pay} — ${t.billing.bankTransfer}`}>
          <form action={declarePayment.bind(null, slug)} className="space-y-3">
            <Grid cols={2}>
              <Field label={t.billing.months}><Select name="period_months"><option value="1">{t.billing.monthly}</option><option value="12">{t.billing.annual}</option></Select></Field>
              <Field label={t.common.amount + " (MAD)"}><Input name="amount" type="number" step="0.01" min="1" required /></Field>
              <Field label={t.common.reference}><Input name="reference" /></Field>
              <Field label={t.billing.proof}><Input name="proof" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required /></Field>
            </Grid>
            <Submit>{t.billing.pay}</Submit>
          </form>
        </Card>
        <Card title={t.billing.card}><p className="text-sm text-slate-600">{t.billing.cardSoon}</p></Card>
      </div>
      <Card title={t.billing.history} className="mt-6">
        <Table head={[t.common.date, t.common.amount, t.billing.months, t.common.method, t.common.reference, t.common.status]} empty={!history?.length && t.common.empty}>
          {(history ?? []).map((h: any) => (
            <tr key={h.id}>
              <Td>{date(h.created_at, locale)}</Td>
              <Td className="tabular-nums">{money(h.amount, locale)}</Td>
              <Td>{h.period_months}</Td>
              <Td>{h.method === "card" ? t.billing.card : t.billing.bankTransfer}</Td>
              <Td>{h.reference ?? "—"}</Td>
              <Td><Badge tone={statusTone(h.status)}>{t.status[h.status as "pending"]}</Badge>{h.review_note && <div className="text-xs text-slate-500">{h.review_note}</div>}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
