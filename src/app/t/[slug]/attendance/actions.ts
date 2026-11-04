"use server";
import { requireOperational } from "@/lib/session";
import { finish, str } from "@/lib/actions";
import { scopesFor, parseScope } from "@/lib/scopes";

export async function saveAttendance(slug: string, fd: FormData) {
  const { supabase, tenant, role, teacherId } = await requireOperational(slug);
  const scopes = await scopesFor(supabase, tenant.id, role, teacherId);
  const scopeKey = str(fd, "scope") ?? "";
  const scope = parseScope(scopeKey, scopes);
  const day = str(fd, "date");
  const back = `/t/${slug}/attendance?scope=${encodeURIComponent(scopeKey)}&date=${day}`;
  if (!scope || !day) return finish(back, { message: "Scope/date required" });

  let existingQ = supabase.from("attendance_records").select("id, student_id").eq("session_date", day).is("timetable_entry_id", null);
  existingQ = scope.class_id ? existingQ.eq("class_id", scope.class_id) : existingQ.eq("group_id", scope.group_id!);
  const { data: existing } = await existingQ;
  const byStudent = new Map((existing ?? []).map((e: any) => [e.student_id, e.id]));

  for (const sid of fd.getAll("student").map(String)) {
    const status = str(fd, `status_${sid}`) ?? "present";
    const late = status === "late" ? Number(str(fd, `late_${sid}`) ?? 0) || null : null;
    const row = { status, minutes_late: late, note: str(fd, `note_${sid}`) };
    const id = byStudent.get(sid);
    const { error } = id
      ? await supabase.from("attendance_records").update(row).eq("id", id)
      : await supabase.from("attendance_records").insert({ ...row, tenant_id: tenant.id, session_date: day, class_id: scope.class_id, group_id: scope.group_id, student_id: sid });
    if (error) return finish(back, error);
  }
  return finish(back);
}
