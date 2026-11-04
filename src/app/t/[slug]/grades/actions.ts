"use server";
import { requireOperational } from "@/lib/session";
import { finish, num, str } from "@/lib/actions";
import { scopesFor, parseScope } from "@/lib/scopes";

export async function addAssessment(slug: string, fd: FormData) {
  const { supabase, tenant, role, teacherId } = await requireOperational(slug);
  const scopes = await scopesFor(supabase, tenant.id, role, teacherId);
  const scopeKey = str(fd, "scope") ?? "";
  const scope = parseScope(scopeKey, scopes);
  const back = `/t/${slug}/grades?scope=${encodeURIComponent(scopeKey)}`;
  if (!scope) return finish(back, { message: "Scope required" });
  const { data: year } = await supabase.from("academic_years").select("id").eq("tenant_id", tenant.id).eq("is_active", true).single();
  const { data, error } = await supabase.from("assessments").insert({
    tenant_id: tenant.id, academic_year_id: year?.id, subject_id: str(fd, "subject_id"), class_id: scope.class_id, group_id: scope.group_id,
    title: str(fd, "title"), held_on: str(fd, "held_on"), max_score: num(fd, "max_score") ?? 20, coefficient: num(fd, "coefficient") ?? 1,
  }).select("id").single();
  if (error) return finish(back, error);
  return finish(`${back}&a=${data.id}`);
}

export async function saveGrades(slug: string, assessmentId: string, back: string, fd: FormData) {
  const { supabase, tenant } = await requireOperational(slug);
  const rows = fd.getAll("student").map(String).map((sid) => ({
    tenant_id: tenant.id, assessment_id: assessmentId, student_id: sid,
    score: num(fd, `score_${sid}`), observation: str(fd, `obs_${sid}`), updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("grades").upsert(rows, { onConflict: "assessment_id,student_id" });
  return finish(back, error);
}
