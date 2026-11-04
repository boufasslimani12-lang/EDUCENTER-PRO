import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { date } from "@/lib/format";
import { PageHeader, Card, Flash, Table, Td, Input, Select, Field, Badge } from "@/components/ui";
import { Submit } from "@/components/client";
import * as A from "./actions";

export default async function StructurePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const lk = await lookups(supabase, tenant.id);
  const { data: counts } = await supabase.from("enrollments").select("class_id").eq("tenant_id", tenant.id).eq("status", "active");
  const countBy = (cid: string) => (counts ?? []).filter((c: any) => c.class_id === cid).length;

  return (
    <>
      <PageHeader title={t.nav.structure} />
      <Flash sp={sp} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title={t.structure.years}>
          <Table head={[t.common.name, t.structure.startsOn, t.structure.endsOn, t.common.status, ""]}>
            {lk.years.map((y) => (
              <tr key={y.id}>
                <Td className="font-medium">{y.name}</Td>
                <Td>{date(y.starts_on, locale)}</Td>
                <Td>{date(y.ends_on, locale)}</Td>
                <Td>{y.is_active ? <Badge tone="green">{t.common.active}</Badge> : y.archived_at ? <Badge>{t.status.archived}</Badge> : null}</Td>
                <Td className="flex gap-1">
                  {!y.is_active && <form action={A.activateYear.bind(null, slug, y.id)}><Submit small variant="secondary" confirm={t.common.confirm + " ?"}>{t.structure.setActive}</Submit></form>}
                  {!y.is_active && !y.archived_at && <form action={A.archiveYear.bind(null, slug, y.id)}><Submit small variant="ghost">{t.common.archive}</Submit></form>}
                </Td>
              </tr>
            ))}
          </Table>
          <form action={A.addYear.bind(null, slug)} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
            <Input name="name" placeholder="2026-2027" required />
            <Input name="starts_on" type="date" required />
            <Input name="ends_on" type="date" required />
            <Submit>{t.common.add}</Submit>
          </form>
        </Card>

        <Card title={t.structure.levels}>
          <Table head={[t.structure.sortOrder, t.common.name, ""]}>
            {lk.levels.map((l) => (
              <tr key={l.id}>
                <Td className="text-slate-500">{l.sort_order}</Td>
                <Td>{l.name}</Td>
                <Td><form action={A.deleteLevel.bind(null, slug, l.id)}><Submit small variant="ghost" confirm={t.common.delete + " ?"}>{t.common.delete}</Submit></form></Td>
              </tr>
            ))}
          </Table>
          <form action={A.addLevel.bind(null, slug)} className="mt-4 grid grid-cols-[1fr_90px_auto] gap-2">
            <Input name="name" placeholder={t.common.name} required />
            <Input name="sort_order" type="number" placeholder="#" />
            <Submit>{t.common.add}</Submit>
          </form>
        </Card>

        <Card title={`${t.structure.classes} — ${lk.activeYear?.name ?? ""}`} className="xl:col-span-2">
          <Table head={[t.common.name, t.common.level, t.common.academicYear, t.structure.studentsCount, ""]} empty={!lk.classes.length && t.common.empty}>
            {lk.classes.map((c) => (
              <tr key={c.id}>
                <Td className="font-medium">{c.name}</Td>
                <Td>{c.levels?.name ?? "—"}</Td>
                <Td>{lk.years.find((y) => y.id === c.academic_year_id)?.name}</Td>
                <Td className="tabular-nums">{countBy(c.id)}</Td>
                <Td><form action={A.deleteClass.bind(null, slug, c.id)}><Submit small variant="ghost" confirm={t.common.delete + " ?"}>{t.common.delete}</Submit></form></Td>
              </tr>
            ))}
          </Table>
          <form action={A.addClass.bind(null, slug)} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
            <Field label={t.common.name}><Input name="name" required /></Field>
            <Field label={t.common.level}>
              <Select name="level_id"><option value="">—</option>{lk.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
            </Field>
            <Field label={t.common.academicYear}>
              <Select name="academic_year_id" defaultValue={lk.activeYear?.id}>{lk.years.filter((y) => !y.archived_at).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</Select>
            </Field>
            <div className="flex items-end"><Submit>{t.common.add}</Submit></div>
          </form>
        </Card>
      </div>
    </>
  );
}
