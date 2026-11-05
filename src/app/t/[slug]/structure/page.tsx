import Link from "next/link";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { CapacityBar } from "@/components/capacity-bar";
import { lookups } from "@/lib/lookups";
import { date } from "@/lib/format";
import { PageHeader, Card, Flash, Input, Select, Field, Badge, Tabs, EmptyState, cx } from "@/components/ui";
import { Submit, Dialog, AutoSubmitSelect } from "@/components/client";
import { Icon } from "@/components/icons";
import * as A from "./actions";

export default async function StructurePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const lk = await lookups(supabase, tenant.id);
  const b = `/t/${slug}/structure`;
  const tab = sp.tab === "levels" || sp.tab === "classes" ? sp.tab : "years";
  const yearId = sp.year && lk.years.some((y) => y.id === sp.year) ? sp.year : lk.activeYear?.id;

  const [enr, assigns, caps] = await Promise.all([
    supabase.from("enrollments").select("class_id").eq("tenant_id", tenant.id).eq("status", "active"),
    supabase.from("teacher_assignments").select("class_id, teachers(full_name)").eq("tenant_id", tenant.id).not("class_id", "is", null),
    supabase.from("classes").select("id, capacity").eq("tenant_id", tenant.id),
  ]);
  for (const r of [enr, assigns, caps]) if (r.error) throw new Error(r.error.message);
  const countBy = (cid: string) => (enr.data ?? []).filter((c: any) => c.class_id === cid).length;
  const capOf = (cid: string) => ((caps.data ?? []) as any[]).find((c) => c.id === cid)?.capacity ?? null;
  const teachersOf = (cid: string) => Array.from(new Set(((assigns.data ?? []) as any[]).filter((a) => a.class_id === cid).map((a) => a.teachers?.full_name).filter(Boolean))) as string[];
  const classes = lk.classes.filter((c) => c.academic_year_id === yearId);
  const back = (q: string) => `${b}?${q}`;

  const classForm = (c?: any) => (
    <form action={c ? A.updateClass.bind(null, slug, c.id) : A.addClass.bind(null, slug)} className="space-y-4">
      <input type="hidden" name="back" value={back(`tab=classes${yearId ? `&year=${yearId}` : ""}`)} />
      <Field label={t.common.name} required><Input name="name" required maxLength={60} defaultValue={c?.name} /></Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.common.level}><Select name="level_id" defaultValue={c?.level_id ?? ""}><option value="">{t.common.none}</option>{lk.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label={t.structure.capacity} hint={t.structure.capacityHint}><Input name="capacity" type="number" min="1" step="1" inputMode="numeric" defaultValue={c ? capOf(c.id) ?? "" : ""} /></Field>
      </div>
      {!c && (
        <Field label={t.common.academicYear} required>
          <Select name="academic_year_id" required defaultValue={yearId}>{lk.years.filter((y) => !y.archived_at).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</Select>
        </Field>
      )}
      <div className="flex justify-end"><Submit icon="check">{c ? t.common.save : t.common.create}</Submit></div>
    </form>
  );
  const levelForm = (l?: any) => (
    <form action={l ? A.updateLevel.bind(null, slug, l.id) : A.addLevel.bind(null, slug)} className="space-y-4">
      <div className="grid grid-cols-[1fr_6rem] gap-4">
        <Field label={t.common.name} required><Input name="name" required maxLength={60} defaultValue={l?.name} /></Field>
        <Field label={t.structure.sortOrder}><Input name="sort_order" type="number" step="1" defaultValue={l?.sort_order ?? lk.levels.length} /></Field>
      </div>
      <div className="flex justify-end"><Submit icon="check">{l ? t.common.save : t.common.create}</Submit></div>
    </form>
  );

  return (
    <>
      <PageHeader
        title={t.nav.structure}
        subtitle={lk.activeYear ? `${t.common.academicYear} ${lk.activeYear.name}` : undefined}
        actions={
          tab === "years" ? (
            <Dialog trigger={t.structure.newYear} icon="plus" variant="primary" title={t.structure.newYear}>
              <form action={A.addYear.bind(null, slug)} className="space-y-4">
                <Field label={t.common.name} required><Input name="name" required placeholder="2027-2028" maxLength={20} /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t.structure.startsOn} required><Input name="starts_on" type="date" required /></Field>
                  <Field label={t.structure.endsOn} required><Input name="ends_on" type="date" required /></Field>
                </div>
                <div className="flex justify-end"><Submit icon="check">{t.common.create}</Submit></div>
              </form>
            </Dialog>
          ) : tab === "levels" ? (
            <Dialog trigger={t.structure.newLevel} icon="plus" variant="primary" title={t.structure.newLevel}>{levelForm()}</Dialog>
          ) : (
            <Dialog trigger={t.structure.newClass} icon="plus" variant="primary" title={t.structure.newClass}>{classForm()}</Dialog>
          )
        }
      />
      <Flash sp={sp} dismissLabel={t.common.dismiss} />
      <div className="mb-6">
        <Tabs current={tab} tabs={[
          { key: "years", label: t.structure.tabYears, href: b, count: lk.years.length },
          { key: "levels", label: t.structure.tabLevels, href: `${b}?tab=levels`, count: lk.levels.length },
          { key: "classes", label: t.structure.tabClasses, href: `${b}?tab=classes`, count: lk.activeClasses.length },
        ]} />
      </div>

      {tab === "years" && (
        <Card bodyClassName="p-0">
          {lk.years.length ? (
            <ul className="divide-y divide-slate-100">
              {lk.years.map((y) => (
                <li key={y.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", y.is_active ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-slate-400")}><Icon name="calendar" className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="font-medium text-slate-900">{y.name}</span>{y.is_active ? <Badge tone="green">{t.common.active}</Badge> : y.archived_at ? <Badge>{t.structure.archivedYear}</Badge> : null}</div>
                    <div className="text-xs text-slate-500">{date(y.starts_on, locale)} → {date(y.ends_on, locale)} · {lk.classes.filter((c) => c.academic_year_id === y.id).length} {t.structure.classes.toLowerCase()}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <Link href={`${b}?tab=classes&year=${y.id}`} className="rounded-lg px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">{t.structure.classes}</Link>
                    {!y.is_active && <form action={A.activateYear.bind(null, slug, y.id)}><Submit small variant="secondary" confirm={t.structure.yearActivateConfirm}>{t.structure.setActive}</Submit></form>}
                    {!y.is_active && !y.archived_at && <form action={A.archiveYear.bind(null, slug, y.id)}><Submit small variant="ghost" icon="inbox" confirm={t.structure.yearArchiveConfirm}>{t.common.archive}</Submit></form>}
                  </div>
                </li>
              ))}
            </ul>
          ) : <div className="p-5"><EmptyState icon="calendar" title={t.common.empty} /></div>}
        </Card>
      )}

      {tab === "levels" && (
        <Card bodyClassName="p-0">
          {lk.levels.length ? (
            <ul className="divide-y divide-slate-100">
              {lk.levels.map((l) => {
                const n = lk.activeClasses.filter((c) => c.level_id === l.id).length;
                return (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-semibold tabular-nums text-slate-500">{l.sort_order}</span>
                    <div className="min-w-0 flex-1"><div className="font-medium text-slate-900">{l.name}</div><div className="text-xs text-slate-500">{n} {t.structure.classes.toLowerCase()}</div></div>
                    <Dialog trigger={t.common.edit} variant="ghost" small icon="settings" title={t.structure.editLevel}>{levelForm(l)}</Dialog>
                    <form action={A.deleteLevel.bind(null, slug, l.id)}><Submit small variant="ghost" icon="x" confirm={t.structure.deleteConfirm}>{t.common.delete}</Submit></form>
                  </li>
                );
              })}
            </ul>
          ) : <div className="p-5"><EmptyState icon="layers" title={t.structure.noLevels} /></div>}
        </Card>
      )}

      {tab === "classes" && (
        <Card bodyClassName="p-0">
          <form method="get" action={b} className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
            <input type="hidden" name="tab" value="classes" />
            <div className="w-56">
              <AutoSubmitSelect name="year" defaultValue={yearId} aria-label={t.structure.yearFilter}>
                {lk.years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_active ? ` · ${t.common.active}` : y.archived_at ? ` · ${t.structure.archivedYear}` : ""}</option>)}
              </AutoSubmitSelect>
            </div>
            <span className="text-sm text-slate-500">{classes.length} {t.common.results}</span>
          </form>
          {classes.length ? (
            <ul className="divide-y divide-slate-100">
              {classes.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 px-5 py-3.5 md:flex-row md:items-center">
                  <Link href={`${b}/classes/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon name="layers" className="h-4 w-4" /></span>
                    <span className="min-w-0"><span className="block truncate font-medium text-slate-900 hover:text-brand-700">{c.name}</span><span className="block truncate text-xs text-slate-500">{c.levels?.name ?? t.common.none} · {teachersOf(c.id).join(", ") || "—"}</span></span>
                  </Link>
                  <div className="flex items-center gap-3">
                    <CapacityBar n={countBy(c.id)} cap={capOf(c.id)} t={t} />
                    <Dialog trigger={t.common.edit} variant="ghost" small icon="settings" title={t.structure.editClass} description={c.name}>{classForm(c)}</Dialog>
                    <form action={A.deleteClass.bind(null, slug, c.id)}><input type="hidden" name="back" value={back(`tab=classes&year=${yearId}`)} /><Submit small variant="ghost" icon="x" confirm={t.structure.deleteConfirm}>{t.common.delete}</Submit></form>
                  </div>
                </li>
              ))}
            </ul>
          ) : <div className="p-5"><EmptyState icon="layers" title={t.structure.noClasses} /></div>}
        </Card>
      )}
    </>
  );
}
