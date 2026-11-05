import Link from "next/link";
import { Icon, type IconName } from "./icons";
import { cx, buttonClass, type ButtonVariant } from "./styles";
import { Toast } from "./client";

export { cx, buttonClass };
import { Suspense, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";


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

export function Field({ label, children, hint, className, required }: { label: string; children: ReactNode; hint?: string; className?: string; required?: boolean }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}{required && <span className="ms-0.5 text-rose-600" aria-hidden="true">*</span>}</span>
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

export function ButtonLink({ href, children, variant = "primary", small, icon }: { href: string; children: ReactNode; variant?: ButtonVariant; small?: boolean; icon?: IconName }) {
  if (icon) children = <><Icon name={icon} className="h-4 w-4" />{children}</>;
  if (href.includes("/export/")) return <a href={href} className={buttonClass(variant, small)}>{children}</a>;
  return <Link href={href} className={buttonClass(variant, small)}>{children}</Link>;
}

/** Feedback from server actions: errors stay inline (persistent), successes show as a toast. */
export function Flash({ sp, dismissLabel = "×" }: { sp: { ok?: string; error?: string }; dismissLabel?: string }) {
  if (sp.error)
    return (
      <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /><span>{sp.error}</span>
      </div>
    );
  if (sp.ok) return <Suspense><Toast message={sp.ok} dismissLabel={dismissLabel} /></Suspense>;
  return null;
}

/** A titled block of form fields with a short explanation on the side (stacked on mobile). */
export function FormSection({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("grid grid-cols-1 gap-x-8 gap-y-4 border-t border-slate-100 py-6 first:border-t-0 first:pt-0 last:pb-0 lg:grid-cols-[14rem_1fr]", className)}>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const sizes = { sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-base" };
  return <span className={cx("grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-cyan-100 font-semibold text-brand-700", sizes[size])} aria-hidden="true">{initials}</span>;
}

/** Link-based tabs (state lives in the URL so it survives reloads and server actions). */
export function Tabs({ tabs, current }: { tabs: { key: string; label: string; href: string; count?: number }[]; current: string }) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Tabs">
      {tabs.map((tb) => {
        const active = tb.key === current;
        return (
          <Link
            key={tb.key}
            href={tb.href}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cx("whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition", active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800")}
          >
            {tb.label}
            {tb.count !== undefined && <span className={cx("ms-1.5 rounded-full px-1.5 py-0.5 text-[11px]", active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500")}>{tb.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function SearchField({ name = "q", defaultValue, placeholder, label }: { name?: string; defaultValue?: string; placeholder: string; label: string }) {
  return (
    <div className="relative">
      <Icon name="search" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input type="search" name={name} defaultValue={defaultValue} placeholder={placeholder} aria-label={label} className={cx(inputCls, "h-10 ps-9")} />
    </div>
  );
}

/** Small label/value pair for detail views. */
export function InfoItem({ label, children, dir }: { label: string; children: ReactNode; dir?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-slate-900" dir={dir}>{children || "—"}</dd>
    </div>
  );
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return <div className={cx("grid grid-cols-1 gap-4", c)}>{children}</div>;
}

export function Pagination({ page, pages, hrefFor, t, total, pageSize }: {
  page: number; pages: number; hrefFor: (p: number) => string; total?: number; pageSize?: number;
  t: { previous: string; next: string; page: string; of: string; showing?: string; results?: string };
}) {
  if (pages <= 1 && total === undefined) return null;
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages])).filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const from = total ? (page - 1) * (pageSize ?? 0) + 1 : 0;
  const to = total ? Math.min(total, page * (pageSize ?? 0)) : 0;
  const pageBtn = "grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm";
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm sm:flex-row">
      <span className="text-slate-500">
        {total !== undefined && pageSize ? <>{t.showing} <b className="font-medium text-slate-700">{total ? `${from}–${to}` : 0}</b> {t.of} <b className="font-medium text-slate-700">{total}</b> {t.results}</> : <>{t.page} {page} {t.of} {pages}</>}
      </span>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          {page > 1 ? <Link href={hrefFor(page - 1)} className={cx(pageBtn, "text-slate-600 hover:bg-slate-100")} aria-label={t.previous}><Icon name="chevronLeft" className="h-4 w-4 rtl:rotate-180" /></Link> : <span className={cx(pageBtn, "text-slate-300")}><Icon name="chevronLeft" className="h-4 w-4 rtl:rotate-180" /></span>}
          {nums.map((n, k) => (
            <span key={n} className="flex items-center">
              {k > 0 && n - nums[k - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
              <Link href={hrefFor(n)} aria-current={n === page ? "page" : undefined} className={cx(pageBtn, n === page ? "bg-brand-600 font-medium text-white" : "text-slate-600 hover:bg-slate-100")}>{n}</Link>
            </span>
          ))}
          {page < pages ? <Link href={hrefFor(page + 1)} className={cx(pageBtn, "text-slate-600 hover:bg-slate-100")} aria-label={t.next}><Icon name="chevronRight" className="h-4 w-4 rtl:rotate-180" /></Link> : <span className={cx(pageBtn, "text-slate-300")}><Icon name="chevronRight" className="h-4 w-4 rtl:rotate-180" /></span>}
        </nav>
      )}
    </div>
  );
}
