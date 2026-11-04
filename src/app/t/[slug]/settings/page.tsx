import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { date } from "@/lib/format";
import { PageHeader, Card, Flash, Input, Select, Field, Table, Td, Badge, Grid } from "@/components/ui";
import { Submit } from "@/components/client";
import * as A from "./actions";
import { MODULES } from "@/lib/modules";

export default async function SettingsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant, user } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const [{ data: methods }, { data: reqs }, { data: grants }, { data: members }] = await Promise.all([
    supabase.from("payment_methods").select("*").eq("tenant_id", tenant.id).order("name"),
    supabase.from("document_requirements").select("*").eq("tenant_id", tenant.id).order("name"),
    supabase.from("support_access_grants").select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("memberships").select("id, user_id, role, is_active, teachers(full_name)").eq("tenant_id", tenant.id),
  ]);
  const mods = tenant.modules ?? {};
  const named = (table: "payment_methods" | "document_requirements", rows: any[] | null, title: string) => (
    <Card title={title}>
      <ul className="mb-3 space-y-1">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="flex items-center justify-between text-sm">
            <span className={r.is_active ? "" : "text-slate-400 line-through"}>{r.name}</span>
            <form action={A.toggleNamed.bind(null, slug, table, r.id, !r.is_active)}><Submit small variant="ghost">{r.is_active ? t.common.archive : t.common.restore}</Submit></form>
          </li>
        ))}
      </ul>
      <form action={A.addNamed.bind(null, slug, table)} className="flex gap-2"><Input name="name" required /><Submit variant="secondary">{t.common.add}</Submit></form>
    </Card>
  );
  const activeGrant = (grants ?? []).find((g: any) => !g.revoked_at && new Date(g.expires_at) > new Date());

  return (
    <>
      <PageHeader title={t.settings.title} />
      <Flash sp={sp} />
      <form action={A.saveInstitution.bind(null, slug)}>
        <Card title={t.settings.institution} actions={<Submit>{t.common.save}</Submit>}>
          <Grid cols={3}>
            <Field label={t.common.name}><Input name="name" required defaultValue={tenant.name} /></Field>
            <Field label={t.common.email}><Input name="email" type="email" dir="ltr" defaultValue={tenant.email ?? ""} /></Field>
            <Field label={t.common.phone}><Input name="phone" dir="ltr" defaultValue={tenant.phone ?? ""} /></Field>
            <Field label={t.common.address}><Input name="address" defaultValue={tenant.address ?? ""} /></Field>
            <Field label={t.common.city}><Input name="city" defaultValue={tenant.city ?? ""} /></Field>
            <Field label="Logo (URL)"><Input name="logo_url" type="url" dir="ltr" defaultValue={tenant.logo_url ?? ""} /></Field>
            <Field label={t.settings.defaultFee}><Input name="default_monthly_fee" type="number" step="0.01" min="0" defaultValue={tenant.default_monthly_fee} /></Field>
            <Field label={t.common.language}><Select name="default_locale" defaultValue={tenant.default_locale}><option value="fr">Français</option><option value="ar">العربية</option></Select></Field>
          </Grid>
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-medium">{t.settings.modules}</legend>
            <div className="flex flex-wrap gap-3">
              {MODULES.map((m) => (
                <label key={m} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                  <input type="checkbox" name={`mod_${m}`} defaultChecked={mods[m] !== false} />
                  {({ timetable: t.nav.timetable, attendance: t.nav.attendance, grades: t.nav.grades, payments: t.nav.payments, remuneration: t.nav.remuneration, expenses: t.nav.expenses, documents: t.settings.documents } as Record<string, string>)[m]}
                </label>
              ))}
            </div>
          </fieldset>
        </Card>
      </form>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {named("payment_methods", methods, t.settings.paymentMethods)}
        {named("document_requirements", reqs, t.settings.documents)}
        <Card title={t.settings.users}>
          <Table head={[t.common.name, "Role", t.common.status, ""]}>
            {(members ?? []).map((m: any) => (
              <tr key={m.id}>
                <Td>{m.teachers?.full_name ?? (m.user_id === user.id ? user.email : m.user_id.slice(0, 8))}</Td>
                <Td>{m.role === "admin" ? "Administration" : t.common.teacher}</Td>
                <Td><Badge tone={m.is_active ? "green" : "gray"}>{m.is_active ? t.common.active : t.common.inactive}</Badge></Td>
                <Td>{m.user_id !== user.id && <form action={A.toggleMember.bind(null, slug, m.id, !m.is_active)}><Submit small variant="ghost">{m.is_active ? t.common.archive : t.common.restore}</Submit></form>}</Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title={t.settings.support}>
          <p className="mb-3 text-sm text-slate-600">{t.settings.supportHelp}</p>
          {activeGrant ? (
            <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3 text-sm">
              <span>{activeGrant.reason} — {t.common.to} {date(activeGrant.expires_at, locale)}</span>
              <form action={A.revokeSupport.bind(null, slug, activeGrant.id)}><Submit small variant="danger">{t.settings.revoke}</Submit></form>
            </div>
          ) : (
            <form action={A.grantSupport.bind(null, slug)} className="flex gap-2">
              <Input name="reason" placeholder={t.common.reason} required minLength={5} />
              <Submit variant="secondary">{t.settings.grant}</Submit>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
