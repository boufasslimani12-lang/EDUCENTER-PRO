import Link from "next/link";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups, sanitizeSearch } from "@/lib/lookups";
import { PageHeader, Card, Table, Td, ButtonLink, Flash, Input, Select, Badge, Pagination } from "@/components/ui";
import { search } from "./actions";

const PAGE = 25;

export default async function StudentsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t } = await getT();
  const lk = await lookups(supabase, tenant.id);
  const page = Math.max(1, Number(sp.page ?? 1));

  let q = supabase
    .from("students")
    .select(`id, code, first_name, last_name, guardian_phone, phone, archived_at,
             enrollments${sp.class ? "!inner" : ""}(id, status, academic_year_id, classes(name), student_groups(groups(name)))`, { count: "exact" })
    .eq("tenant_id", tenant.id)
    .order("last_name").order("first_name")
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.archived !== "1") q = q.is("archived_at", null);
  if (sp.class) q = q.eq("enrollments.class_id", sp.class);
  if (sp.q) {
    const s = sanitizeSearch(sp.q);
    if (s) q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,code.ilike.%${s}%,guardian_phone.ilike.%${s}%,phone.ilike.%${s}%`);
  }
  const { data, count } = await q;
  const pages = Math.ceil((count ?? 0) / PAGE);
  const qs = (p: number) => `?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(p) })}`;
  const searchAction = search.bind(null, slug);

  return (
    <>
      <PageHeader
        title={t.students.title}
        subtitle={`${count ?? 0}`}
        actions={<>
          <ButtonLink variant="secondary" href={`/t/${slug}/export/students`}>{t.common.export}</ButtonLink>
          <ButtonLink href={`/t/${slug}/students/new`}>{t.students.new}</ButtonLink>
        </>}
      />
      <Flash sp={sp} />
      <Card>
        <form action={searchAction} className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_200px_auto_auto]">
          <Input name="q" placeholder={t.common.search + "…"} defaultValue={sp.q} />
          <Select name="class" defaultValue={sp.class ?? ""}>
            <option value="">{t.common.class}: {t.common.all}</option>
            {lk.activeClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="archived" value="1" defaultChecked={sp.archived === "1"} />{t.students.showArchived}</label>
          <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">{t.common.filter}</button>
        </form>
        <Table head={[t.students.code, t.common.name, t.common.class, t.students.groups, t.students.guardianPhone, t.common.status]} empty={!data?.length && t.common.empty}>
          {(data ?? []).map((s: any) => {
            const e = (s.enrollments ?? []).find((x: any) => x.academic_year_id === lk.activeYear?.id && x.status === "active");
            return (
              <tr key={s.id} className="hover:bg-slate-50">
                <Td className="text-slate-500">{s.code ?? "—"}</Td>
                <Td><Link className="font-medium text-brand-700 hover:underline" href={`/t/${slug}/students/${s.id}`}>{s.last_name} {s.first_name}</Link></Td>
                <Td>{e?.classes?.name ?? "—"}</Td>
                <Td className="max-w-xs truncate">{(e?.student_groups ?? []).map((g: any) => g.groups?.name).join(", ") || "—"}</Td>
                <Td dir="ltr">{s.guardian_phone ?? s.phone ?? "—"}</Td>
                <Td>{s.archived_at ? <Badge tone="gray">{t.students.archived}</Badge> : e ? <Badge tone="green">{t.common.active}</Badge> : <Badge tone="amber">{t.students.noEnrollment}</Badge>}</Td>
              </tr>
            );
          })}
        </Table>
        <Pagination page={page} pages={pages} hrefFor={qs} t={t.common} />
      </Card>
    </>
  );
}
