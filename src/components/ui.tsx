import Link from "next/link";
import { Icon, type IconName } from "./icons";
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, children, actions, className, bodyClassName }: {
  title?: ReactNode; description?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cx("rounded-2xl border border-slate-200/80 bg-white shadow-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={bodyClassName ?? "p-5"}>{children}</div>
    </section>
  );
}

const kpiTones = {
  brand: "bg-brand-50 text-brand-600",
  income: "bg-income-soft text-income",
  expense: "bg-expense-soft text-expense-strong",
  accent: "bg-accent-soft text-accent",
  warn: "bg-amber-50 text-amber-700",
  neutral: "bg-slate-100 text-slate-600",
};

/** Headline metric tile: icon, label, value and a short context line. */
export function KpiCard({ label, value, hint, icon, tone = "brand", href }: {
  label: string; value: ReactNode; hint?: ReactNode; icon: IconName; tone?: keyof typeof kpiTones; href?: string;
}) {
  const inner = (
    <div className="flex h-full items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition hover:border-slate-300">
      <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl", kpiTones[tone])}><Icon name={icon} className="h-5 w-5" /></span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-slate-500">{label}</div>
        <div className="mt-1 truncate text-[22px] font-semibold tabular-nums tracking-tight text-slate-900">{value}</div>
        {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{inner}</Link> : inner;
}

export function EmptyState({ icon = "inbox", title, action }: { icon?: IconName; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-400"><Icon name={icon} className="h-5 w-5" /></span>
      <p className="max-w-xs text-sm text-slate-500">{title}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-slate-200/70", className)} />;
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  const tones = { default: "text-slate-900", good: "text-emerald-700", warn: "text-amber-700", bad: "text-rose-700" };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
      <div className="text-[13px] font-medium text-slate-500">{label}</div>
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
          <tr className="border-b border-slate-200 bg-slate-50/60 text-start text-[11px] uppercase tracking-wider text-slate-500">
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
  return <td dir={dir} className={cx("whitespace-nowrap px-4 py-2.5 align-middle", className)}>{children}</td>;
}

const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 invalid:[&:not(:placeholder-shown)]:border-rose-400 disabled:bg-slate-50";

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
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100",
};
export const buttonClass = (v: keyof typeof btn = "primary", small = false) =>
  cx("inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50", small ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm", btn[v]);

export function ButtonLink({ href, children, variant = "primary", small, icon }: { href: string; children: ReactNode; variant?: keyof typeof btn; small?: boolean; icon?: IconName }) {
  if (icon) children = <><Icon name={icon} className="h-4 w-4" />{children}</>;
  if (href.includes("/export/")) return <a href={href} className={buttonClass(variant, small)}>{children}</a>;
  return <Link href={href} className={buttonClass(variant, small)}>{children}</Link>;
}

export function Flash({ sp }: { sp: { ok?: string; error?: string } }) {
  if (sp.error)
    return (
      <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /><span>{sp.error}</span>
      </div>
    );
  if (sp.ok)
    return (
      <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" /><span>{sp.ok}</span>
      </div>
    );
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
