import { notFound } from "next/navigation";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { money, date, monthLabel, today } from "@/lib/format";
import { PrintButton } from "@/components/client";
import { ButtonLink } from "@/components/ui";

/** Printable remuneration statement (browser print / save as PDF). */
export default async function StatementPage({ params }: Props<{ id: string }>) {
  const { slug, id } = await params;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const { data: s, error } = await supabase
    .from("remuneration_statements")
    .select("*, teachers(full_name, email, phone, specialization), remuneration_payments(id, amount, paid_on, method, note)")
    .eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) notFound();
  const m = (n: unknown) => money(n as number, locale, tenant.currency);
  const payouts = ((s as any).remuneration_payments ?? []) as any[];
  const paid = payouts.reduce((a, p) => a + Number(p.amount), 0);
  const details = ((s as any).details ?? []) as any[];

  return (
    <div>
      <div className="no-print mb-4 flex gap-2">
        <ButtonLink variant="secondary" href={`/t/${slug}/remuneration?period=${s.period}`} icon="chevronLeft">{t.common.back}</ButtonLink>
        <PrintButton label={t.common.print} />
      </div>
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-card print:border-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xl font-bold text-slate-900">{tenant.name}</div>
            <div className="text-sm text-slate-600">{[tenant.address, tenant.city].filter(Boolean).join(", ")}</div>
          </div>
          <div className="text-end">
            <div className="text-lg font-semibold text-brand-700">{t.remuneration.statement}</div>
            <div className="text-sm text-slate-600">{monthLabel(s.period, locale)}</div>
            <div className="text-xs text-slate-500">{t.remuneration.generatedOn} {date(today(), locale)}</div>
          </div>
        </header>
        <section className="my-6 text-sm">
          <div className="text-slate-500">{t.common.teacher}</div>
          <div className="text-base font-medium">{(s as any).teachers?.full_name}</div>
          <div className="text-slate-600">{[(s as any).teachers?.specialization, (s as any).teachers?.email, (s as any).teachers?.phone].filter(Boolean).join(" · ")}</div>
        </section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">{t.remuneration.breakdown}</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 text-start font-medium">{t.teachers.target}</th><th className="py-2 text-end font-medium">{t.remuneration.revenue}</th><th className="py-2 text-end font-medium">%</th><th className="py-2 text-end font-medium">{t.common.amount}</th></tr></thead>
          <tbody>
            {details.map((d, i) => (
              <tr key={i} className="border-b border-slate-100"><td className="py-2">{d.label} <span className="text-xs text-slate-400">({d.basis === "due" ? t.remuneration.due : t.remuneration.collected})</span></td><td className="py-2 text-end tabular-nums">{m(d.revenue)}</td><td className="py-2 text-end tabular-nums">{d.percentage}</td><td className="py-2 text-end tabular-nums">{m(d.amount)}</td></tr>
            ))}
          </tbody>
        </table>
        <h2 className="mb-2 mt-8 text-sm font-semibold text-slate-900">{t.remuneration.history}</h2>
        <table className="w-full text-sm">
          <tbody>
            {payouts.map((p) => <tr key={p.id} className="border-b border-slate-100"><td className="py-2">{date(p.paid_on, locale)} · {p.method}{p.note ? ` · ${p.note}` : ""}</td><td className="py-2 text-end tabular-nums">{m(p.amount)}</td></tr>)}
            {!payouts.length && <tr><td className="py-2 text-slate-500">{t.remuneration.noPayouts}</td></tr>}
          </tbody>
        </table>
        <dl className="mt-6 space-y-1 border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between"><dt>{t.remuneration.calculated}</dt><dd className="tabular-nums">{m(s.calculated_amount)}</dd></div>
          <div className="flex justify-between text-emerald-700"><dt>{t.remuneration.paid}</dt><dd className="tabular-nums">{m(paid)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>{t.remuneration.outstanding}</dt><dd className="tabular-nums">{m(Number(s.calculated_amount) - paid)}</dd></div>
        </dl>
      </article>
    </div>
  );
}
