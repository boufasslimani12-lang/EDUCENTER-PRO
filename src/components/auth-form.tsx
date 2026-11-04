"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buttonClass } from "./ui";

type Mode = "login" | "signup" | "forgot" | "reset";
type Labels = Record<string, string>;

export function AuthForm({ mode, l }: { mode: Mode; l: Labels }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    const supabase = createClient();
    const origin = window.location.origin;
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(l.invalid);
        const next = params.get("next");
        router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
        router.refresh();
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${origin}/auth/callback`, data: { full_name: fd.get("full_name") } },
        });
        if (error) throw error;
        setInfo(l.checkEmail);
      } else if (mode === "forgot") {
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/auth/reset` });
        setInfo(l.resetSent);
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        router.replace("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const input = "block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "signup" && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{l.fullName}</span>
          <input name="full_name" required className={input} autoComplete="name" />
        </label>
      )}
      {mode !== "reset" && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{l.email}</span>
          <input name="email" type="email" required className={input} autoComplete="email" dir="ltr" />
        </label>
      )}
      {mode !== "forgot" && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{mode === "reset" ? l.newPassword : l.password}</span>
          <input name="password" type="password" required minLength={8} className={input} autoComplete={mode === "login" ? "current-password" : "new-password"} dir="ltr" />
        </label>
      )}
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {info && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}
      <button disabled={busy} className={buttonClass("primary") + " w-full"}>{busy ? "…" : l.submit}</button>
      <div className="flex flex-col gap-1 text-center text-sm">
        {mode === "login" && (
          <>
            <Link className="text-brand-600 hover:underline" href="/signup">{l.noAccount}</Link>
            <Link className="text-slate-500 hover:underline" href="/forgot-password">{l.forgot}</Link>
          </>
        )}
        {mode !== "login" && <Link className="text-brand-600 hover:underline" href="/login">{l.haveAccount}</Link>}
      </div>
    </form>
  );
}
