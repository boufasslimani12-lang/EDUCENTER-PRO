import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getT } from "./i18n";

type PgError = { code?: string; message?: string } | null | undefined;

/** Translate a database error into a user-facing message. */
export async function errorMessage(err: PgError): Promise<string> {
  const { t } = await getT();
  if (!err) return "";
  const msg = err.message ?? "";
  if (err.code === "23P01") {
    if (msg.includes("timetable_teacher_overlap")) return t.timetable.teacherConflict;
    if (msg.includes("timetable_class_overlap")) return t.timetable.classConflict;
    if (msg.includes("timetable_group_overlap")) return t.timetable.groupConflict;
    return t.timetable.conflict;
  }
  if (err.code === "P0002" || msg.includes("exceeds outstanding")) return t.payments.exceeds;
  if (err.code === "P0003") return t.errors.classFull;
  if (err.code === "P0004") return t.errors.groupFull;
  if (err.code === "23505") {
    if (msg.includes("students_identity_uq")) return t.students.duplicate;
    if (msg.includes("idempotency_key")) return t.payments.duplicate;
    if (msg.includes("teacher_assignments_uq")) return t.errors.duplicateAssignment;
    if (msg.includes("remuneration_rules_uq")) return t.errors.duplicateRule;
    if (msg.includes("teachers_email_uq")) return t.errors.duplicateEmail;
    return t.errors.duplicateName;
  }
  if (err.code === "23503") return t.errors.inUse;
  if (err.code === "23514") return t.errors.invalidValue;
  if (err.code === "42501") return t.errors.accessDenied;
  return msg || t.errors.unexpected;
}

/** Redirect back to a page with a flash message in the query string. */
export async function finish(path: string, err?: PgError, okMsg?: string): Promise<never> {
  const sep = path.includes("?") ? "&" : "?";
  // Nothing changed on error: skip revalidation so the client simply re-renders the target with the message.
  if (err) redirect(`${path}${sep}error=${encodeURIComponent(await errorMessage(err))}`);
  revalidatePath(path.split("?")[0]);
  const { t } = await getT();
  redirect(`${path}${sep}ok=${encodeURIComponent(okMsg ?? t.common.saved)}`);
}

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function num(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s === null) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
