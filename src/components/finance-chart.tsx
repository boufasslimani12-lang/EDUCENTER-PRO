"use client";
import { useState } from "react";

export type MonthPoint = { key: string; label: string; revenue: number; expenses: number };

const INCOME = "#047857";
const EXPENSE = "#fb7185";

/** Revenue vs expenses, grouped bars per month. One shared y-axis (same unit). */
export function FinanceChart({ data, locale, currency, labels }: {
  data: MonthPoint[]; locale: "fr" | "ar"; currency: string;
  labels: { revenue: string; expenses: string; net: string; showTable: string; month: string; empty: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const tag = locale === "ar" ? "ar-MA" : "fr-MA";
  const money = (n: number) => new Intl.NumberFormat(tag, { style: "currency", currency, maximumFractionDigits: 0, numberingSystem: "latn" }).format(n);
  const compact = (n: number) => new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1, numberingSystem: "latn" }).format(n);

  const max = Math.max(...data.map((d) => Math.max(d.revenue, d.expenses)), 0);
  const empty = max === 0;

  // Nice rounded axis maximum and 4 ticks.
  const step = (() => {
    if (empty) return 1;
    const raw = max / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  })();
  const top = step * 4;

  const W = 720, H = 240, padL = 48, padR = 8, padT = 12, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const col = plotW / Math.max(data.length, 1);
  const barW = Math.min(22, (col - 14) / 2);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const bar = (x: number, v: number) => {
    const h = Math.max(0, (v / top) * plotH);
    if (h < 0.5) return "";
    const r = Math.min(4, h, barW / 2);
    const yb = padT + plotH;
    return `M${x},${yb} V${yb - h + r} Q${x},${yb - h} ${x + r},${yb - h} H${x + barW - r} Q${x + barW},${yb - h} ${x + barW},${yb - h + r} V${yb} Z`;
  };

  const legend = (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: INCOME }} />{labels.revenue}</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: EXPENSE }} />{labels.expenses}</span>
    </div>
  );

  if (empty) {
    return (
      <div>
        {legend}
        <div className="mt-4 grid h-56 place-items-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">{labels.empty}</div>
      </div>
    );
  }

  const h = hover !== null ? data[hover] : null;
  return (
    <div>
      {legend}
      <div className="-mx-1 mt-3 overflow-x-auto px-1" dir="ltr">
      <div className="relative min-w-[560px]" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${labels.revenue} / ${labels.expenses}`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y(step * i)} y2={y(step * i)} stroke={i === 0 ? "#cbd5e1" : "#eef0f4"} strokeWidth={1} />
              <text x={padL - 8} y={y(step * i) + 4} textAnchor="end" fontSize={11} fill="#94a3b8">{compact(step * i)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = padL + col * i + col / 2;
            const x1 = cx - barW - 1;
            const x2 = cx + 1;
            return (
              <g key={d.key}>
                {hover === i && <rect x={padL + col * i + 2} y={padT} width={col - 4} height={plotH} rx={6} fill="#f1f5f9" />}
                <path d={bar(x1, d.revenue)} fill={INCOME} />
                <path d={bar(x2, d.expenses)} fill={EXPENSE} />
                <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="#64748b">{d.label}</text>
                <rect
                  x={padL + col * i} y={padT} width={col} height={plotH + padB} fill="transparent"
                  onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}
                  aria-label={`${d.label}: ${labels.revenue} ${money(d.revenue)}, ${labels.expenses} ${money(d.expenses)}`}
                />
              </g>
            );
          })}
        </svg>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-48 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-pop"
            style={{ left: `${Math.min(Math.max(((padL + col * hover + col / 2) / W) * 100, 16), 84)}%` }}
          >
            <div className="mb-1 font-semibold text-slate-800">{h.label}</div>
            <div className="flex justify-between gap-2"><span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-sm" style={{ background: INCOME }} />{labels.revenue}</span><span className="tabular-nums text-slate-800">{money(h.revenue)}</span></div>
            <div className="flex justify-between gap-2"><span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-sm" style={{ background: EXPENSE }} />{labels.expenses}</span><span className="tabular-nums text-slate-800">{money(h.expenses)}</span></div>
            <div className="mt-1 flex justify-between gap-2 border-t border-slate-100 pt-1"><span className="text-slate-500">{labels.net}</span><span className="font-medium tabular-nums text-slate-900">{money(h.revenue - h.expenses)}</span></div>
          </div>
        )}
      </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer select-none text-xs font-medium text-brand-600 hover:underline">{labels.showTable}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead><tr className="text-slate-500"><th className="py-1 text-start font-medium">{labels.month}</th><th className="py-1 text-end font-medium">{labels.revenue}</th><th className="py-1 text-end font-medium">{labels.expenses}</th><th className="py-1 text-end font-medium">{labels.net}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((d) => (
                <tr key={d.key}><td className="py-1">{d.label}</td><td className="py-1 text-end tabular-nums">{money(d.revenue)}</td><td className="py-1 text-end tabular-nums">{money(d.expenses)}</td><td className="py-1 text-end tabular-nums">{money(d.revenue - d.expenses)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
