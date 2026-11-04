import { notFound } from "next/navigation";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { PageHeader, Card, Flash, Table, Td, Input, Field, Select, Badge, ButtonLink } from "@/components/ui";
import { Submit } from "@/components/client";
import * as A from "../actions";

export default async function TeacherPage({ params, searchParams }: Props<{ id: string }>) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t } = await getT();
  const lk = await lookups(supabase, tenant.id);
  const { data: x } = await supabase.from("teachers").select("*").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (!x) notFound();
  const [{ data: assigns }, { data: member }, { data: invite }] = await Promise.all([
    supabase.from("teacher_assignments").select("id, classes(name), groups(name), subjects(name)").eq("teacher_id", id),
    supabase.from("memberships").select("id, is_active").eq("teacher_id", id).maybeSingle(),
    supabase.from("invitations").select("id, email").eq("teacher_id", id).is("accepted_at", null).maybeSingle(),
  ]);
  return (
    <>
      <PageHeader title={x.full_name} actions={<ButtonLink variant="secondary" href={`/t/${slug}/teachers`}>{t.common.back}</ButtonLink>} />
      <Flash sp={sp} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title={t.common.details} className="lg:col-span-2">
          <form action={A.updateTeacher.bind(null, slug, id)} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t.auth.fullName}><Input name="full_name" required defaultValue={x.full_name} /></Field>
            <Field label={t.common.email}><Input name="email" type="email" dir="ltr" defaultValue={x.email ?? ""} /></Field>
            <Field label={t.common.phone}><Input name="phone" type="tel" dir="ltr" defaultValue={x.phone ?? ""} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={x.is_active} />{t.common.active}</label>
            <div className="sm:col-span-2 flex justify-end"><Submit>{t.common.save}</Submit></div>
          </form>
        </Card>
        <Card title={t.teachers.account}>
          {member?.is_active ? (
            <Badge tone="green">{t.teachers.linked}</Badge>
          ) : (
            <div className="space-y-3 text-sm">
              {invite ? <p><Badge tone="amber">{t.status.pending}</Badge> <span dir="ltr">{invite.email}</span></p> : <Badge>{t.teachers.notLinked}</Badge>}
              {x.email && <form action={A.inviteTeacher.bind(null, slug, id)}><Submit variant="secondary">{t.teachers.invite}</Submit></form>}
            </div>
          )}
        </Card>
      </div>
      <Card title={t.teachers.assignments} className="mt-6">
        <Table head={[t.teachers.target, t.common.subject, ""]} empty={!assigns?.length && t.common.empty}>
          {(assigns ?? []).map((a: any) => (
            <tr key={a.id}>
              <Td>{a.classes ? `${t.common.class}: ${a.classes.name}` : `${t.common.group}: ${a.groups?.name}`}</Td>
              <Td>{a.subjects?.name ?? "—"}</Td>
              <Td><form action={A.removeAssignment.bind(null, slug, id, a.id)}><Submit small variant="ghost" confirm={t.common.delete + " ?"}>{t.common.delete}</Submit></form></Td>
            </tr>
          ))}
        </Table>
        <form action={A.addAssignment.bind(null, slug, id)} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Select name="target" required>
            <optgroup label={t.structure.classes}>{lk.activeClasses.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>
            <optgroup label={t.nav.groups}>{lk.activeGroups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}</optgroup>
          </Select>
          <Select name="subject_id"><option value="">{t.common.subject}: —</option>{lk.subjects.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Submit>{t.teachers.assign}</Submit>
        </form>
      </Card>
    </>
  );
}
