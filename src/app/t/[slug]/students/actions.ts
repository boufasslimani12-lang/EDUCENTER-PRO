"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { finish, num, str } from "@/lib/actions";

function studentFields(fd: FormData) {
  return {
    first_name: str(fd, "first_name"),
    last_name: str(fd, "last_name"),
    code: str(fd, "code"),
    birth_date: str(fd, "birth_date"),
    gender: str(fd, "gender"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    address: str(fd, "address"),
    guardian_name: str(fd, "guardian_name"),
    guardian_phone: str(fd, "guardian_phone"),
    guardian_relation: str(fd, "guardian_relation"),
    notes: str(fd, "notes"),
  };
}

export async function createStudent(slug: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const { data, error } = await supabase.from("students").insert({ tenant_id: tenant.id, ...studentFields(fd) }).select("id").single();
  if (error) return finish(`/t/${slug}/students/new`, error);
  const year = str(fd, "academic_year_id");
  if (year) {
    const groups = fd.getAll("groups").map(String).filter(Boolean);
    const { error: e2 } = await supabase.rpc("reenroll_student", {
      p_student: data.id, p_year: year, p_class: str(fd, "class_id"),
      p_fee: num(fd, "monthly_fee") ?? 0, p_discount: num(fd, "monthly_discount") ?? 0, p_groups: groups,
    });
    if (e2) return finish(`/t/${slug}/students/${data.id}`, e2);
  }
  return finish(`/t/${slug}/students/${data.id}`);
}

export async function updateStudent(slug: string, id: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("students").update(studentFields(fd)).eq("id", id);
  return finish(`/t/${slug}/students/${id}`, error);
}

export async function setArchived(slug: string, id: string, archived: boolean) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("students").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
  return finish(`/t/${slug}/students/${id}`, error);
}

export async function enroll(slug: string, id: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const groups = fd.getAll("groups").map(String).filter(Boolean);
  const { error } = await supabase.rpc("reenroll_student", {
    p_student: id, p_year: str(fd, "academic_year_id"), p_class: str(fd, "class_id"),
    p_fee: num(fd, "monthly_fee") ?? 0, p_discount: num(fd, "monthly_discount") ?? 0, p_groups: groups,
  });
  return finish(`/t/${slug}/students/${id}`, error);
}

export async function withdraw(slug: string, enrollmentId: string, studentId: string) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.from("enrollments").update({ status: "withdrawn" }).eq("id", enrollmentId);
  return finish(`/t/${slug}/students/${studentId}`, error);
}

export async function saveDocuments(slug: string, id: string, fd: FormData) {
  const { supabase, tenant } = await requireAdmin(slug);
  const reqs = fd.getAll("req").map(String);
  const received = new Set(fd.getAll("received").map(String));
  const rows = reqs.map((r) => ({
    tenant_id: tenant.id, student_id: id, requirement_id: r, received: received.has(r),
    received_on: received.has(r) ? new Date().toISOString().slice(0, 10) : null,
  }));
  const { error } = await supabase.from("student_documents").upsert(rows, { onConflict: "student_id,requirement_id" });
  return finish(`/t/${slug}/students/${id}`, error);
}

export async function search(slug: string, fd: FormData) {
  const q = new URLSearchParams();
  for (const k of ["q", "class", "archived"]) { const v = str(fd, k); if (v) q.set(k, v); }
  redirect(`/t/${slug}/students?${q}`);
}
