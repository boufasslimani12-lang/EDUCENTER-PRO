"use server";
import { requireAdmin } from "@/lib/session";
import { finish, num, str } from "@/lib/actions";

export async function addYear(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("academic_years").insert({
    tenant_id: tenant.id, name: str(fd, "name"), starts_on: str(fd, "starts_on"), ends_on: str(fd, "ends_on"),
  });
  return finish(`/t/${slug}/structure`, error);
}

export async function activateYear(slug: string, id: string) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error: e1 } = await supabase.from("academic_years").update({ is_active: false }).eq("tenant_id", tenant.id).eq("is_active", true);
  if (e1) return finish(`/t/${slug}/structure`, e1);
  const { error } = await supabase.from("academic_years").update({ is_active: true, archived_at: null }).eq("id", id);
  return finish(`/t/${slug}/structure`, error);
}

export async function archiveYear(slug: string, id: string) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("academic_years").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("is_active", false);
  return finish(`/t/${slug}/structure`, error);
}

export async function addLevel(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("levels").insert({ tenant_id: tenant.id, name: str(fd, "name"), sort_order: num(fd, "sort_order") ?? 0 });
  return finish(`/t/${slug}/structure`, error);
}

export async function deleteLevel(slug: string, id: string) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("levels").delete().eq("id", id);
  return finish(`/t/${slug}/structure`, error);
}

export async function addClass(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("classes").insert({
    tenant_id: tenant.id, name: str(fd, "name"), level_id: str(fd, "level_id"), academic_year_id: str(fd, "academic_year_id"),
  });
  return finish(`/t/${slug}/structure`, error);
}

export async function deleteClass(slug: string, id: string) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("classes").delete().eq("id", id);
  return finish(`/t/${slug}/structure`, error);
}

export async function addGroup(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("groups").insert({
    tenant_id: tenant.id, name: str(fd, "name"), academic_year_id: str(fd, "academic_year_id"),
    subject_id: str(fd, "subject_id"), level_id: str(fd, "level_id"), monthly_fee: num(fd, "monthly_fee"),
  });
  return finish(`/t/${slug}/groups`, error);
}

export async function updateGroupFee(slug: string, id: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("groups").update({ monthly_fee: num(fd, "monthly_fee"), name: str(fd, "name") }).eq("id", id);
  return finish(`/t/${slug}/groups`, error);
}

export async function deleteGroup(slug: string, id: string) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("groups").delete().eq("id", id);
  return finish(`/t/${slug}/groups`, error);
}

export async function addSubject(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("subjects").insert({ tenant_id: tenant.id, name: str(fd, "name"), coefficient: num(fd, "coefficient") });
  return finish(`/t/${slug}/subjects`, error);
}

export async function toggleSubject(slug: string, id: string, active: boolean) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("subjects").update({ is_active: active }).eq("id", id);
  return finish(`/t/${slug}/subjects`, error);
}

export async function deleteSubject(slug: string, id: string) {
  const { supabase } = await requireAdmin(slug);
  // FK constraints keep historical grades valid: a subject in use cannot be deleted, only deactivated.
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  return finish(`/t/${slug}/subjects`, error);
}
