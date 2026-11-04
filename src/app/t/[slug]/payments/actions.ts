"use server";
import { requireAdmin } from "@/lib/session";
import { finish, num, str } from "@/lib/actions";
import { getT } from "@/lib/i18n";

export async function generate(slug: string, period: string) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { t } = await getT();
  const { data, error } = await supabase.rpc("generate_installments", { p_tenant: tenant.id, p_period: period });
  return finish(`/t/${slug}/payments?period=${period}`, error, `${data ?? 0} ${t.payments.generated}`);
}

export async function recordPayment(slug: string, back: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("payments").insert({
    tenant_id: tenant.id, installment_id: str(fd, "installment_id"), student_id: str(fd, "student_id"),
    amount: num(fd, "amount"), method: str(fd, "method"), paid_on: str(fd, "paid_on"), reference: str(fd, "reference"),
    idempotency_key: str(fd, "idempotency_key"), corrects_payment_id: str(fd, "corrects_payment_id"),
  });
  return finish(back, error);
}

export async function voidPayment(slug: string, back: string, id: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("payments").update({ voided_at: new Date().toISOString(), void_reason: str(fd, "reason") }).eq("id", id).is("voided_at", null);
  return finish(back, error);
}

export async function setDiscount(slug: string, back: string, id: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("installments").update({ discount: num(fd, "discount") ?? 0 }).eq("id", id);
  return finish(back, error);
}
