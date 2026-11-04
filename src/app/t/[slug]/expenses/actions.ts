"use server";
import { requireAdmin } from "@/lib/session";
import { finish, num, str } from "@/lib/actions";

export async function addExpense(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("expenses").insert({
    tenant_id: tenant.id, category_id: str(fd, "category_id"), amount: num(fd, "amount"), spent_on: str(fd, "spent_on"),
    beneficiary: str(fd, "beneficiary"), method: str(fd, "method"), reference: str(fd, "reference"), description: str(fd, "description"),
  });
  return finish(`/t/${slug}/expenses`, error);
}

export async function voidExpense(slug: string, id: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("expenses").update({ voided_at: new Date().toISOString(), void_reason: str(fd, "reason") }).eq("id", id);
  return finish(`/t/${slug}/expenses`, error);
}

export async function addCategory(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("expense_categories").insert({ tenant_id: tenant.id, name: str(fd, "name") });
  return finish(`/t/${slug}/expenses`, error);
}

export async function addMovement(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("cash_movements").insert({
    tenant_id: tenant.id, direction: str(fd, "direction"), amount: num(fd, "amount"), method: str(fd, "method"),
    occurred_on: str(fd, "occurred_on"), description: str(fd, "description"),
  });
  return finish(`/t/${slug}/cash`, error);
}
