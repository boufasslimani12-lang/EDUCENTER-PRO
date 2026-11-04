"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/session";
import { finish, num, str } from "@/lib/actions";
import { getT } from "@/lib/i18n";

async function guard() {
  if (!(await isPlatformAdmin())) redirect("/");
  return createClient();
}

export async function createInstitution(fd: FormData) {
  const supabase = await guard();
  const { t } = await getT();
  const { data, error } = await supabase.rpc("provision_tenant", {
    p_name: str(fd, "name"), p_slug: str(fd, "slug")?.toLowerCase(), p_type: str(fd, "type"),
    p_admin_email: str(fd, "admin_email")?.toLowerCase(), p_trial_days: num(fd, "trial_days") ?? 7, p_locale: str(fd, "locale") ?? "fr",
  });
  if (error) return finish("/platform/institutions", error);
  return finish(`/platform/institutions/${data}`, null, t.platform.created);
}

export async function updateLifecycle(id: string, op: "suspend" | "reactivate" | "extend" | "archive" | "period", fd?: FormData) {
  const supabase = await guard();
  const { data: tn } = await supabase.from("tenants").select("trial_ends_at, current_period_end, status").eq("id", id).single();
  let patch: Record<string, unknown> = {};
  if (op === "suspend") patch = { status: "suspended" };
  if (op === "archive") patch = { status: "archived" };
  if (op === "reactivate") patch = { status: tn?.current_period_end && new Date(tn.current_period_end) > new Date() ? "subscription_active" : "trial_active" };
  if (op === "extend") {
    const base = Math.max(Date.now(), tn?.trial_ends_at ? new Date(tn.trial_ends_at).getTime() : 0);
    patch = { status: "trial_active", trial_ends_at: new Date(base + 7 * 86400000).toISOString() };
  }
  if (op === "period" && fd) patch = { status: "subscription_active", current_period_end: str(fd, "period_end"), grace_days: num(fd, "grace_days") ?? 7 };
  const { error } = await supabase.from("tenants").update(patch).eq("id", id);
  return finish(`/platform/institutions/${id}`, error);
}

export async function review(id: string, approve: boolean, fd: FormData) {
  const supabase = await guard();
  const { error } = await supabase.rpc("review_subscription_payment", { p_id: id, p_approve: approve, p_note: str(fd, "note") });
  return finish("/platform/payments", error);
}
