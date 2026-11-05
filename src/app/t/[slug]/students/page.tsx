import Link from "next/link";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups, sanitizeSearch } from "@/lib/lookups";
import { PageHeader, Card, ButtonLink, Flash, Badge, Pagination, EmptyState, SearchField, Avatar, buttonClass, cx } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/client";
import { Icon } from "@/components/icons";

const PAGE = 25;

export default async function StudentsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t } = await getT();
  const lk = await lookups(supabase, tenant.id);
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const b = `/t/${slug}/students`;

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
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  const pages = Math.ceil(total / PAGE);
  const filtered = !!(sp.q || sp.class || sp.archived === "1");
  const keep = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && !["ok", "error", "page"].includes(k))) as Record<string, string>;
  const hrefFor = (p: number) => `${b}?${new URLSearchParams({ ...keep, page: String(p) })}`;

  const rows = (data ?? []).map((s: any) => {
    const e = (s.enrollments ?? []).find((x: any) => x.academic_year_id === lk.activeYear?.id && x.status === "active");
    const groups: string[] = (e?.student_groups ?? []).map((g: any) => g.groups?.name).filter(Boolean);
    return { ...s, name: `${s.last_name} ${s.first_name}`, className: e?.classes?.name as string | undefined, groups, enrolled: !!e, contact: s.guardian_phone ?? s.phone };
  });
  const statusBadge = (r: (typeof rows)[number]) =>
    r.archived_at ? <Badge tone="gray">{t.students.archived}</Badge> : r.enrolled ? <Badge tone="green">{t.common.active}</Badge> : <Badge tone="amber">{t.students.noEnrollment}</Badge>;

  return (
    <>
      <PageHeader
        title={t.students.title}
        subtitle={`${total} ${t.common.results}`}
        actions={<>
          <ButtonLink variant="secondary" href={`/t/${slug}/export/students`} icon="arrowUpRight">{t.common.export}</ButtonLink>
          <ButtonLink href={`${b}/new`} icon="plus">{t.students.new}</ButtonLink>
        </>}
      />
      <Flash sp={sp} dismissLabel={t.common.dismiss} />
      <Card bodyClassName="p-0">
        <form method="get" action={b} className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="sm:min-w-[16rem] sm:flex-1"><SearchField defaultValue={sp.q} placeholder={t.students.searchPlaceholder} label={t.common.search} /></div>
          <div className="sm:w-52">
            <AutoSubmitSelect name="class" defaultValue={sp.class ?? ""} aria-label={t.common.class}>
              <option value="">{t.students.allClasses}</option>
              {lk.activeClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </AutoSubmitSelect>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-600">
            <input type="checkbox" name="archived" value="1" defaultChecked={sp.archived === "1"} className="rounded border-slate-300 text-brand-600" />
            {t.students.showArchived}
          </label>
          <div className="flex gap-2">
            <button className={buttonClass("primary")}><Icon name="search" className="h-4 w-4" />{t.common.filter}</button>
            {filtered && <Link href={b} className={buttonClass("ghost")}>{t.common.reset}</Link>}
          </div>
        </form>

        {rows.length === 0 ? (
          <div className="p-5">
            {filtered
              ? <EmptyState icon="search" title={t.students.noResults} action={<ButtonLink small variant="secondary" href={b}>{t.common.reset}</ButtonLink>} />
              : <EmptyState icon="students" title={t.students.noStudents} action={<ButtonLink small href={`${b}/new`} icon="plus">{t.students.new}</ButtonLink>} />}
          </div>
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-2.5 text-start font-medium">{t.common.student}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.common.class}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.students.groups}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.students.guardianPhone}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.common.status}</th>
                    <th className="w-10 px-4 py-2.5"><span className="sr-only">{t.common.actions}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className={cx("group hover:bg-slate-50/70", r.archived_at && "opacity-70")}>
                      <td className="px-5 py-3">
                        <Link href={`${b}/${r.id}`} className="flex items-center gap-3">
                          <Avatar name={r.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900 group-hover:text-brand-700">{r.name}</span>
                            <span className="block text-xs text-slate-500">{r.code ?? "—"}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{r.className ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-[16rem] flex-wrap gap-1">
                          {r.groups.slice(0, 2).map((g: string) => <Badge key={g} tone="blue">{g}</Badge>)}
                          {r.groups.length > 2 && <Badge>+{r.groups.length - 2}</Badge>}
                          {!r.groups.length && <span className="text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700" dir="ltr">{r.contact ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{statusBadge(r)}</td>
                      <td className="px-4 py-3 text-end">
                        <Link href={`${b}/${r.id}`} aria-label={`${t.common.details}: ${r.name}`} className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <Icon name="chevronRight" className="h-4 w-4 rtl:rotate-180" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile list */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`${b}/${r.id}`} className={cx("flex items-center gap-3 px-4 py-3 active:bg-slate-50", r.archived_at && "opacity-70")}>
                    <Avatar name={r.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">{r.name}</div>
                      <div className="truncate text-xs text-slate-500">{[r.className, r.groups.join(", ")].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    {statusBadge(r)}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination page={page} pages={pages} hrefFor={hrefFor} total={total} pageSize={PAGE} t={t.common} />
      </Card>
    </>
  );
}
