import { requireOperational, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { PageHeader, Card, Flash, Input, Field, Select } from "@/components/ui";
import { Submit, AutoSubmitSelect } from "@/components/client";
import { addEntry, deleteEntry } from "./actions";

export default async function TimetablePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant, role, teacherId } = await requireOperational(slug);
  const { t } = await getT();
  const isAdmin = role === "admin";
  const lk = isAdmin ? await lookups(supabase, tenant.id) : null;

  let q = supabase.from("timetable_entries")
    .select("id, weekday, starts_at, ends_at, class_id, group_id, teacher_id, classes(name), groups(name), subjects(name), teachers(full_name), academic_years!inner(is_active)")
    .eq("tenant_id", tenant.id).eq("academic_years.is_active", true).order("starts_at");
  const f = sp.f ?? "";
  if (!isAdmin) q = q.eq("teacher_id", teacherId ?? "00000000-0000-0000-0000-000000000000");
  else if (f.startsWith("c:")) q = q.eq("class_id", f.slice(2));
  else if (f.startsWith("g:")) q = q.eq("group_id", f.slice(2));
  else if (f.startsWith("t:")) q = q.eq("teacher_id", f.slice(2));
  const { data } = await q;
  const entries = (data ?? []) as any[];
  const back = f ? `?f=${encodeURIComponent(f)}` : "";
  const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => d <= 6 || entries.some((e) => e.weekday === 7));

  return (
    <>
      <PageHeader title={t.timetable.title} />
      <Flash sp={sp} />
      {isAdmin && lk && (
        <form className="mb-4 max-w-sm">
          <AutoSubmitSelect name="f" defaultValue={f}>
            <option value="">{t.common.all}</option>
            <optgroup label={t.structure.classes}>{lk.activeClasses.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>
            <optgroup label={t.nav.groups}>{lk.activeGroups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}</optgroup>
            <optgroup label={t.nav.teachers}>{lk.teachers.map((x) => <option key={x.id} value={`t:${x.id}`}>{x.full_name}</option>)}</optgroup>
          </AutoSubmitSelect>
        </form>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {days.map((d) => (
          <Card key={d} title={t.timetable.days[d - 1]}>
            <ul className="space-y-2">
              {entries.filter((e) => e.weekday === d).map((e) => (
                <li key={e.id} className="rounded-lg border-s-4 border-brand-500 bg-brand-50/60 p-2 text-xs">
                  <div className="font-semibold tabular-nums">{e.starts_at.slice(0, 5)}–{e.ends_at.slice(0, 5)}</div>
                  <div className="font-medium text-slate-800">{e.subjects?.name}</div>
                  <div className="text-slate-600">{e.classes?.name ?? e.groups?.name}</div>
                  {isAdmin && <div className="text-slate-500">{e.teachers?.full_name}</div>}
                  {isAdmin && (
                    <form action={deleteEntry.bind(null, slug, back, e.id)} className="mt-1">
                      <Submit small variant="ghost" confirm={t.common.delete + " ?"}>{t.common.delete}</Submit>
                    </form>
                  )}
                </li>
              ))}
              {!entries.some((e) => e.weekday === d) && <li className="text-xs text-slate-400">—</li>}
            </ul>
          </Card>
        ))}
      </div>
      {isAdmin && lk && (
        <Card title={t.timetable.newEntry} className="mt-6">
          <form action={addEntry.bind(null, slug, back)} className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <Field label={t.teachers.target}>
              <Select name="target" required defaultValue={f.startsWith("t:") ? undefined : f}>
                <optgroup label={t.structure.classes}>{lk.activeClasses.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>
                <optgroup label={t.nav.groups}>{lk.activeGroups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}</optgroup>
              </Select>
            </Field>
            <Field label={t.common.subject}><Select name="subject_id" required>{lk.subjects.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
            <Field label={t.common.teacher}><Select name="teacher_id" required defaultValue={f.startsWith("t:") ? f.slice(2) : undefined}>{lk.teachers.filter((x) => x.is_active).map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</Select></Field>
            <Field label={t.timetable.weekday}><Select name="weekday">{t.timetable.days.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}</Select></Field>
            <Field label={t.timetable.start}><Input name="starts_at" type="time" required /></Field>
            <Field label={t.timetable.end}><Input name="ends_at" type="time" required /></Field>
            <div className="flex items-end"><Submit>{t.common.add}</Submit></div>
          </form>
        </Card>
      )}
    </>
  );
}
