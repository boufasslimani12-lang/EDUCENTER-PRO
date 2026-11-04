"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { buttonClass } from "./ui";

export function Submit({ children, variant = "primary", small, confirm }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; small?: boolean; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass(variant, small)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary") + " print:hidden"}>
      {label}
    </button>
  );
}

/** Select that submits its form on change (for filters). */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
    />
  );
}
