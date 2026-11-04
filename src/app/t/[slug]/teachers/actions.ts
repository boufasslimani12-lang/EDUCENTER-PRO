"use server";
import { requireAdmin } from "@/lib/session";
import { finish, str } from "@/lib/actions";
import { getT } from "@/lib/i18n";

export async function addTeacher(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const email = str(fd, "email")?.toLowerCase() ?? null;
  const { data, error } = await supabase.from("teachers")
    .insert({ tenant_id: tenant.id, full_name: str(fd, "full_name"), email, phone: str(fd, "phone") }).select("id").single();
  if (error) return finish(`/t/${slug}/teachers`, error);
  return finish(`/t/${slug}/teachers/${data.id}`);
}

export async function updateTeacher(slug: string, id: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("teachers").update({
    full_name: str(fd, "full_name"), email: str(fd, "email")?.toLowerCase() ?? null, phone: str(fd, "phone"), is_active: fd.get("is_active") === "on",
  }).eq("id", id);
  if (!error && fd.get("is_active") !== "on") {
    await supabase.from("memberships").update({ is_active: false }).eq("teacher_id", id);
  }
  return finish(`/t/${slug}/teachers/${id}`, error);
}

export async function inviteTeacher(slug: string, id: string) {
  const { supabase } = await requireAdmin(slug);
  const { t } = await getT();
  const { error } = await supabase.rpc("invite_teacher", { p_teacher_id: id });
  return finish(`/t/${slug}/teachers/${id}`, error, t.teachers.invited);
}

export async function addAssignment(slug: string, id: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const target = str(fd, "target") ?? "";
  const [kind, tid] = target.split(":");
  const { error } = await supabase.from("teacher_assignments").insert({
    tenant_id: tenant.id, teacher_id: id, subject_id: str(fd, "subject_id"),
    class_id: kind === "c" ? tid : null, group_id: kind === "g" ? tid : null,
  });
  return finish(`/t/${slug}/teachers/${id}`, error);
}

export async function removeAssignment(slug: string, teacherId: string, id: string) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("teacher_assignments").delete().eq("id", id);
  return finish(`/t/${slug}/teachers/${teacherId}`, error);
}
