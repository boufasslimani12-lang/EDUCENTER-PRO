import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Common reference data for the active academic year. */
export async function lookups(supabase: SupabaseClient, tenantId: string) {
  const [years, classes, groups, subjects, teachers, levels, methods] = await Promise.all([
    supabase.from("academic_years").select("id, name, is_active, starts_on, ends_on, archived_at").eq("tenant_id", tenantId).order("starts_on", { ascending: false }),
    supabase.from("classes").select("id, name, academic_year_id, level_id, levels(name)").eq("tenant_id", tenantId).order("name"),
    supabase.from("groups").select("id, name, academic_year_id, subject_id, level_id, monthly_fee").eq("tenant_id", tenantId).order("name"),
    supabase.from("subjects").select("id, name, coefficient, is_active").eq("tenant_id", tenantId).order("name"),
    supabase.from("teachers").select("id, full_name, email, phone, is_active").eq("tenant_id", tenantId).order("full_name"),
    supabase.from("levels").select("id, name, sort_order").eq("tenant_id", tenantId).order("sort_order"),
    supabase.from("payment_methods").select("id, name, is_active").eq("tenant_id", tenantId).eq("is_active", true).order("name"),
  ]);
  const yearList = (years.data ?? []) as any[];
  const active = yearList.find((y) => y.is_active) ?? null;
  const cls = (classes.data ?? []) as any[];
  const grp = (groups.data ?? []) as any[];
  return {
    years: yearList,
    activeYear: active as { id: string; name: string } | null,
    classes: cls,
    groups: grp,
    activeClasses: active ? cls.filter((c) => c.academic_year_id === active.id) : [],
    activeGroups: active ? grp.filter((g) => g.academic_year_id === active.id) : [],
    subjects: (subjects.data ?? []) as any[],
    teachers: (teachers.data ?? []) as any[],
    levels: (levels.data ?? []) as any[],
    methods: (methods.data ?? []) as any[],
  };
}

export function sanitizeSearch(q: string) {
  return q.replace(/[,()*%\\]/g, " ").trim().slice(0, 60);
}
