import type { Dictionary } from "@/lib/i18n";
import { cx } from "./styles";

/** Enrolled vs capacity, with a fill bar; "unlimited" when no capacity is set. */
export function CapacityBar({ n, cap, t }: { n: number; cap: number | null; t: Dictionary }) {
  if (!cap) return <span className="text-sm tabular-nums text-slate-700">{n} <span className="text-xs text-slate-400">/ {t.structure.unlimited.toLowerCase()}</span></span>;
  const ratio = Math.min(1, n / cap);
  return (
    <div className="w-32">
      <div className="flex justify-between text-xs tabular-nums"><span className="text-slate-700">{n}/{cap}</span>{n >= cap && <span className="font-medium text-rose-700">{t.structure.full}</span>}</div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={cx("h-full rounded-full", n >= cap ? "bg-rose-500" : ratio > 0.85 ? "bg-amber-400" : "bg-brand-500")} style={{ width: `${ratio * 100}%` }} /></div>
    </div>
  );
}
