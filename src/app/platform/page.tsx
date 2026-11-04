import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { PageHeader, Stat, Grid, Card, Table, Td, Badge, statusTone } from "@/components/ui";

export default async function PlatformHome() {
  const supabase = await createClient();
  const { t, locale } = await getT();
  const [{ data: tenants }, { data: stats }, { count: pending }] = await Promise.all([
    supabase.from("tenants").select("id, name, slug, type, created_at, tenant_effective_status").order("created_at", { ascending: false }),
    supabase.rpc("platform_stats"),
    supabase.from("subscription_payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const list = (tenants ?? []) as any[];
  const by = (s: string[]) => list.filter((x) => s.includes(x.tenant_effective_status)).length;
  const st = new Map(((stats ?? []) as any[]).map((s) => [s.tenant_id, s]));
  const totalStudents = ((stats ?? []) as any[]).reduce((a, s) => a + Number(s.students), 0);
  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", numberingSystem: "latn" });
  return (
    <>
      <PageHeader title={t.platform.title} subtitle={t.platform.privacy} />
      <Grid cols={4}>
        <Stat label={t.platform.tenants} value={list.length} />
        <Stat label={t.platform.activeTenants} value={by(["subscription_active", "renewal_pending", "grace_period"])} tone="good" />
        <Stat label={t.platform.trials} value={by(["trial_active"])} />
        <Stat label={t.platform.suspendedTenants} value={by(["suspended"])} tone="bad" />
        <Stat label={t.platform.pendingPayments} value={<Link href="/platform/payments" className="underline">{pending ?? 0}</Link>} tone={pending ? "warn" : "default"} />
        <Stat label={t.dashboard.activeStudents} value={totalStudents} />
      </Grid>
      <Card title={t.platform.usage} className="mt-6">
        <Table head={[t.common.name, t.common.status, t.nav.students, t.nav.teachers, t.settings.users, t.platform.lastActivity]}>
          {list.map((x) => {
            const s = st.get(x.id);
            return (
              <tr key={x.id}>
                <Td><Link className="font-medium text-brand-700 hover:underline" href={`/platform/institutions/${x.id}`}>{x.name}</Link></Td>
                <Td><Badge tone={statusTone(x.tenant_effective_status)}>{t.status[x.tenant_effective_status as "trial_active"]}</Badge></Td>
                <Td className="tabular-nums">{s?.students ?? 0}</Td>
                <Td className="tabular-nums">{s?.teachers ?? 0}</Td>
                <Td className="tabular-nums">{s?.members ?? 0}</Td>
                <Td className="text-xs text-slate-500">{s?.last_activity ? fmt.format(new Date(s.last_activity)) : "—"}</Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
