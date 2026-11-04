"use server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n";

export async function setLocale(formData: FormData) {
  const v = formData.get("locale") === "ar" ? "ar" : "fr";
  (await cookies()).set(LOCALE_COOKIE, v, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
