import Link from "next/link";
import { requireOperational, type Props } from "@/lib/session";
import { getT, type Dictionary } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { PageHeader, Card, Flash, Input, Field, Select, EmptyState, buttonClass, cx } from "@/components/ui";
import { Submit, Dialog, AutoSubmitSelect } from "@/components/client";
import { WeekGrid, durationMin } from "@/components/week-grid";
import { addEntry, updateEntry, deleteEntry } from "./actions";

function EntryFields({ t, lk, e, defaults }: { t: Dictionary; lk: any; e?: any; defaults?: { target?: string; teacher?: string; weekday?: number } }) {
  const target = e ? (e.class_id ? `c:${e.class_id}` : `g:${e.group_id}`) : defaults?.target ?? "";
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={t.teachers.target} required className="sm:col-span-2">
        <Select name="target" required defaultValue={target}>
          <option value="" disabled>—</option>
          <optgroup label={t.structure.classes}>{lk.activeClasses.map((c: any) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>
          <optgroup label={t.nav.groups}>{lk.activeGroups.map((g: any) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}</optgroup>
        </Select>
      </Field>
      <Field label={t.common.subject} required><Select name="subject_id" required defaultValue={e?.subject_id ?? ""}><option value="" disabled>—</option>{lk.subjects.filter((s: any) => s.is_active || s.id === e?.subject_id).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label={t.common.teacher} required><Select name="teacher_id" required defaultValue={e?.teacher_id ?? defaults?.teacher ?? ""}><option value="" disabled>—</option>{lk.teachers.filter((x: any) => x.is_active || x.id === e?.teacher_id).map((x: any) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</Select></Field>
      <Field label={t.timetable.weekday} required><Select name="weekday" required defaultValue={String(e?.weekday ?? defaults?.weekday ?? 1)}>{t.timetable.days.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}</Select></Field>
      <Field label={t.timetable.room} hint={t.common.optional}><Input name="room" maxLength={60} defaultValue={e?.room ?? ""} /></Field>
      <Field label={t.timetable.start} required><Input name="starts_at" type="time" required step="300" defaultValue={e?.starts_at?.slice(0, 5)} /></Field>
      <Field label={t.timetable.end} required><Input name="ends_at" type="time" required step="300" defaultValue={e?.ends_at?.slice(0, 5)} /></Field>
    </div>
  );
}

export default async function TimetablePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant, role, teacherId } = await requireOperational(slug);
  const { t } = await getT();
  const isAdmin = role === "admin";
  const lk = await lookups(supabase, tenant.id);
  const b = `/t/${slug}/timetable`;

  const view = sp.view === "day" ? "day" : "week";
  const todayWd = ((new Date().getDay() + 6) % 7) + 1;
  const day = Math.min(7, Math.max(1, Number(sp.day) || todayWd));
  const teacher = isAdmin ? sp.teacher : teacherId ?? "00000000-0000-0000-0000-000000000000";
  let q = supabase.from("timetable_entries")
    .select("id, weekday, starts_at, ends_at, room, class_id, group_id, subject_id, teacher_id, classes(name), groups(name), subjects(name), teachers(full_name), academic_years!inner(is_active)")
    .eq("tenant_id", tenant.id).eq("academic_years.is_active", true).order("starts_at");
  if (teacher) q = q.eq("teacher_id", teacher);
  if (sp.scope?.startsWith("c:")) q = q.eq("class_id", sp.scope.slice(2));
  if (sp.scope?.startsWith("g:")) q = q.eq("group_id", sp.scope.slice(2));
  if (sp.subject) q = q.eq("subject_id", sp.subject);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const entries = (data ?? []) as any[];
  const editing = isAdmin && sp.edit ? entries.find((e) => e.id === sp.edit) ?? null : null;

  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !["ok", "error", "edit"].includes(k)) as [string, string][]);
  const back = qs.size ? `${b}?${qs}` : b;
  const withParam = (k: string, v?: string) => { const p = new URLSearchParams(qs); if (v) p.set(k, v); else p.delete(k); return p.size ? `${b}?${p}` : b; };
  const days = [1, 2, 3, 4, 5, 6, ...(entries.some((e) => e.weekday === 7) ? [7] : [])];
  const filtered = !!((isAdmin && sp.teacher) || sp.scope || sp.subject);
  const totalMin = entries.reduce((a, e) => a + durationMin(e), 0);
  const filterTarget = sp.scope?.match(/^[cg]:/) ? sp.scope : undefined;

  return (
    <>
      <PageHeader
        title={t.timetable.title}
        subtitle={`${lk.activeYear?.name ?? ""} · ${entries.length} ${t.timetable.sessionsCount} · ${Math.round((totalMin / 60) * 10) / 10} ${t.timetable.hours}`}
        actions={isAdmin && (
          <Dialog trigger={t.timetable.newEntry} icon="plus" variant="primary" title={t.timetable.newEntry}>
            <form action={addEntry.bind(null, slug, back)} className="space-y-4">
              <EntryFields t={t} lk={lk} defaults={{ target: filterTarget, teacher: sp.teacher, weekday: view === "day" ? day : undefined }} />
              <div className="flex justify-end"><Submit icon="check">{t.common.create}</Submit></div>
            </form>
          </Dialog>
        )}
      />
      <Flash sp={sp} dismissLabel={t.common.dismiss} />

      <form method="get" action={b} className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card sm:flex-row sm:flex-wrap sm:items-center">
        <input type="hidden" name="view" value={view} />
        {view === "day" && <input type="hidden" name="day" value={day} />}
        {isAdmin && (
          <div className="sm:w-52"><AutoSubmitSelect name="teacher" defaultValue={sp.teacher ?? ""} aria-label={t.common.teacher}><option value="">{t.timetable.allTeachers}</option>{lk.teachers.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</AutoSubmitSelect></div>
        )}
        <div className="sm:w-56">
          <AutoSubmitSelect name="scope" defaultValue={sp.scope ?? ""} aria-label={t.teachers.target}>
            <option value="">{t.timetable.allScopes}</option>
            <optgroup label={t.structure.classes}>{lk.activeClasses.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>
            <optgroup label={t.nav.groups}>{lk.activeGroups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}</optgroup>
          </AutoSubmitSelect>
        </div>
        <div className="sm:w-48"><AutoSubmitSelect name="subject" defaultValue={sp.subject ?? ""} aria-label={t.common.subject}><option value="">{t.timetable.allSubjects}</option>{lk.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</AutoSubmitSelect></div>
        {filtered && <Link href={`${b}?view=${view}`} className={buttonClass("ghost")}>{t.common.reset}</Link>}
        <div role="group" aria-label={t.common.period} className="inline-flex self-start rounded-lg bg-slate-100 p-0.5 sm:ms-auto">
          <Link href={withParam("view")} aria-current={view === "week" ? "true" : undefined} className={cx("rounded-md px-3 py-1.5 text-xs font-medium", view === "week" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{t.timetable.weekView}</Link>
          <Link href={`${withParam("view", "day")}${qs.has("day") ? "" : `&day=${day}`}`} aria-current={view === "day" ? "true" : undefined} className={cx("rounded-md px-3 py-1.5 text-xs font-medium", view === "day" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{t.timetable.dayView}</Link>
        </div>
      </form>

      {view === "day" && (
        <nav className="mb-4 flex gap-1 overflow-x-auto" aria-label={t.timetable.weekday}>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <Link key={d} href={withParam("day", String(d))} aria-current={d === day ? "page" : undefined} className={cx("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm", d === day ? "bg-brand-600 font-medium text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>
              {t.timetable.days[d - 1]} <span className="text-xs opacity-75">{entries.filter((e) => e.weekday === d).length}</span>
            </Link>
          ))}
        </nav>
      )}

      {editing && (
        <Card className="mb-6 border-brand-200 ring-2 ring-brand-500/10" title={t.timetable.editEntry} description={`${editing.subjects?.name} · ${editing.classes?.name ?? editing.groups?.name}`}
          actions={<div className="flex items-center gap-1">
            <form action={deleteEntry.bind(null, slug, back, editing.id)}><Submit small variant="ghost" icon="x" confirm={t.timetable.deleteConfirm}>{t.common.delete}</Submit></form>
            <Link href={back} className={buttonClass("secondary", true)}>{t.common.close}</Link>
          </div>}>
          <form action={updateEntry.bind(null, slug, `${back}${back.includes("?") ? "&" : "?"}edit=${editing.id}`, editing.id)} className="space-y-4">
            <EntryFields t={t} lk={lk} e={editing} />
            <div className="flex justify-end"><Submit icon="check">{t.common.save}</Submit></div>
          </form>
        </Card>
      )}

      <Card bodyClassName="p-4 sm:p-5">
        {entries.length ? (
          <WeekGrid
            days={days}
            onlyDay={view === "day" ? day : undefined}
            dayNames={t.timetable.days}
            minutesLabel={t.timetable.minutes}
            emptyDay={t.timetable.noSessionsDay}
            sessions={entries.map((e) => ({
              id: e.id, weekday: e.weekday, starts_at: e.starts_at, ends_at: e.ends_at, room: e.room,
              title: e.subjects?.name ?? "—", subtitle: e.classes?.name ?? e.groups?.name, meta: isAdmin ? e.teachers?.full_name : undefined,
              colorKey: e.subjects?.name ?? e.id,
              href: isAdmin ? `${withParam("edit", e.id)}` : undefined,
            }))}
          />
        ) : <EmptyState icon="calendar" title={t.timetable.noSessions} />}
      </Card>
    </>
  );
}
