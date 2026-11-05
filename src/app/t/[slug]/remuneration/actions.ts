"use server";
import { requireAdmin } from "@/lib/session";
import { finish, num, str } from "@/lib/actions";
import { getT } from "@/lib/i18n";

const page = (slug: string, period?: string | null) =>
  `/t/${slug}/remuneration${period && /^\d{4}-\d{2}-01$/.test(period) ? `?period=${period}` : ""}`;

export async function addRule(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const target = str(fd, "target") ?? "";
  const [kind, id] = target.split(":");
  const { error } = await supabase.from("remuneration_rules").insert({
    tenant_id: tenant.id, teacher_id: str(fd, "teacher_id"), percentage: num(fd, "percentage"), basis: str(fd, "basis"),
    class_id: kind === "c" ? id : null, group_id: kind === "g" ? id : null,
  });
  return finish(page(slug, str(fd, "period")), error);
}

export async function deleteRule(slug: string, id: string, fd?: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("remuneration_rules").delete().eq("id", id);
  return finish(page(slug, fd ? str(fd, "period") : null), error);
}

export async function calculate(slug: string, period: string) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.rpc("calculate_remuneration", { p_tenant: tenant.id, p_period: period });
  return finish(page(slug, period), error);
}

/**
 * Record a payout against a statement. The amount may not exceed what is still owed; the
 * submit button is disabled while pending, so a double click cannot post twice.
 */
export async function pay(slug: string, period: string, statementId: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { t } = await getT();
  const amount = num(fd, "amount");
  const { data: st, error: e1 } = await supabase
    .from("remuneration_statements").select("calculated_amount, remuneration_payments(amount)")
    .eq("id", statementId).eq("tenant_id", tenant.id).maybeSingle();
  if (e1 || !st) return finish(page(slug, period), e1 ?? { message: t.errors.unexpected });
  const paid = ((st as any).remuneration_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
  const outstanding = Math.round((Number(st.calculated_amount) - paid) * 100) / 100;
  if (!amount || amount <= 0 || amount > outstanding) return finish(page(slug, period), { message: t.remuneration.exceeds });
  const { error } = await supabase.from("remuneration_payments").insert({
    tenant_id: tenant.id, statement_id: statementId, amount, method: str(fd, "method"), paid_on: str(fd, "paid_on"), note: str(fd, "note"),
  });
  return finish(page(slug, period), error);
}
