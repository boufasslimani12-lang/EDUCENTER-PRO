import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { money } from "@/lib/format";
import { Card, Flash, Badge, Avatar, EmptyState, Select, Field, PageHeader } from "@/components/ui";
import { Submit, Dialog } from "@/components/client";
import { Icon } from "@/components/icons";
import { CapacityBar } from "@/components/capacity-bar";
import { WeekGrid } from "@/components/week-grid";
import { groupFormFields } from "@/components/group-fields";
import { addStudentToGroup, removeStudentFromGroup, updateGroup } from "../../structure/actions";
import { assignToTarget, removeAssignment } from "../../teachers/actions";

export default async function GroupPage({ params, searchParams }: Props<{ id: string }>) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const b = `/t/${slug}`;
  const here = `${b}/groups/${id}`;

  const { data: g, error } = await supabase.from("groups").select("*, subjects(name), levels(name), academic_years(name)").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!g) notFound();
  const [members, assigns, tt, enrolled, lk] = await Promise.all([
    supabase.from("student_groups").select("id, enrollment_id, enrollments!inner(status, classes(name), students(id, first_name, last_name, code, archived_at))").eq("group_id", id).eq("enrollments.status", "active"),
    supabase.from("teacher_assignments").select("id, teacher_id, teachers(full_name), subjects(name)").eq("group_id", id),
    supabase.from("timetable_entries").select("id, weekday, starts_at, ends_at, room, subjects(name), teachers(full_name)").eq("group_id", id),
    supabase.from("enrollments").select("id, students(first_name, last_name, archived_at), classes(name)").eq("tenant_id", tenant.id).eq("academic_year_id", g.academic_year_id).eq("status", "active"),
    lookups(supabase, tenant.id),
  ]);
  for (const r of [members, assigns, tt, enrolled]) if (r.error) throw new Error(r.error.message);
  const list = ((members.data ?? []) as any[]).filter((m) => m.enrollments?.students && !m.enrollments.students.archived_at)
    .sort((a, b) => `${a.enrollments.students.last_name}`.localeCompare(`${b.enrollments.students.last_name}`));
  const inGroup = new Set(list.map((m) => m.enrollment_id));
  const candidates = ((enrolled.data ?? []) as any[]).filter((e) => e.students && !e.students.archived_at && !inGroup.has(e.id))
    .sort((a, b) => `${a.students.last_name}${a.students.first_name}`.localeCompare(`${b.students.last_name}${b.students.first_name}`));
  const entries = (tt.data ?? []) as any[];
  const full = g.capacity ? list.length >= g.capacity : false;

  return (
    <>
      <Link href={`${b}/groups`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><Icon name="chevronLeft" className="h-4 w-4 rtl:rotate-180" />{t.groups.title}</Link>
      <PageHeader
        title={g.name}
        subtitle={[g.subjects?.name, g.levels?.name, g.academic_years?.name, g.monthly_fee ? `+${money(g.monthly_fee, locale, tenant.currency)}` : null].filter(Boolean).join(" · ")}
        actions={<>
          <CapacityBar n={list.length} cap={g.capacity} t={t} />
          <Dialog trigger={t.common.edit} icon="settings" title={t.groups.edit} description={g.name}>
            <form action={updateGroup.bind(null, slug, id)} className="space-y-4"><input type="hidden" name="back" value={here} />{groupFormFields(t, lk, g)}<div className="flex justify-end"><Submit icon="check">{t.common.save}</Submit></div></form>
          </Dialog>
        </>}
      />
      <Flash sp={sp} dismissLabel={t.common.dismiss} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title={t.groups.students} description={`${list.length} ${t.common.results}`} className="xl:col-span-2" bodyClassName="p-0"
          actions={!full && candidates.length > 0 && (
            <Dialog trigger={t.groups.addStudent} icon="plus" variant="primary" small title={t.groups.addStudent} description={t.groups.notEnrolledYet}>
              <form action={addStudentToGroup.bind(null, slug, id)} className="space-y-4">
                <Field label={t.common.student} required>
                  <Select name="enrollment_id" required defaultValue="">
                    <option value="" disabled>—</option>
                    {candidates.map((e) => <option key={e.id} value={e.id}>{e.students.last_name} {e.students.first_name}{e.classes?.name ? ` · ${e.classes.name}` : ""}</option>)}
                  </Select>
                </Field>
                <div className="flex justify-end"><Submit icon="plus">{t.common.add}</Submit></div>
              </form>
            </Dialog>
          )}>
          {list.length ? (
            <ul className="divide-y divide-slate-100">
              {list.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Link href={`${b}/students/${m.enrollments.students.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={`${m.enrollments.students.last_name} ${m.enrollments.students.first_name}`} size="sm" />
                    <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">{m.enrollments.students.last_name} {m.enrollments.students.first_name}</span><span className="block truncate text-xs text-slate-500">{m.enrollments.classes?.name ?? m.enrollments.students.code ?? "—"}</span></span>
                  </Link>
                  <form action={removeStudentFromGroup.bind(null, slug, id, m.id)}><Submit small variant="ghost" icon="x" confirm={t.groups.removeStudentConfirm}>{t.students.withdraw}</Submit></form>
                </li>
              ))}
            </ul>
          ) : <div className="p-5"><EmptyState icon="students" title={t.groups.noStudents} /></div>}
        </Card>
        <Card title={t.groups.teachers}>
          <ul className="mb-4 space-y-2">
            {((assigns.data ?? []) as any[]).map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <Link href={`${b}/teachers/${a.teacher_id}`} className="min-w-0 flex-1 truncate font-medium text-slate-800 hover:text-brand-700">{a.teachers?.full_name}</Link>
                {a.subjects?.name && <Badge tone="blue">{a.subjects.name}</Badge>}
                <form action={removeAssignment.bind(null, slug, a.teacher_id, a.id)}><input type="hidden" name="back" value={here} /><Submit small variant="ghost" icon="x" confirm={t.groups.removeTeacherConfirm}><span className="sr-only">{t.common.delete}</span></Submit></form>
              </li>
            ))}
            {!(assigns.data ?? []).length && <li className="text-sm text-slate-500">{t.groups.noTeachers}</li>}
          </ul>
          <form action={assignToTarget.bind(null, slug, `g:${id}`, here)} className="space-y-3 border-t border-slate-100 pt-4">
            <Field label={t.common.teacher} required><Select name="teacher_id" required defaultValue=""><option value="" disabled>—</option>{lk.teachers.filter((x) => x.is_active).map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</Select></Field>
            <Field label={t.common.subject}><Select name="subject_id" defaultValue={g.subject_id ?? ""}><option value="">{t.common.none}</option>{lk.subjects.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
            <Submit small icon="plus">{t.groups.assignTeacher}</Submit>
          </form>
        </Card>
      </div>
      <Card className="mt-6" title={t.groups.sessions} description={`${entries.length} ${t.timetable.sessionsCount}`}>
        {entries.length ? (
          <WeekGrid days={[1, 2, 3, 4, 5, 6]} dayNames={t.timetable.days} minutesLabel={t.timetable.minutes} emptyDay={t.timetable.noSessionsDay}
            sessions={entries.map((e) => ({ id: e.id, weekday: e.weekday, starts_at: e.starts_at, ends_at: e.ends_at, title: e.subjects?.name ?? "—", subtitle: e.teachers?.full_name, room: e.room, colorKey: e.subjects?.name ?? e.id }))} />
        ) : <EmptyState icon="calendar" title={t.timetable.noSessions} />}
      </Card>
      {full && <p className="mt-3 text-xs text-rose-700"><Badge tone="red">{t.structure.full}</Badge></p>}
    </>
  );
}
