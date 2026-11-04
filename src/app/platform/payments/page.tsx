import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { date, money } from "@/lib/format";
import { PageHeader, Card, Flash, Table, Td, Badge, statusTone, Input } from "@/components/ui";
import { Submit } from "@/components/client";
import { review } from "../actions";

export default async function SubPayments({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data } = await supabase.from("subscription_payments").select("*, tenants(name)").order("created_at", { ascending: false }).limit(100);
  const rows = await Promise.all(((data ?? []) as any[]).map(async (p) => {
    if (!p.proof_path) return { ...p, url: null };
    const { data: u } = await supabase.storage.from("subscription-proofs").createSignedUrl(p.proof_path, 600);
    return { ...p, url: u?.signedUrl ?? null };
  }));
  return (
    <>
      <PageHeader title={t.nav.subscriptions} />
      <Flash sp={sp} />
      <Card>
        <Table head={[t.common.date, t.nav.institutions, t.common.amount, t.billing.months, t.common.reference, t.platform.proof, t.common.status, ""]} empty={!rows.length && t.common.empty}>
          {rows.map((p) => (
            <tr key={p.id}>
              <Td>{date(p.created_at, locale)}</Td>
              <Td><Link className="text-brand-700 hover:underline" href={`/platform/institutions/${p.tenant_id}`}>{p.tenants?.name}</Link></Td>
              <Td className="tabular-nums">{money(p.amount, locale)}</Td>
              <Td>{p.period_months}</Td>
              <Td>{p.reference ?? "—"}</Td>
              <Td>{p.url ? <a className="text-brand-700 underline" href={p.url} target="_blank" rel="noreferrer">{t.platform.proof}</a> : "—"}</Td>
              <Td><Badge tone={statusTone(p.status)}>{t.status[p.status as "pending"]}</Badge></Td>
              <Td>
                {p.status === "pending" && (
                  <div className="flex gap-1">
                    <form action={review.bind(null, p.id, true)}><input type="hidden" name="note" value="" /><Submit small confirm={t.platform.review + " ?"}>{t.platform.review}</Submit></form>
                    <form action={review.bind(null, p.id, false)} className="flex gap-1"><Input name="note" placeholder={t.common.reason} className="w-28" /><Submit small variant="danger">{t.platform.reject}</Submit></form>
                  </div>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
