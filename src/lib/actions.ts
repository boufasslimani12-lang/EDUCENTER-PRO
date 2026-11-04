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
  if (err.code === "23P01") return t.timetable.conflict;
  if (err.code === "P0002" || msg.includes("exceeds outstanding")) return t.payments.exceeds;
  if (err.code === "23505") {
    if (msg.includes("students_identity_uq")) return t.students.duplicate;
    if (msg.includes("idempotency_key")) return t.payments.duplicate;
    return msg.includes("duplicate") ? `Doublon : ${msg.replace(/^.*constraint "?([^"]+)"?.*$/, "$1")}` : msg;
  }
  if (err.code === "42501") return "Accès refusé.";
  return msg || "Erreur inattendue.";
}

/** Redirect back to a page with a flash message in the query string. */
export async function finish(path: string, err?: PgError, okMsg?: string): Promise<never> {
  revalidatePath(path.split("?")[0]);
  const sep = path.includes("?") ? "&" : "?";
  if (err) redirect(`${path}${sep}error=${encodeURIComponent(await errorMessage(err))}`);
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
