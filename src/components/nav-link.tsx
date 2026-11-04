"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const path = usePathname();
  const root = href.split("/").length <= 3;
  const active = root ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`block rounded-lg px-3 py-1.5 text-sm ${active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
    >
      {children}
    </Link>
  );
}
