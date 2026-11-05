"use server";
import { requireAdmin } from "@/lib/session";
import { finish, num, str } from "@/lib/actions";
import { getT } from "@/lib/i18n";

const safe = (slug: string, back: string) => (back.startsWith(`/t/${slug}/timetable`) && !back.includes("//") ? back : `/t/${slug}/timetable`);

async function fields(fd: FormData) {
  const { t } = await getT();
  const target = str(fd, "target") ?? "";
  const [kind, id] = target.split(":");
  const starts = str(fd, "starts_at"), ends = str(fd, "ends_at");
  if (!starts || !ends || ends <= starts) return { error: { message: t.timetable.endAfterStart } };
  return {
    row: {
      class_id: kind === "c" ? id : null, group_id: kind === "g" ? id : null,
      subject_id: str(fd, "subject_id"), teacher_id: str(fd, "teacher_id"), weekday: num(fd, "weekday"),
      starts_at: starts, ends_at: ends, room: str(fd, "room"),
    },
  };
}

export async function addEntry(slug: string, back: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const f = await fields(fd);
  if (f.error) return finish(safe(slug, back), f.error);
  const { data: year } = await supabase.from("academic_years").select("id").eq("tenant_id", tenant.id).eq("is_active", true).single();
  const { error } = await supabase.from("timetable_entries").insert({ tenant_id: tenant.id, academic_year_id: year?.id, ...f.row });
  return finish(safe(slug, back), error);
}

export async function updateEntry(slug: string, back: string, id: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const f = await fields(fd);
  if (f.error) return finish(safe(slug, back), f.error);
  const { error } = await supabase.from("timetable_entries").update(f.row).eq("id", id);
  return finish(safe(slug, back).replace(/([?&])edit=[^&]*&?/, "$1").replace(/[?&]$/, ""), error);
}

export async function deleteEntry(slug: string, back: string, id: string) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("timetable_entries").delete().eq("id", id);
  return finish(safe(slug, back).replace(/([?&])edit=[^&]*&?/, "$1").replace(/[?&]$/, ""), error);
}
