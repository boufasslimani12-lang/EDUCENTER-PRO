"use server";
import { randomUUID } from "crypto";
import { requireAdmin, requireAdminAny } from "@/lib/session";
import { finish, num, str } from "@/lib/actions";
import { getT } from "@/lib/i18n";
import { MODULES } from "@/lib/modules";


export async function saveInstitution(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const modules = Object.fromEntries(MODULES.map((m) => [m, fd.get(`mod_${m}`) === "on"]));
  const { error } = await supabase.from("tenants").update({
    name: str(fd, "name"), email: str(fd, "email"), phone: str(fd, "phone"), address: str(fd, "address"), city: str(fd, "city"),
    logo_url: str(fd, "logo_url"), default_locale: str(fd, "default_locale"), default_monthly_fee: num(fd, "default_monthly_fee") ?? 0, modules,
  }).eq("id", tenant.id);
  return finish(`/t/${slug}/settings`, error);
}

export async function addNamed(slug: string, table: "payment_methods" | "document_requirements", fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from(table).insert({ tenant_id: tenant.id, name: str(fd, "name") });
  return finish(`/t/${slug}/settings`, error);
}

export async function toggleNamed(slug: string, table: "payment_methods" | "document_requirements", id: string, active: boolean) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from(table).update({ is_active: active }).eq("id", id);
  return finish(`/t/${slug}/settings`, error);
}

export async function toggleMember(slug: string, id: string, active: boolean) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("memberships").update({ is_active: active }).eq("id", id);
  return finish(`/t/${slug}/settings`, error);
}

export async function grantSupport(slug: string, fd: FormData) {
  const { supabase, tenant, user } = await requireAdminAny(slug);
  const { error } = await supabase.from("support_access_grants").insert({
    tenant_id: tenant.id, granted_by: user.id, reason: str(fd, "reason"), expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  });
  return finish(`/t/${slug}/settings`, error);
}

export async function revokeSupport(slug: string, id: string) {
  const { supabase } = await requireAdminAny(slug);
  const { error } = await supabase.from("support_access_grants").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  return finish(`/t/${slug}/settings`, error);
}

export async function declarePayment(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdminAny(slug);
  const { t } = await getT();
  const file = fd.get("proof");
  let proof_path: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) return finish(`/t/${slug}/billing`, { message: "Max 5 MB" });
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) return finish(`/t/${slug}/billing`, { message: "PDF, PNG, JPG, WEBP" });
    const ext = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin";
    proof_path = `${tenant.id}/${randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("subscription-proofs").upload(proof_path, file, { contentType: file.type });
    if (upErr) return finish(`/t/${slug}/billing`, { message: upErr.message });
  }
  const { error } = await supabase.from("subscription_payments").insert({
    tenant_id: tenant.id, amount: num(fd, "amount"), period_months: num(fd, "period_months"), method: "bank_transfer",
    reference: str(fd, "reference"), proof_path,
  });
  return finish(`/t/${slug}/billing`, error, t.billing.submitted);
}
