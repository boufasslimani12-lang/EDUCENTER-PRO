"use server";
import { requireAdmin } from "@/lib/session";
import { finish, num, str } from "@/lib/actions";

export async function addRule(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const target = str(fd, "target") ?? "";
  const [kind, id] = target.split(":");
  const { error } = await supabase.from("remuneration_rules").insert({
    tenant_id: tenant.id, teacher_id: str(fd, "teacher_id"), percentage: num(fd, "percentage"), basis: str(fd, "basis"),
    class_id: kind === "c" ? id : null, group_id: kind === "g" ? id : null,
  });
  return finish(`/t/${slug}/remuneration`, error);
}

export async function deleteRule(slug: string, id: string) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("remuneration_rules").delete().eq("id", id);
  return finish(`/t/${slug}/remuneration`, error);
}

export async function calculate(slug: string, period: string) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.rpc("calculate_remuneration", { p_tenant: tenant.id, p_period: period });
  return finish(`/t/${slug}/remuneration?period=${period}`, error);
}

export async function pay(slug: string, period: string, statementId: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("remuneration_payments").insert({
    tenant_id: tenant.id, statement_id: statementId, amount: num(fd, "amount"), method: str(fd, "method"), paid_on: str(fd, "paid_on"),
  });
  return finish(`/t/${slug}/remuneration?period=${period}`, error);
}
