import Link from "next/link";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { sanitizeSearch } from "@/lib/lookups";
import { PageHeader, Card, Flash, Badge, Pagination, EmptyState, SearchField, Avatar, ButtonLink, buttonClass, cx } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/client";
import { Icon } from "@/components/icons";

const PAGE = 25;

export default async function TeachersPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t } = await getT();
  const b = `/t/${slug}/teachers`;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const status = sp.status === "archived" || sp.status === "all" ? sp.status : "active";

  let q = supabase
    .from("teachers")
    .select(`id, full_name, email, phone, specialization, is_active,
             teacher_assignments${sp.subject ? "!inner" : ""}(id, subject_id, subjects(name), classes(name), groups(name))`, { count: "exact" })
    .eq("tenant_id", tenant.id)
    .order("full_name")
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status !== "all") q = q.eq("is_active", status === "active");
  if (sp.subject) q = q.eq("teacher_assignments.subject_id", sp.subject);
  if (sp.q) {
    const s = sanitizeSearch(sp.q);
    if (s) q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,specialization.ilike.%${s}%`);
  }
  const [res, subjects, members, invites] = await Promise.all([
    q,
    supabase.from("subjects").select("id, name").eq("tenant_id", tenant.id).order("name"),
    supabase.from("memberships").select("teacher_id, is_active").eq("tenant_id", tenant.id).eq("role", "teacher"),
    supabase.from("invitations").select("teacher_id").eq("tenant_id", tenant.id).is("accepted_at", null),
  ]);
  for (const r of [res, subjects, members, invites]) if (r.error) throw new Error(r.error.message);
  const total = res.count ?? 0;
  const filtered = !!(sp.q || sp.subject || status !== "active");
  const keep = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && !["ok", "error", "page"].includes(k))) as Record<string, string>;
  const hrefFor = (p: number) => `${b}?${new URLSearchParams({ ...keep, page: String(p) })}`;

  const rows = ((res.data ?? []) as any[]).map((x) => {
    const as = (x.teacher_assignments ?? []) as any[];
    return {
      ...x,
      subjects: Array.from(new Set(as.map((a) => a.subjects?.name).filter(Boolean))) as string[],
      scopes: Array.from(new Set(as.map((a) => a.classes?.name ?? a.groups?.name).filter(Boolean))) as string[],
      account: (members.data ?? []).some((m: any) => m.teacher_id === x.id && m.is_active) ? "linked" : (invites.data ?? []).some((i: any) => i.teacher_id === x.id) ? "invited" : "none",
    };
  });
  const accountBadge = (a: string) => a === "linked" ? <Badge tone="green">{t.teachers.linked}</Badge> : a === "invited" ? <Badge tone="amber">{t.status.pending}</Badge> : <Badge>{t.teachers.notLinked}</Badge>;
  const chips = (items: string[], tone: "blue" | "gray") => (
    <div className="flex max-w-[15rem] flex-wrap gap-1">
      {items.slice(0, 2).map((s) => <Badge key={s} tone={tone}>{s}</Badge>)}
      {items.length > 2 && <Badge>+{items.length - 2}</Badge>}
      {!items.length && <span className="text-slate-400">—</span>}
    </div>
  );

  return (
    <>
      <PageHeader title={t.teachers.title} subtitle={`${total} ${t.common.results}`} actions={<ButtonLink href={`${b}/new`} icon="plus">{t.teachers.new}</ButtonLink>} />
      <Flash sp={sp} dismissLabel={t.common.dismiss} />
      <Card bodyClassName="p-0">
        <form method="get" action={b} className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="sm:min-w-[16rem] sm:flex-1"><SearchField defaultValue={sp.q} placeholder={t.teachers.searchPlaceholder} label={t.common.search} /></div>
          <div className="sm:w-48">
            <AutoSubmitSelect name="subject" defaultValue={sp.subject ?? ""} aria-label={t.common.subject}>
              <option value="">{t.teachers.allSubjects}</option>
              {(subjects.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </AutoSubmitSelect>
          </div>
          <div className="sm:w-40">
            <AutoSubmitSelect name="status" defaultValue={status} aria-label={t.common.status}>
              <option value="active">{t.teachers.activeOnly}</option>
              <option value="archived">{t.teachers.inactiveOnly}</option>
              <option value="all">{t.teachers.allStatuses}</option>
            </AutoSubmitSelect>
          </div>
          <div className="flex gap-2">
            <button className={buttonClass("primary")}><Icon name="search" className="h-4 w-4" />{t.common.filter}</button>
            {filtered && <Link href={b} className={buttonClass("ghost")}>{t.common.reset}</Link>}
          </div>
        </form>

        {rows.length === 0 ? (
          <div className="p-5">
            {filtered
              ? <EmptyState icon="search" title={t.teachers.noResults} action={<ButtonLink small variant="secondary" href={b}>{t.common.reset}</ButtonLink>} />
              : <EmptyState icon="teacher" title={t.teachers.noTeachers} action={<ButtonLink small href={`${b}/new`} icon="plus">{t.teachers.new}</ButtonLink>} />}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-2.5 text-start font-medium">{t.common.teacher}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.common.email} / {t.common.phone}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.teachers.subjects}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.teachers.classesGroups}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.teachers.account}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.common.status}</th>
                    <th className="w-10 px-4 py-2.5"><span className="sr-only">{t.common.actions}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className={cx("group hover:bg-slate-50/70", !r.is_active && "opacity-70")}>
                      <td className="px-5 py-3">
                        <Link href={`${b}/${r.id}`} className="flex items-center gap-3">
                          <Avatar name={r.full_name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900 group-hover:text-brand-700">{r.full_name}</span>
                            <span className="block truncate text-xs text-slate-500">{r.specialization ?? "—"}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3"><div className="truncate text-slate-700" dir="ltr">{r.email ?? "—"}</div><div className="text-xs text-slate-500" dir="ltr">{r.phone ?? ""}</div></td>
                      <td className="px-4 py-3">{chips(r.subjects, "blue")}</td>
                      <td className="px-4 py-3">{chips(r.scopes, "gray")}</td>
                      <td className="whitespace-nowrap px-4 py-3">{accountBadge(r.account)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{r.is_active ? <Badge tone="green">{t.common.active}</Badge> : <Badge>{t.teachers.archived}</Badge>}</td>
                      <td className="px-4 py-3 text-end">
                        <Link href={`${b}/${r.id}`} aria-label={`${t.common.details}: ${r.full_name}`} className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Icon name="chevronRight" className="h-4 w-4 rtl:rotate-180" /></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`${b}/${r.id}`} className={cx("flex items-center gap-3 px-4 py-3 active:bg-slate-50", !r.is_active && "opacity-70")}>
                    <Avatar name={r.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">{r.full_name}</div>
                      <div className="truncate text-xs text-slate-500">{[r.subjects.join(", "), r.scopes.join(", ")].filter(Boolean).join(" · ") || r.specialization || "—"}</div>
                    </div>
                    {r.is_active ? accountBadge(r.account) : <Badge>{t.teachers.archived}</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination page={page} pages={Math.ceil(total / PAGE)} hrefFor={hrefFor} total={total} pageSize={PAGE} t={t.common} />
      </Card>
    </>
  );
}
