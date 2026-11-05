import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { Card, Flash, Badge, Avatar, EmptyState, Select, Field, PageHeader } from "@/components/ui";
import { Submit } from "@/components/client";
import { Icon } from "@/components/icons";
import { CapacityBar } from "@/components/capacity-bar";
import { WeekGrid } from "@/components/week-grid";
import { assignToTarget, removeAssignment } from "../../../teachers/actions";

export default async function ClassPage({ params, searchParams }: Props<{ id: string }>) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t } = await getT();
  const b = `/t/${slug}`;
  const here = `${b}/structure/classes/${id}`;

  const { data: c, error } = await supabase.from("classes").select("*, levels(name), academic_years(name, is_active)").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) notFound();
  const [enr, assigns, tt, lk] = await Promise.all([
    supabase.from("enrollments").select("id, students(id, first_name, last_name, code, archived_at), student_groups(groups(name))").eq("class_id", id).eq("status", "active"),
    supabase.from("teacher_assignments").select("id, teacher_id, teachers(full_name), subjects(name)").eq("class_id", id),
    supabase.from("timetable_entries").select("id, weekday, starts_at, ends_at, room, subjects(name), teachers(full_name)").eq("class_id", id),
    lookups(supabase, tenant.id),
  ]);
  for (const r of [enr, assigns, tt]) if (r.error) throw new Error(r.error.message);
  const students = ((enr.data ?? []) as any[]).filter((e) => e.students && !e.students.archived_at)
    .sort((a, b) => `${a.students.last_name}${a.students.first_name}`.localeCompare(`${b.students.last_name}${b.students.first_name}`));
  const entries = (tt.data ?? []) as any[];

  return (
    <>
      <Link href={`${b}/structure?tab=classes&year=${c.academic_year_id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <Icon name="chevronLeft" className="h-4 w-4 rtl:rotate-180" />{t.structure.classes}
      </Link>
      <PageHeader title={c.name} subtitle={[c.levels?.name, c.academic_years?.name].filter(Boolean).join(" · ")} actions={<CapacityBar n={students.length} cap={c.capacity} t={t} />} />
      <Flash sp={sp} dismissLabel={t.common.dismiss} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title={t.structure.classStudents} description={`${students.length} ${t.common.results}`} className="xl:col-span-2" bodyClassName="p-0">
          {students.length ? (
            <ul className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
              {students.map((e) => (
                <li key={e.id} className="border-slate-100 sm:border-b">
                  <Link href={`${b}/students/${e.students.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
                    <Avatar name={`${e.students.last_name} ${e.students.first_name}`} size="sm" />
                    <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{e.students.last_name} {e.students.first_name}</span><span className="block truncate text-xs text-slate-500">{(e.student_groups ?? []).map((g: any) => g.groups?.name).join(", ") || e.students.code || "—"}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <div className="p-5"><EmptyState icon="students" title={t.common.empty} /></div>}
        </Card>
        <Card title={t.structure.classTeachers}>
          <ul className="mb-4 space-y-2">
            {((assigns.data ?? []) as any[]).map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <Link href={`${b}/teachers/${a.teacher_id}`} className="min-w-0 flex-1 truncate font-medium text-slate-800 hover:text-brand-700">{a.teachers?.full_name}</Link>
                {a.subjects?.name && <Badge tone="blue">{a.subjects.name}</Badge>}
                <form action={removeAssignment.bind(null, slug, a.teacher_id, a.id)}><input type="hidden" name="back" value={here} /><Submit small variant="ghost" icon="x" confirm={t.teachers.removeAssignmentConfirm}><span className="sr-only">{t.common.delete}</span></Submit></form>
              </li>
            ))}
            {!(assigns.data ?? []).length && <li className="text-sm text-slate-500">{t.groups.noTeachers}</li>}
          </ul>
          <AssignForm slug={slug} classId={id} here={here} teachers={lk.teachers.filter((x) => x.is_active)} subjects={lk.subjects.filter((s) => s.is_active)} t={t} />
        </Card>
      </div>
      <Card className="mt-6" title={t.structure.sessions} description={`${entries.length} ${t.timetable.sessionsCount}`}>
        {entries.length ? (
          <WeekGrid days={[1, 2, 3, 4, 5, 6]} dayNames={t.timetable.days} minutesLabel={t.timetable.minutes} emptyDay={t.timetable.noSessionsDay}
            sessions={entries.map((e) => ({ id: e.id, weekday: e.weekday, starts_at: e.starts_at, ends_at: e.ends_at, title: e.subjects?.name ?? "—", subtitle: e.teachers?.full_name, room: e.room, colorKey: e.subjects?.name ?? e.id }))} />
        ) : <EmptyState icon="calendar" title={t.timetable.noSessions} />}
      </Card>
    </>
  );
}

/** Assign a teacher to this class. */
function AssignForm({ slug, classId, here, teachers, subjects, t }: { slug: string; classId: string; here: string; teachers: any[]; subjects: any[]; t: any }) {
  return (
    <form action={assignToTarget.bind(null, slug, `c:${classId}`, here)} className="space-y-3 border-t border-slate-100 pt-4">
      <Field label={t.common.teacher} required><Select name="teacher_id" required defaultValue=""><option value="" disabled>—</option>{teachers.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</Select></Field>
      <Field label={t.common.subject}><Select name="subject_id" defaultValue=""><option value="">{t.common.none}</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Submit small icon="plus">{t.teachers.assign}</Submit>
    </form>
  );
}
