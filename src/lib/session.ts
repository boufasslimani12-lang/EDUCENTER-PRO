import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Role = "admin" | "teacher";
export type TenantStatus =
  | "pending_setup" | "trial_active" | "subscription_active" | "renewal_pending" | "grace_period" | "suspended" | "archived";

export type Tenant = {
  id: string; name: string; slug: string; type: string; status: TenantStatus; trial_ends_at: string | null;
  current_period_end: string | null; billing_interval: string; grace_days: number; email: string | null;
  phone: string | null; address: string | null; city: string | null; logo_url: string | null;
  default_locale: string; currency: string; default_monthly_fee: number; modules: Record<string, boolean>;
  tenant_effective_status: TenantStatus;
};

export const OPERATIONAL: TenantStatus[] = ["trial_active", "subscription_active", "renewal_pending", "grace_period"];

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export const isPlatformAdmin = cache(async () => {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return !!data;
});

export const getMemberships = cache(async () => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("tenant_id, role, teacher_id, tenants(name, slug)")
    .eq("user_id", user.id)
    .eq("is_active", true);
  return (data ?? []) as unknown as { tenant_id: string; role: Role; teacher_id: string | null; tenants: { name: string; slug: string } }[];
});

/** Resolve the tenant workspace for a slug and the current user's role in it. */
export const getWorkspace = cache(async (slug: string) => {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("*, tenant_effective_status")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) notFound();
  const { data: m } = await supabase
    .from("memberships")
    .select("role, teacher_id")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!m) notFound();
  const t = tenant as Tenant;
  return {
    supabase, user, tenant: t, role: m.role as Role, teacherId: m.teacher_id as string | null,
    operational: OPERATIONAL.includes(t.tenant_effective_status),
  };
});

/** Admin of the workspace, regardless of subscription state (billing, settings read). */
export async function requireAdminAny(slug: string) {
  const ws = await getWorkspace(slug);
  if (ws.role !== "admin") notFound();
  return ws;
}

/** Any member of an operational (non-suspended) workspace. */
export async function requireOperational(slug: string) {
  const ws = await getWorkspace(slug);
  if (!ws.operational) redirect(`/t/${slug}`);
  return ws;
}

/** Admin of an operational workspace. */
export async function requireAdmin(slug: string) {
  const ws = await requireOperational(slug);
  if (ws.role !== "admin") notFound();
  return ws;
}

export async function getActiveYear(slug: string) {
  const { supabase, tenant } = await getWorkspace(slug);
  const { data } = await supabase.from("academic_years").select("*").eq("tenant_id", tenant.id).eq("is_active", true).maybeSingle();
  return data as { id: string; name: string; starts_on: string; ends_on: string } | null;
}

export type SP = Record<string, string | undefined>;
export type Props<P = object> = { params: Promise<{ slug: string } & P>; searchParams: Promise<SP> };
