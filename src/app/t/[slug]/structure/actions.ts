"use server";
import { requireAdmin } from "@/lib/session";
import { finish, num, str } from "@/lib/actions";

/** Post-action destination: a same-workspace path from the form, else the module default. */
function dest(slug: string, fd: FormData | undefined, fallback: string) {
  const back = fd ? str(fd, "back") : null;
  return back && back.startsWith(`/t/${slug}/`) && !back.includes("//") ? back : `/t/${slug}${fallback}`;
}
const posInt = (fd: FormData, k: string) => { const n = num(fd, k); return n && n > 0 ? Math.floor(n) : null; };

// ── Academic years ──
export async function addYear(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("academic_years").insert({ tenant_id: tenant.id, name: str(fd, "name"), starts_on: str(fd, "starts_on"), ends_on: str(fd, "ends_on") });
  return finish(dest(slug, fd, "/structure"), error);
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

// ── Levels ──
export async function addLevel(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("levels").insert({ tenant_id: tenant.id, name: str(fd, "name"), sort_order: num(fd, "sort_order") ?? 0 });
  return finish(dest(slug, fd, "/structure?tab=levels"), error);
}
export async function updateLevel(slug: string, id: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("levels").update({ name: str(fd, "name"), sort_order: num(fd, "sort_order") ?? 0 }).eq("id", id);
  return finish(dest(slug, fd, "/structure?tab=levels"), error);
}
export async function deleteLevel(slug: string, id: string, fd?: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("levels").delete().eq("id", id);
  return finish(dest(slug, fd, "/structure?tab=levels"), error);
}

// ── Classes ──
export async function addClass(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("classes").insert({
    tenant_id: tenant.id, name: str(fd, "name"), level_id: str(fd, "level_id"), academic_year_id: str(fd, "academic_year_id"), capacity: posInt(fd, "capacity"),
  });
  return finish(dest(slug, fd, "/structure?tab=classes"), error);
}
export async function updateClass(slug: string, id: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("classes").update({ name: str(fd, "name"), level_id: str(fd, "level_id"), capacity: posInt(fd, "capacity") }).eq("id", id);
  return finish(dest(slug, fd, "/structure?tab=classes"), error);
}
export async function deleteClass(slug: string, id: string, fd?: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("classes").delete().eq("id", id);
  return finish(dest(slug, fd, "/structure?tab=classes"), error);
}

// ── Groups ──
function groupFields(fd: FormData) {
  return { name: str(fd, "name"), subject_id: str(fd, "subject_id"), level_id: str(fd, "level_id"), monthly_fee: num(fd, "monthly_fee"), capacity: posInt(fd, "capacity") };
}
export async function addGroup(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("groups").insert({ tenant_id: tenant.id, academic_year_id: str(fd, "academic_year_id"), ...groupFields(fd) });
  return finish(dest(slug, fd, "/groups"), error);
}
export async function updateGroup(slug: string, id: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("groups").update(groupFields(fd)).eq("id", id);
  return finish(dest(slug, fd, "/groups"), error);
}
export async function deleteGroup(slug: string, id: string, fd?: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("groups").delete().eq("id", id);
  return finish(dest(slug, fd, "/groups"), error);
}
/** Add an enrolled student (active-year enrollment) to a group; capacity is enforced by the database. */
export async function addStudentToGroup(slug: string, groupId: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("student_groups").insert({ tenant_id: tenant.id, enrollment_id: str(fd, "enrollment_id"), group_id: groupId });
  return finish(dest(slug, fd, `/groups/${groupId}`), error);
}
export async function removeStudentFromGroup(slug: string, groupId: string, id: string) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("student_groups").delete().eq("id", id).eq("group_id", groupId);
  return finish(`/t/${slug}/groups/${groupId}`, error);
}

// ── Subjects ──
function subjectFields(fd: FormData) {
  return { name: str(fd, "name"), coefficient: num(fd, "coefficient"), description: str(fd, "description") };
}
export async function addSubject(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { error } = await supabase.from("subjects").insert({ tenant_id: tenant.id, ...subjectFields(fd) });
  return finish(dest(slug, fd, "/subjects"), error);
}
export async function updateSubject(slug: string, id: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("subjects").update(subjectFields(fd)).eq("id", id);
  return finish(dest(slug, fd, "/subjects"), error);
}
export async function toggleSubject(slug: string, id: string, active: boolean) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("subjects").update({ is_active: active }).eq("id", id);
  return finish(`/t/${slug}/subjects`, error);
}
export async function deleteSubject(slug: string, id: string) {
  const { supabase } = await requireAdmin(slug);
  // Foreign keys keep historical grades and sessions valid: a subject in use cannot be deleted, only deactivated.
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  return finish(`/t/${slug}/subjects`, error);
}
