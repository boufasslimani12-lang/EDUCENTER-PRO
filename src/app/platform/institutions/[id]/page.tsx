import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { date, money } from "@/lib/format";
import { PageHeader, Card, Flash, Badge, statusTone, Stat, Grid, Input, Field, Table, Td, ButtonLink } from "@/components/ui";
import { Submit } from "@/components/client";
import { updateLifecycle } from "../../actions";

export default async function Institution({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: x } = await supabase.from("tenants").select("*, tenant_effective_status").eq("id", id).maybeSingle();
  if (!x) notFound();
  const [{ data: invites }, { data: pays }, { data: grants }, { data: audit }] = await Promise.all([
    supabase.from("invitations").select("email, role, accepted_at, created_at").eq("tenant_id", id).eq("role", "admin"),
    supabase.from("subscription_payments").select("*").eq("tenant_id", id).order("created_at", { ascending: false }),
    supabase.from("support_access_grants").select("*").eq("tenant_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("audit_log").select("table_name, action, created_at").eq("tenant_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const s = x.tenant_effective_status as keyof typeof t.status;
  return (
    <>
      <PageHeader title={x.name} subtitle={<span dir="ltr">/{x.slug} · {t.types[x.type as keyof typeof t.types]}</span>} actions={<ButtonLink variant="secondary" href="/platform/institutions">{t.common.back}</ButtonLink>} />
      <Flash sp={sp} />
      <Grid cols={3}>
        <Stat label={t.common.status} value={<Badge tone={statusTone(s)}>{t.status[s]}</Badge>} />
        <Stat label={t.billing.trialEnd} value={date(x.trial_ends_at, locale)} />
        <Stat label={t.billing.periodEnd} value={date(x.current_period_end, locale)} hint={`grace: ${x.grace_days} j`} />
      </Grid>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={t.common.actions}>
          <div className="flex flex-wrap gap-2">
            <form action={updateLifecycle.bind(null, id, "extend")}><Submit variant="secondary">{t.platform.extendTrial}</Submit></form>
            <form action={updateLifecycle.bind(null, id, "reactivate")}><Submit variant="secondary">{t.platform.reactivate}</Submit></form>
            <form action={updateLifecycle.bind(null, id, "suspend")}><Submit variant="danger" confirm={t.platform.suspend + " ?"}>{t.platform.suspend}</Submit></form>
            <form action={updateLifecycle.bind(null, id, "archive")}><Submit variant="ghost" confirm={t.platform.archive + " ?"}>{t.platform.archive}</Submit></form>
          </div>
          <form action={updateLifecycle.bind(null, id, "period")} className="mt-4 grid grid-cols-[1fr_100px_auto] items-end gap-2">
            <Field label={t.platform.setPeriod}><Input type="date" name="period_end" required defaultValue={x.current_period_end?.slice(0, 10)} /></Field>
            <Field label="Grace (j)"><Input type="number" name="grace_days" min="0" max="60" defaultValue={x.grace_days} /></Field>
            <Submit>{t.common.save}</Submit>
          </form>
        </Card>
        <Card title={t.platform.adminEmail}>
          <ul className="space-y-1 text-sm">
            {(invites ?? []).map((i: any) => (
              <li key={i.email} className="flex justify-between"><span dir="ltr">{i.email}</span>{i.accepted_at ? <Badge tone="green">{t.status.approved}</Badge> : <Badge tone="amber">{t.status.pending}</Badge>}</li>
            ))}
          </ul>
          <div className="mt-4 text-xs text-slate-500">{t.settings.support}: {(grants ?? []).filter((g: any) => !g.revoked_at && new Date(g.expires_at) > new Date()).length > 0 ? <Badge tone="amber">{t.common.active}</Badge> : t.common.none}</div>
        </Card>
        <Card title={t.nav.subscriptions}>
          <Table head={[t.common.date, t.common.amount, t.billing.months, t.common.status]} empty={!pays?.length && t.common.empty}>
            {(pays ?? []).map((p: any) => <tr key={p.id}><Td>{date(p.created_at, locale)}</Td><Td>{money(p.amount, locale)}</Td><Td>{p.period_months}</Td><Td><Badge tone={statusTone(p.status)}>{t.status[p.status as "pending"]}</Badge></Td></tr>)}
          </Table>
        </Card>
        <Card title={t.nav.audit}>
          <ul className="space-y-1 text-xs text-slate-600">
            {(audit ?? []).map((a: any, i: number) => <li key={i}>{date(a.created_at, locale)} · {a.table_name} · {a.action}</li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}
