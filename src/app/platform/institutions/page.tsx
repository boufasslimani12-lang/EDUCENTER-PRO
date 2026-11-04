import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { date } from "@/lib/format";
import { PageHeader, Card, Flash, Table, Td, Badge, statusTone, Field, Input, Select } from "@/components/ui";
import { Submit } from "@/components/client";
import { createInstitution } from "../actions";

export default async function Institutions({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data } = await supabase.from("tenants").select("id, name, slug, type, trial_ends_at, current_period_end, created_at, tenant_effective_status").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title={t.nav.institutions} />
      <Flash sp={sp} />
      <Card title={t.platform.newInstitution}>
        <form action={createInstitution} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t.common.name}><Input name="name" required minLength={2} /></Field>
          <Field label={t.platform.slug} hint="a-z, 0-9, -"><Input name="slug" required pattern="[a-z0-9][a-z0-9\-]{2,39}" dir="ltr" /></Field>
          <Field label="Type">
            <Select name="type">{Object.entries(t.types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          </Field>
          <Field label={t.platform.adminEmail}><Input name="admin_email" type="email" required dir="ltr" /></Field>
          <Field label={t.platform.trialDays}><Input name="trial_days" type="number" min="0" max="60" defaultValue={7} /></Field>
          <Field label={t.common.language}><Select name="locale"><option value="fr">Français</option><option value="ar">العربية</option></Select></Field>
          <div className="sm:col-span-3"><Submit>{t.common.create}</Submit></div>
        </form>
      </Card>
      <Card className="mt-6">
        <Table head={[t.common.name, t.platform.slug, "Type", t.common.status, t.billing.trialEnd, t.billing.periodEnd]} empty={!data?.length && t.common.empty}>
          {(data ?? []).map((x: any) => (
            <tr key={x.id}>
              <Td><Link className="font-medium text-brand-700 hover:underline" href={`/platform/institutions/${x.id}`}>{x.name}</Link></Td>
              <Td dir="ltr" className="text-slate-500">{x.slug}</Td>
              <Td>{t.types[x.type as keyof typeof t.types]}</Td>
              <Td><Badge tone={statusTone(x.tenant_effective_status)}>{t.status[x.tenant_effective_status as "trial_active"]}</Badge></Td>
              <Td>{date(x.trial_ends_at, locale)}</Td>
              <Td>{date(x.current_period_end, locale)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
