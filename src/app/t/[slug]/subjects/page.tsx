import Link from "next/link";
import { requireAdmin, type Props } from "@/lib/session";
import { getT, type Dictionary } from "@/lib/i18n";
import { PageHeader, Flash, Input, Field, Textarea, Badge, EmptyState, SearchField, buttonClass, cx } from "@/components/ui";
import { Submit, Dialog } from "@/components/client";
import { Icon } from "@/components/icons";
import * as A from "../structure/actions";

function SubjectFields({ t, s }: { t: Dictionary; s?: any }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_7rem] gap-4">
        <Field label={t.common.name} required><Input name="name" required maxLength={80} defaultValue={s?.name} /></Field>
        <Field label={t.structure.coefficient}><Input name="coefficient" type="number" step="0.5" min="0.5" inputMode="decimal" defaultValue={s?.coefficient ?? ""} /></Field>
      </div>
      <Field label={t.subjects.description} hint={t.common.optional}><Textarea name="description" rows={3} maxLength={500} defaultValue={s?.description ?? ""} /></Field>
    </>
  );
}

export default async function SubjectsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t } = await getT();
  const b = `/t/${slug}`;
  const [subjects, assigns, groups] = await Promise.all([
    supabase.from("subjects").select("id, name, coefficient, description, is_active").eq("tenant_id", tenant.id).order("name"),
    supabase.from("teacher_assignments").select("subject_id, teacher_id, teachers(full_name), class_id, classes(name), group_id, groups(name)").eq("tenant_id", tenant.id).not("subject_id", "is", null),
    supabase.from("groups").select("id, name, subject_id, academic_years!inner(is_active)").eq("tenant_id", tenant.id).eq("academic_years.is_active", true),
  ]);
  for (const r of [subjects, assigns, groups]) if (r.error) throw new Error(r.error.message);
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = ((subjects.data ?? []) as any[]).filter((s) => !q || s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q)).map((s) => {
    const as = ((assigns.data ?? []) as any[]).filter((a) => a.subject_id === s.id);
    const uniq = <T,>(xs: T[]) => Array.from(new Map(xs.map((x: any) => [x.id, x])).values()) as T[];
    return {
      ...s,
      teachers: uniq(as.map((a) => ({ id: a.teacher_id, name: a.teachers?.full_name }))),
      classes: uniq(as.filter((a) => a.class_id).map((a) => ({ id: a.class_id, name: a.classes?.name }))),
      groups: uniq([...((groups.data ?? []) as any[]).filter((g) => g.subject_id === s.id).map((g) => ({ id: g.id, name: g.name })), ...as.filter((a) => a.group_id).map((a) => ({ id: a.group_id, name: a.groups?.name }))]),
    };
  });

  return (
    <>
      <PageHeader title={t.subjects.title} subtitle={`${rows.length} ${t.common.results}`}
        actions={<Dialog trigger={t.subjects.new} icon="plus" variant="primary" title={t.subjects.new}><form action={A.addSubject.bind(null, slug)} className="space-y-4"><SubjectFields t={t} /><div className="flex justify-end"><Submit icon="check">{t.common.create}</Submit></div></form></Dialog>} />
      <Flash sp={sp} dismissLabel={t.common.dismiss} />
      <form method="get" action={`${b}/subjects`} className="mb-4 flex max-w-md gap-2">
        <div className="flex-1"><SearchField defaultValue={sp.q} placeholder={t.subjects.search} label={t.common.search} /></div>
        {q && <Link href={`${b}/subjects`} className={buttonClass("ghost")}>{t.common.reset}</Link>}
      </form>
      {rows.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {rows.map((s) => (
            <section key={s.id} className={cx("flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card", !s.is_active && "opacity-70")}>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon name="book" className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{s.name}</h2>{s.coefficient && <Badge>coef. {s.coefficient}</Badge>}{!s.is_active && <Badge>{t.subjects.inactive}</Badge>}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{s.description || "—"}</p>
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div><dt className="text-xs text-slate-500">{t.subjects.teachers}</dt><dd className="mt-1 flex flex-wrap gap-1">{s.teachers.length ? s.teachers.map((x: any) => <Link key={x.id} href={`${b}/teachers/${x.id}`}><Badge tone="blue">{x.name}</Badge></Link>) : <span className="text-slate-400">—</span>}</dd></div>
                <div><dt className="text-xs text-slate-500">{t.subjects.taughtIn}</dt><dd className="mt-1 flex flex-wrap gap-1">
                  {s.classes.map((c: any) => <Link key={c.id} href={`${b}/structure/classes/${c.id}`}><Badge>{c.name}</Badge></Link>)}
                  {s.groups.map((g: any) => <Link key={g.id} href={`${b}/groups/${g.id}`}><Badge tone="green">{g.name}</Badge></Link>)}
                  {!s.classes.length && !s.groups.length && <span className="text-slate-400">—</span>}
                </dd></div>
              </dl>
              <div className="mt-auto flex flex-wrap justify-end gap-1.5 border-t border-slate-100 pt-3">
                <Dialog trigger={t.common.edit} variant="ghost" small icon="settings" title={t.subjects.edit} description={s.name}><form action={A.updateSubject.bind(null, slug, s.id)} className="space-y-4"><SubjectFields t={t} s={s} /><div className="flex justify-end"><Submit icon="check">{t.common.save}</Submit></div></form></Dialog>
                <form action={A.toggleSubject.bind(null, slug, s.id, !s.is_active)}><Submit small variant="ghost" icon={s.is_active ? "inbox" : "refresh"}>{s.is_active ? t.subjects.deactivate : t.subjects.activate}</Submit></form>
                <form action={A.deleteSubject.bind(null, slug, s.id)}><Submit small variant="ghost" icon="x" confirm={t.subjects.deleteConfirm}>{t.common.delete}</Submit></form>
              </div>
            </section>
          ))}
        </div>
      ) : <EmptyState icon="book" title={t.subjects.noSubjects} />}
    </>
  );
}
