import Link from "next/link";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { groupFormFields } from "@/components/group-fields";
import { lookups } from "@/lib/lookups";
import { money } from "@/lib/format";
import { PageHeader, Card, Flash, Badge, EmptyState, SearchField, buttonClass } from "@/components/ui";
import { Submit, Dialog, AutoSubmitSelect } from "@/components/client";
import { Icon } from "@/components/icons";
import { CapacityBar } from "@/components/capacity-bar";
import * as A from "../structure/actions";

export default async function GroupsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const lk = await lookups(supabase, tenant.id);
  const b = `/t/${slug}/groups`;

  const [groups, members, assigns] = await Promise.all([
    supabase.from("groups").select("id, name, subject_id, level_id, monthly_fee, capacity, academic_year_id").eq("tenant_id", tenant.id).eq("academic_year_id", lk.activeYear?.id ?? "").order("name"),
    supabase.from("student_groups").select("group_id, enrollments!inner(status)").eq("tenant_id", tenant.id).eq("enrollments.status", "active"),
    supabase.from("teacher_assignments").select("group_id, teachers(full_name)").eq("tenant_id", tenant.id).not("group_id", "is", null),
  ]);
  for (const r of [groups, members, assigns]) if (r.error) throw new Error(r.error.message);
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = ((groups.data ?? []) as any[])
    .filter((g) => (!q || g.name.toLowerCase().includes(q)) && (!sp.subject || g.subject_id === sp.subject) && (!sp.level || g.level_id === sp.level))
    .map((g) => ({
      ...g,
      n: (members.data ?? []).filter((m: any) => m.group_id === g.id).length,
      teachers: Array.from(new Set(((assigns.data ?? []) as any[]).filter((a) => a.group_id === g.id).map((a) => a.teachers?.full_name).filter(Boolean))) as string[],
      subject: lk.subjects.find((s) => s.id === g.subject_id)?.name, level: lk.levels.find((l) => l.id === g.level_id)?.name,
    }));
  const filtered = !!(q || sp.subject || sp.level);

  return (
    <>
      <PageHeader title={t.groups.title} subtitle={`${lk.activeYear?.name ?? ""} · ${rows.length} ${t.common.results}`}
        actions={
          <Dialog trigger={t.groups.new} icon="plus" variant="primary" title={t.groups.new} description={lk.activeYear?.name}>
            <form action={A.addGroup.bind(null, slug)} className="space-y-4">
              <input type="hidden" name="academic_year_id" value={lk.activeYear?.id ?? ""} />
              {groupFormFields(t, lk)}
              <div className="flex justify-end"><Submit icon="check">{t.common.create}</Submit></div>
            </form>
          </Dialog>
        } />
      <Flash sp={sp} dismissLabel={t.common.dismiss} />
      <Card bodyClassName="p-0">
        <form method="get" action={b} className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="sm:min-w-[14rem] sm:flex-1"><SearchField defaultValue={sp.q} placeholder={t.groups.search} label={t.common.search} /></div>
          <div className="sm:w-48"><AutoSubmitSelect name="subject" defaultValue={sp.subject ?? ""} aria-label={t.common.subject}><option value="">{t.groups.allSubjects}</option>{lk.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</AutoSubmitSelect></div>
          <div className="sm:w-44"><AutoSubmitSelect name="level" defaultValue={sp.level ?? ""} aria-label={t.common.level}><option value="">{t.groups.allLevels}</option>{lk.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</AutoSubmitSelect></div>
          <div className="flex gap-2"><button className={buttonClass("primary")}><Icon name="search" className="h-4 w-4" />{t.common.filter}</button>{filtered && <Link href={b} className={buttonClass("ghost")}>{t.common.reset}</Link>}</div>
        </form>
        {rows.length ? (
          <ul className="divide-y divide-slate-100">
            {rows.map((g) => (
              <li key={g.id} className="flex flex-col gap-3 px-5 py-3.5 md:flex-row md:items-center">
                <Link href={`${b}/${g.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Icon name="groups" className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900 hover:text-brand-700">{g.name}</span>
                    <span className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                      {g.subject && <Badge tone="blue">{g.subject}</Badge>}{g.level && <Badge>{g.level}</Badge>}
                      <span className="truncate">{g.teachers.join(", ") || "—"}</span>
                    </span>
                  </span>
                </Link>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm tabular-nums text-slate-600">{g.monthly_fee ? money(g.monthly_fee, locale, tenant.currency) : "—"}</span>
                  <CapacityBar n={g.n} cap={g.capacity} t={t} />
                  <Dialog trigger={t.common.edit} variant="ghost" small icon="settings" title={t.groups.edit} description={g.name}>
                    <form action={A.updateGroup.bind(null, slug, g.id)} className="space-y-4">{groupFormFields(t, lk, g)}<div className="flex justify-end"><Submit icon="check">{t.common.save}</Submit></div></form>
                  </Dialog>
                  <form action={A.deleteGroup.bind(null, slug, g.id)}><Submit small variant="ghost" icon="x" confirm={t.groups.deleteConfirm}>{t.common.delete}</Submit></form>
                </div>
              </li>
            ))}
          </ul>
        ) : <div className="p-5"><EmptyState icon="groups" title={filtered ? t.groups.noResults : t.groups.noGroups} /></div>}
      </Card>
    </>
  );
}
