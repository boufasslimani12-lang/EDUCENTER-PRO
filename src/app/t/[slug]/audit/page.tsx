import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { PageHeader, Card, Table, Td, Badge, Pagination } from "@/components/ui";

const PAGE = 50;

export default async function AuditPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const page = Math.max(1, Number(sp.page ?? 1));
  let q = supabase.from("audit_log").select("*", { count: "exact" }).eq("tenant_id", tenant.id).order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.table) q = q.eq("table_name", sp.table);
  const { data, count } = await q;
  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "short", timeStyle: "medium", numberingSystem: "latn" });
  const diff = (o: any, n: any) => {
    if (!o || !n) return "";
    return Object.keys(n).filter((k) => !["updated_at"].includes(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k])).map((k) => `${k}: ${JSON.stringify(o[k])} → ${JSON.stringify(n[k])}`).join("; ");
  };
  return (
    <>
      <PageHeader title={t.nav.audit} subtitle={String(count ?? 0)} />
      <Card>
        <Table head={[t.common.date, "Table", t.common.actions, t.common.details]} empty={!data?.length && t.common.empty}>
          {(data ?? []).map((a: any) => (
            <tr key={a.id}>
              <Td className="text-xs text-slate-500">{fmt.format(new Date(a.created_at))}</Td>
              <Td><a className="hover:underline" href={`?table=${a.table_name}`}>{a.table_name}</a></Td>
              <Td><Badge tone={a.action === "DELETE" ? "red" : a.action === "INSERT" ? "green" : "amber"}>{a.action}</Badge></Td>
              <Td className="max-w-xl truncate text-xs text-slate-600" >{a.action === "UPDATE" ? diff(a.old_data, a.new_data) : (a.new_data?.name ?? a.new_data?.receipt_no ?? a.old_data?.name ?? a.record_id)}</Td>
            </tr>
          ))}
        </Table>
        <Pagination page={page} pages={Math.ceil((count ?? 0) / PAGE)} hrefFor={(p) => `?page=${p}${sp.table ? `&table=${sp.table}` : ""}`} t={t.common} />
      </Card>
    </>
  );
}
