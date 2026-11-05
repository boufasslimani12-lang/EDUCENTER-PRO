import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./styles";

export type Session = {
  id: string; weekday: number; starts_at: string; ends_at: string;
  title: string; subtitle?: string; meta?: string; room?: string | null; colorKey: string; actions?: ReactNode; href?: string;
};

/** Soft, distinguishable session colours; a subject always gets the same one. */
const PALETTE = [
  "border-indigo-500 bg-indigo-50 text-indigo-950", "border-cyan-500 bg-cyan-50 text-cyan-950", "border-emerald-600 bg-emerald-50 text-emerald-950",
  "border-amber-500 bg-amber-50 text-amber-950", "border-rose-500 bg-rose-50 text-rose-950", "border-violet-500 bg-violet-50 text-violet-950",
  "border-sky-500 bg-sky-50 text-sky-950", "border-lime-600 bg-lime-50 text-lime-950",
];
export function colorFor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const durationMin = (s: { starts_at: string; ends_at: string }) => mins(s.ends_at) - mins(s.starts_at);

/** Weekly timetable: positioned blocks on desktop (lg+), per-day lists below. */
export function WeekGrid({ sessions, days, dayNames, minutesLabel, emptyDay, onlyDay }: {
  sessions: Session[]; days: number[]; dayNames: string[]; minutesLabel: string; emptyDay: string; onlyDay?: number;
}) {
  const shown = onlyDay ? [onlyDay] : days;
  const starts = sessions.map((s) => mins(s.starts_at));
  const ends = sessions.map((s) => mins(s.ends_at));
  const from = Math.min(8 * 60, ...starts.map((m) => Math.floor(m / 60) * 60));
  const to = Math.max(18 * 60, ...ends.map((m) => Math.ceil(m / 60) * 60));
  const PX = 1.1; // px per minute
  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60);
  const byDay = (d: number) => sessions.filter((s) => s.weekday === d).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const label = (s: Session) => `${s.starts_at.slice(0, 5)}–${s.ends_at.slice(0, 5)}`;

  if (onlyDay && byDay(onlyDay).length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">{emptyDay}</p>;
  }
  return (
    <>
      <div className="hidden lg:block" dir="ltr">
        <div className="grid" style={{ gridTemplateColumns: `3.25rem repeat(${shown.length}, minmax(0, 1fr))` }}>
          <div />
          {shown.map((d) => <div key={d} className="border-b border-slate-200 px-2 pb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500" dir="auto">{dayNames[d - 1]}</div>)}
          <div className="relative" style={{ height: (to - from) * PX }}>
            {hours.map((h) => (
              <div key={h} className="absolute end-2 -translate-y-1/2 text-[11px] tabular-nums text-slate-400" style={{ top: (h - from) * PX }}>{String(h / 60).padStart(2, "0")}:00</div>
            ))}
          </div>
          {shown.map((d) => (
            <div key={d} className="relative border-s border-slate-100" style={{ height: (to - from) * PX }}>
              {hours.map((h) => <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: (h - from) * PX }} />)}
              {byDay(d).map((s) => {
                const Box = (s.href ? Link : "div") as any;
                return (
                <Box
                  key={s.id}
                  {...(s.href ? { href: s.href, scroll: false } : {})}
                  className={cx("group absolute inset-x-1 overflow-hidden rounded-lg border-s-[3px] px-2 py-1 text-[11px] leading-tight shadow-sm", s.href && "transition hover:shadow-md hover:ring-2 hover:ring-brand-500/30", colorFor(s.colorKey))}
                  style={{ top: (mins(s.starts_at) - from) * PX + 1, height: Math.max(durationMin(s) * PX - 2, 22) }}
                  title={`${label(s)} · ${s.title}${s.subtitle ? " · " + s.subtitle : ""}${s.room ? " · " + s.room : ""}`}
                  dir="auto"
                >
                  <div className="font-semibold tabular-nums">{label(s)}</div>
                  <div className="truncate font-medium">{s.title}</div>
                  {s.subtitle && <div className="truncate opacity-80">{s.subtitle}</div>}
                  {(s.meta || s.room) && <div className="truncate opacity-70">{[s.meta, s.room].filter(Boolean).join(" · ")}</div>}
                  {s.actions && <div className="absolute end-1 top-1 hidden gap-1 group-focus-within:flex group-hover:flex">{s.actions}</div>}
                </Box>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4 lg:hidden">
        {shown.map((d) => (
          <section key={d}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{dayNames[d - 1]}</h3>
            {byDay(d).length ? (
              <ul className="space-y-2">
                {byDay(d).map((s) => (
                  <li key={s.id} className={cx("relative flex items-start gap-3 rounded-xl border-s-[3px] px-3 py-2.5", colorFor(s.colorKey))}>
                    {s.href && <Link href={s.href} scroll={false} className="absolute inset-0 rounded-xl" aria-label={`${s.title} ${s.starts_at.slice(0, 5)}`} />}
                    <div className="w-[4.5rem] shrink-0 text-xs font-semibold tabular-nums" dir="ltr">{s.starts_at.slice(0, 5)}<div className="font-normal opacity-70">{durationMin(s)} {minutesLabel}</div></div>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="truncate font-medium">{s.title}</div>
                      <div className="truncate text-xs opacity-80">{[s.subtitle, s.meta, s.room].filter(Boolean).join(" · ")}</div>
                    </div>
                    {s.actions && <div className="flex shrink-0 gap-1">{s.actions}</div>}
                  </li>
                ))}
              </ul>
            ) : <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">{emptyDay}</p>}
          </section>
        ))}
      </div>
    </>
  );
}
