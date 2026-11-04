import Link from "next/link";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { PageHeader, Card, Flash, Table, Td, Input, Field, Badge } from "@/components/ui";
import { Submit } from "@/components/client";
import { addTeacher } from "./actions";

export default async function TeachersPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t } = await getT();
  const [{ data: teachers }, { data: members }, { data: invites }, { data: assigns }] = await Promise.all([
    supabase.from("teachers").select("*").eq("tenant_id", tenant.id).order("full_name"),
    supabase.from("memberships").select("teacher_id, is_active").eq("tenant_id", tenant.id).eq("role", "teacher"),
    supabase.from("invitations").select("teacher_id").eq("tenant_id", tenant.id).is("accepted_at", null),
    supabase.from("teacher_assignments").select("teacher_id, classes(name), groups(name)").eq("tenant_id", tenant.id),
  ]);
  return (
    <>
      <PageHeader title={t.teachers.title} />
      <Flash sp={sp} />
      <Card>
        <Table head={[t.common.name, t.common.email, t.common.phone, t.teachers.assignments, t.teachers.account, t.common.status]} empty={!teachers?.length && t.common.empty}>
          {(teachers ?? []).map((x: any) => {
            const linked = (members ?? []).some((m: any) => m.teacher_id === x.id && m.is_active);
            const invited = (invites ?? []).some((i: any) => i.teacher_id === x.id);
            const as = (assigns ?? []).filter((a: any) => a.teacher_id === x.id).map((a: any) => a.classes?.name ?? a.groups?.name);
            return (
              <tr key={x.id}>
                <Td><Link className="font-medium text-brand-700 hover:underline" href={`/t/${slug}/teachers/${x.id}`}>{x.full_name}</Link></Td>
                <Td dir="ltr">{x.email ?? "—"}</Td>
                <Td dir="ltr">{x.phone ?? "—"}</Td>
                <Td className="max-w-xs truncate">{Array.from(new Set(as)).join(", ") || "—"}</Td>
                <Td>{linked ? <Badge tone="green">{t.teachers.linked}</Badge> : invited ? <Badge tone="amber">{t.status.pending}</Badge> : <Badge>{t.teachers.notLinked}</Badge>}</Td>
                <Td><Badge tone={x.is_active ? "green" : "gray"}>{x.is_active ? t.common.active : t.common.inactive}</Badge></Td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <Card title={t.teachers.new} className="mt-6">
        <form action={addTeacher.bind(null, slug)} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label={t.auth.fullName}><Input name="full_name" required /></Field>
          <Field label={t.common.email}><Input name="email" type="email" dir="ltr" /></Field>
          <Field label={t.common.phone}><Input name="phone" type="tel" dir="ltr" /></Field>
          <div className="flex items-end"><Submit>{t.common.add}</Submit></div>
        </form>
      </Card>
    </>
  );
}
