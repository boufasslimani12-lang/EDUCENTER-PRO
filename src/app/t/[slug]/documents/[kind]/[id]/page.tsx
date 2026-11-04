import { notFound } from "next/navigation";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { money, date, monthLabel } from "@/lib/format";
import { PrintButton } from "@/components/client";
import { ButtonLink } from "@/components/ui";

export default async function DocumentPage({ params }: Props<{ kind: string; id: string }>) {
  const { slug, kind, id } = await params;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  if (kind !== "invoice" && kind !== "receipt") notFound();

  let inst: any, payment: any = null;
  if (kind === "receipt") {
    const { data } = await supabase.from("payments").select("*").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
    if (!data) notFound();
    payment = data;
  }
  const { data: i } = await supabase.from("installment_balances")
    .select("*, students(first_name, last_name, code, guardian_name, address)")
    .eq("id", kind === "receipt" ? payment.installment_id : id).eq("tenant_id", tenant.id).maybeSingle();
  if (!i) notFound();
  inst = i;
  const { data: lines } = await supabase.from("installment_lines").select("label, amount").eq("installment_id", inst.id);
  const title = kind === "invoice" ? t.payments.invoice : t.payments.receipt;
  const number = kind === "invoice" ? inst.invoice_no : payment.receipt_no;

  return (
    <div>
      <div className="no-print mb-4 flex gap-2">
        <ButtonLink variant="secondary" href={`/t/${slug}/students/${inst.student_id}`}>{t.common.back}</ButtonLink>
        <PrintButton label={t.common.print} />
      </div>
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <header className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="text-xl font-bold text-slate-900">{tenant.name}</div>
            <div className="text-sm text-slate-600">{[tenant.address, tenant.city].filter(Boolean).join(", ")}</div>
            <div className="text-sm text-slate-600" dir="ltr">{[tenant.phone, tenant.email].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="text-end">
            <div className="text-2xl font-semibold uppercase tracking-wide text-brand-700">{title}</div>
            <div className="text-sm text-slate-600">N° {number}</div>
            <div className="text-sm text-slate-600">{date(kind === "receipt" ? payment.paid_on : inst.created_at, locale)}</div>
          </div>
        </header>
        <section className="my-6 text-sm">
          <div className="text-slate-500">{t.common.student}</div>
          <div className="text-base font-medium">{inst.students?.last_name} {inst.students?.first_name} {inst.students?.code ? `(${inst.students.code})` : ""}</div>
          {inst.students?.guardian_name && <div className="text-slate-600">{t.students.guardian}: {inst.students.guardian_name}</div>}
        </section>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 text-start">{t.common.description}</th><th className="py-2 text-end">{t.common.amount}</th></tr></thead>
          <tbody>
            {(lines ?? []).map((l: any, k: number) => (
              <tr key={k} className="border-b border-slate-100"><td className="py-2">{l.label} — {monthLabel(inst.period, locale)}</td><td className="py-2 text-end tabular-nums">{money(l.amount, locale)}</td></tr>
            ))}
            {Number(inst.discount) > 0 && <tr className="border-b border-slate-100"><td className="py-2">{t.common.discount}</td><td className="py-2 text-end tabular-nums">− {money(inst.discount, locale)}</td></tr>}
          </tbody>
          <tfoot className="font-medium">
            <tr><td className="pt-3">{t.payments.due}</td><td className="pt-3 text-end tabular-nums">{money(Number(inst.amount_due) - Number(inst.discount), locale)}</td></tr>
            {kind === "receipt" && <tr className="text-emerald-700"><td className="pt-1">{t.payments.paid} ({payment.method})</td><td className="pt-1 text-end tabular-nums">{money(payment.amount, locale)}</td></tr>}
            <tr><td className="pt-1">{t.payments.paid} ({t.common.total})</td><td className="pt-1 text-end tabular-nums">{money(inst.amount_paid, locale)}</td></tr>
            <tr className="text-base"><td className="pt-1">{t.payments.balance}</td><td className="pt-1 text-end tabular-nums">{money(inst.balance, locale)}</td></tr>
          </tfoot>
        </table>
        {payment?.voided_at && <p className="mt-6 rounded-lg bg-rose-50 p-3 text-center font-semibold text-rose-700">{t.status.voided} — {payment.void_reason}</p>}
        <footer className="mt-12 flex justify-between text-xs text-slate-400">
          <span>{t.app.name}</span><span>{t.payments.dueOn}: {date(inst.due_on, locale)}</span>
        </footer>
      </article>
    </div>
  );
}
