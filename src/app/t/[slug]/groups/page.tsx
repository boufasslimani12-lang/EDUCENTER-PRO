import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { PageHeader, Card, Flash, Table, Td, Input, Select, Field } from "@/components/ui";
import { Submit } from "@/components/client";
import * as A from "../structure/actions";

export default async function GroupsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t } = await getT();
  const lk = await lookups(supabase, tenant.id);
  const { data: members } = await supabase.from("student_groups").select("group_id, enrollments!inner(status)").eq("tenant_id", tenant.id).eq("enrollments.status", "active");
  const { data: assigns } = await supabase.from("teacher_assignments").select("group_id, teachers(full_name)").eq("tenant_id", tenant.id).not("group_id", "is", null);
  const count = (g: string) => (members ?? []).filter((m: any) => m.group_id === g).length;
  const teachersOf = (g: string) => (assigns ?? []).filter((a: any) => a.group_id === g).map((a: any) => a.teachers?.full_name);

  return (
    <>
      <PageHeader title={t.nav.groups} subtitle={lk.activeYear?.name} />
      <Flash sp={sp} />
      <Card>
        <Table head={[t.common.name, t.common.subject, t.common.level, t.common.teacher, t.structure.studentsCount, t.structure.groupFee, ""]} empty={!lk.activeGroups.length && t.common.empty}>
          {lk.activeGroups.map((g) => (
            <tr key={g.id}>
              <Td className="font-medium">{g.name}</Td>
              <Td>{lk.subjects.find((s) => s.id === g.subject_id)?.name ?? "—"}</Td>
              <Td>{lk.levels.find((l) => l.id === g.level_id)?.name ?? "—"}</Td>
              <Td className="max-w-[12rem] truncate">{Array.from(new Set(teachersOf(g.id))).join(", ") || "—"}</Td>
              <Td className="tabular-nums">{count(g.id)}</Td>
              <Td>
                <form action={A.updateGroupFee.bind(null, slug, g.id)} className="flex items-center gap-1">
                  <input type="hidden" name="name" value={g.name} />
                  <Input name="monthly_fee" type="number" step="0.01" min="0" defaultValue={g.monthly_fee ?? ""} className="w-28" />
                  <Submit small variant="secondary">{t.common.save}</Submit>
                </form>
              </Td>
              <Td><form action={A.deleteGroup.bind(null, slug, g.id)}><Submit small variant="ghost" confirm={t.common.delete + " ?"}>{t.common.delete}</Submit></form></Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title={t.common.add} className="mt-6">
        <form action={A.addGroup.bind(null, slug)} className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label={t.common.name}><Input name="name" required /></Field>
          <Field label={t.common.subject}><Select name="subject_id"><option value="">—</option>{lk.subjects.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label={t.common.level}><Select name="level_id"><option value="">—</option>{lk.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
          <Field label={t.common.academicYear}><Select name="academic_year_id" defaultValue={lk.activeYear?.id}>{lk.years.filter((y) => !y.archived_at).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</Select></Field>
          <Field label={t.structure.groupFee}><Input name="monthly_fee" type="number" step="0.01" min="0" /></Field>
          <div className="flex items-end"><Submit>{t.common.add}</Submit></div>
        </form>
      </Card>
    </>
  );
}
