"use server";
import { requireAdmin } from "@/lib/session";
import { finish, str } from "@/lib/actions";
import { getT } from "@/lib/i18n";

const TABS = new Set(["profile", "assignments", "schedule", "attendance", "pay"]);
const teacherPath = (slug: string, id: string, tab?: string | null) =>
  `/t/${slug}/teachers/${id}${tab && TABS.has(tab) && tab !== "profile" ? `?tab=${tab}` : ""}`;

/** Only same-workspace paths are accepted as a post-action destination (no open redirect). */
const safeBack = (slug: string, back: string | null | undefined) =>
  back && back.startsWith(`/t/${slug}/`) && !back.includes("//") ? back : null;

function teacherFields(fd: FormData) {
  return {
    full_name: str(fd, "full_name"),
    email: str(fd, "email")?.toLowerCase() ?? null,
    phone: str(fd, "phone"),
    specialization: str(fd, "specialization"),
    hire_date: str(fd, "hire_date"),
    notes: str(fd, "notes"),
  };
}

export async function addTeacher(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { data, error } = await supabase.from("teachers").insert({ tenant_id: tenant.id, ...teacherFields(fd) }).select("id").single();
  if (error) return finish(`/t/${slug}/teachers/new`, error);
  return finish(teacherPath(slug, data.id, "assignments"));
}

export async function updateTeacher(slug: string, id: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("teachers").update(teacherFields(fd)).eq("id", id);
  return finish(teacherPath(slug, id), error);
}

/** Archive (deactivate teacher and their login membership) or restore. History is kept. */
export async function setTeacherActive(slug: string, id: string, active: boolean) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("teachers").update({ is_active: active }).eq("id", id);
  if (!error) await supabase.from("memberships").update({ is_active: active }).eq("teacher_id", id);
  return finish(teacherPath(slug, id), error);
}

export async function inviteTeacher(slug: string, id: string) {
  const { supabase } = await requireAdmin(slug);
  const { t } = await getT();
  const { error } = await supabase.rpc("invite_teacher", { p_teacher_id: id });
  return finish(teacherPath(slug, id), error, t.teachers.invited);
}

export async function addAssignment(slug: string, id: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const target = str(fd, "target") ?? "";
  const [kind, tid] = target.split(":");
  const { error } = await supabase.from("teacher_assignments").insert({
    tenant_id: tenant.id, teacher_id: id, subject_id: str(fd, "subject_id"),
    class_id: kind === "c" ? tid : null, group_id: kind === "g" ? tid : null,
  });
  return finish(safeBack(slug, str(fd, "back")) ?? teacherPath(slug, id, "assignments"), error);
}

export async function removeAssignment(slug: string, teacherId: string, id: string, fd?: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("teacher_assignments").delete().eq("id", id);
  return finish(safeBack(slug, fd ? str(fd, "back") : null) ?? teacherPath(slug, teacherId, "assignments"), error);
}

/** Assign a teacher (chosen in the form) to a fixed class or group, from that class/group page. */
export async function assignToTarget(slug: string, target: string, back: string, fd: FormData) {
  const teacherId = str(fd, "teacher_id");
  if (!teacherId || !/^[cg]:[0-9a-f-]{36}$/.test(target)) return finish(safeBack(slug, back) ?? `/t/${slug}/teachers`, { code: "23514" });
  fd.set("target", target);
  fd.set("back", back);
  return addAssignment(slug, teacherId, fd);
}
