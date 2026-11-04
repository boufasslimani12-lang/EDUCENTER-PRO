"use server";
import { requireAdmin } from "@/lib/session";
import { finish, num, str } from "@/lib/actions";

export async function addEntry(slug: string, back: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const target = str(fd, "target") ?? "";
  const [kind, id] = target.split(":");
  const { data: year } = await supabase.from("academic_years").select("id").eq("tenant_id", tenant.id).eq("is_active", true).single();
  const { error } = await supabase.from("timetable_entries").insert({
    tenant_id: tenant.id, academic_year_id: year?.id, class_id: kind === "c" ? id : null, group_id: kind === "g" ? id : null,
    subject_id: str(fd, "subject_id"), teacher_id: str(fd, "teacher_id"), weekday: num(fd, "weekday"),
    starts_at: str(fd, "starts_at"), ends_at: str(fd, "ends_at"),
  });
  return finish(`/t/${slug}/timetable${back}`, error);
}

export async function deleteEntry(slug: string, back: string, id: string) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("timetable_entries").delete().eq("id", id);
  return finish(`/t/${slug}/timetable${back}`, error);
}
