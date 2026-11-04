import Link from "next/link";
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="font-medium text-slate-800">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  const tones = { default: "text-slate-900", good: "text-emerald-700", warn: "text-amber-700", bad: "text-rose-700" };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={cx("mt-1 text-2xl font-semibold tabular-nums", tones[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
};
export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: keyof typeof badgeTones }) {
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", badgeTones[tone])}>{children}</span>;
}

export const statusTone = (s: string): keyof typeof badgeTones =>
  ({
    paid: "green", approved: "green", present: "green", subscription_active: "green", active: "green",
    partial: "amber", late: "amber", renewal_pending: "amber", grace_period: "amber", pending: "amber", trial_active: "blue", unpaid: "gray",
    overdue: "red", overdue_partial: "red", absent: "red", suspended: "red", rejected: "red", voided: "red",
  })[s] ?? "gray";

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string | false }) {
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-start text-xs uppercase tracking-wide text-slate-500">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-2 text-start font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-6 text-center text-sm text-slate-500">{empty}</p>}
    </div>
  );
}

export function Td({ children, className, dir }: { children?: ReactNode; className?: string; dir?: string }) {
  return <td dir={dir} className={cx("whitespace-nowrap px-4 py-2 align-middle", className)}>{children}</td>;
}

const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50";

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputCls, props.className)} />;
}

const btn = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  ghost: "text-slate-600 hover:bg-slate-100",
};
export const buttonClass = (v: keyof typeof btn = "primary", small = false) =>
  cx("inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50", small ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm", btn[v]);

export function ButtonLink({ href, children, variant = "primary", small }: { href: string; children: ReactNode; variant?: keyof typeof btn; small?: boolean }) {
  if (href.includes("/export/")) return <a href={href} className={buttonClass(variant, small)}>{children}</a>;
  return <Link href={href} className={buttonClass(variant, small)}>{children}</Link>;
}

export function Flash({ sp }: { sp: { ok?: string; error?: string } }) {
  if (sp.error) return <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{sp.error}</div>;
  if (sp.ok) return <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{sp.ok}</div>;
  return null;
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return <div className={cx("grid grid-cols-1 gap-4", c)}>{children}</div>;
}

export function Pagination({ page, pages, hrefFor, t }: { page: number; pages: number; hrefFor: (p: number) => string; t: { previous: string; next: string; page: string; of: string } }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-slate-500">{t.page} {page} {t.of} {pages}</span>
      <div className="flex gap-2">
        {page > 1 && <ButtonLink variant="secondary" small href={hrefFor(page - 1)}>{t.previous}</ButtonLink>}
        {page < pages && <ButtonLink variant="secondary" small href={hrefFor(page + 1)}>{t.next}</ButtonLink>}
      </div>
    </div>
  );
}

export function Bars({ data, format }: { data: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-44 items-end gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1" title={format(d.value)}>
          <span className="text-[10px] tabular-nums text-slate-500">{format(d.value)}</span>
          <div className="w-full rounded-t-md bg-brand-500/80" style={{ height: `${Math.max(2, (d.value / max) * 120)}px` }} />
          <span className="text-xs text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
