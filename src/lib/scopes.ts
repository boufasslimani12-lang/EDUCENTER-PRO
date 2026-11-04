import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Scope = { key: string; name: string; class_id: string | null; group_id: string | null };

/** Classes/groups the current user may work with (all for admins, assigned for teachers). */
export async function scopesFor(supabase: SupabaseClient, tenantId: string, role: "admin" | "teacher", teacherId: string | null): Promise<Scope[]> {
  if (role === "admin") {
    const [{ data: c }, { data: g }] = await Promise.all([
      supabase.from("classes").select("id, name, academic_years!inner(is_active)").eq("tenant_id", tenantId).eq("academic_years.is_active", true).order("name"),
      supabase.from("groups").select("id, name, academic_years!inner(is_active)").eq("tenant_id", tenantId).eq("academic_years.is_active", true).order("name"),
    ]);
    return [
      ...(c ?? []).map((x: any) => ({ key: `c:${x.id}`, name: x.name, class_id: x.id, group_id: null })),
      ...(g ?? []).map((x: any) => ({ key: `g:${x.id}`, name: x.name, class_id: null, group_id: x.id })),
    ];
  }
  const { data } = await supabase.from("teacher_assignments").select("class_id, group_id, classes(name), groups(name)").eq("teacher_id", teacherId ?? "");
  const map = new Map<string, Scope>();
  for (const a of (data ?? []) as any[]) {
    const key = a.class_id ? `c:${a.class_id}` : `g:${a.group_id}`;
    map.set(key, { key, name: a.classes?.name ?? a.groups?.name ?? "?", class_id: a.class_id, group_id: a.group_id });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function parseScope(key: string | undefined, scopes: Scope[]) {
  return scopes.find((s) => s.key === key) ?? null;
}

export type RosterStudent = { id: string; first_name: string; last_name: string };

export async function roster(supabase: SupabaseClient, scope: Scope): Promise<RosterStudent[]> {
  let rows: any[] = [];
  if (scope.class_id) {
    const { data } = await supabase.from("enrollments").select("students(id, first_name, last_name, archived_at)").eq("class_id", scope.class_id).eq("status", "active");
    rows = (data ?? []).map((r: any) => r.students);
  } else if (scope.group_id) {
    const { data } = await supabase.from("student_groups").select("enrollments!inner(status, students(id, first_name, last_name, archived_at))").eq("group_id", scope.group_id).eq("enrollments.status", "active");
    rows = (data ?? []).map((r: any) => r.enrollments?.students);
  }
  return rows.filter((s) => s && !s.archived_at).sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));
}
