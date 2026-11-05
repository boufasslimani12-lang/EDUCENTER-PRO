import Link from "next/link";
import { requireOperational, type Props } from "@/lib/session";
import { getT, type Dictionary } from "@/lib/i18n";
import { today, date, pct, firstOfMonth, monthLabel } from "@/lib/format";
import { scopesFor, parseScope, roster, type Scope } from "@/lib/scopes";
import { sanitizeSearch } from "@/lib/lookups";
import { PageHeader, Card, Flash, Input, Select, Field, Badge, statusTone, Tabs, EmptyState, Avatar, ButtonLink, SearchField, buttonClass, cx } from "@/components/ui";
import { Submit, AutoSubmitSelect, MarkAllPresent } from "@/components/client";
import { Icon } from "@/components/icons";
import { saveAttendance } from "./actions";

const STATUSES = ["present", "late", "absent", "excused"] as const;
type Counts = { present: number; late: number; absent: number; excused: number; total: number };
const empty = (): Counts => ({ present: 0, late: 0, absent: 0, excused: 0, total: 0 });
const add = (c: Counts, s: string) => { c.total++; if (s in c) (c as any)[s]++; return c; };
/** Attendance rate: present + late over sessions that count (excused absences are neutral). */
const rateOf = (c: Counts) => (c.total - c.excused > 0 ? ((c.present + c.late) / (c.total - c.excused)) * 100 : null);

function StatusChips({ c, t }: { c: Counts; t: Dictionary }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Badge tone="green">{c.present} {t.status.present}</Badge>
      {c.late > 0 && <Badge tone="amber">{c.late} {t.status.late}</Badge>}
      {c.absent > 0 && <Badge tone="red">{c.absent} {t.status.absent}</Badge>}
      {c.excused > 0 && <Badge tone="blue">{c.excused} {t.status.excused}</Badge>}
    </span>
  );
}

function ScopeSelect({ scopes, value, t, allLabel }: { scopes: Scope[]; value?: string; t: Dictionary; allLabel?: string }) {
  const cls = scopes.filter((s) => s.class_id), grp = scopes.filter((s) => s.group_id);
  return (
    <AutoSubmitSelect name="scope" defaultValue={value ?? ""} aria-label={`${t.common.class} / ${t.common.group}`}>
      <option value="" disabled={!allLabel}>{allLabel ?? "—"}</option>
      {cls.length > 0 && <optgroup label={t.structure.classes}>{cls.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</optgroup>}
      {grp.length > 0 && <optgroup label={t.nav.groups}>{grp.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</optgroup>}
    </AutoSubmitSelect>
  );
}

export default async function AttendancePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant, role, teacherId } = await requireOperational(slug);
  const { t, locale } = await getT();
  const isAdmin = role === "admin";
  const b = `/t/${slug}/attendance`;
  const scopes = await scopesFor(supabase, tenant.id, role, teacherId);
  const scope = parseScope(sp.scope, scopes);
  const tab = (["history", "summary", "reports"] as const).find((k) => k === sp.tab && (k !== "reports" || isAdmin)) ?? "take";
  const keepScope = scope ? `&scope=${encodeURIComponent(scope.key)}` : "";

  const header = (
    <>
      <PageHeader title={t.attendance.title} subtitle={scope?.name} />
      <Flash sp={sp} dismissLabel={t.common.dismiss} />
      <div className="mb-6">
        <Tabs current={tab} tabs={[
          { key: "take", label: t.attendance.tabTake, href: `${b}?${keepScope.slice(1)}` },
          { key: "history", label: t.attendance.tabHistory, href: `${b}?tab=history${keepScope}` },
          { key: "summary", label: t.attendance.tabSummary, href: `${b}?tab=summary${keepScope}` },
          ...(isAdmin ? [{ key: "reports", label: t.attendance.tabReports, href: `${b}?tab=reports` }] : []),
        ]} />
      </div>
    </>
  );
  if (!scopes.length) return <>{header}<EmptyState icon="attendance" title={t.attendance.noScopes} /></>;

  // ── Take / edit a sheet ──
  if (tab === "take") {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today();
    let students: Awaited<ReturnType<typeof roster>> = [];
    const existing = new Map<string, any>();
    if (scope) {
      students = await roster(supabase, scope);
      let q = supabase.from("attendance_records").select("student_id, status, minutes_late, note").eq("session_date", day).is("timetable_entry_id", null);
      q = scope.class_id ? q.eq("class_id", scope.class_id) : q.eq("group_id", scope.group_id!);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      (data ?? []).forEach((r: any) => existing.set(r.student_id, r));
    }
    const c = Array.from(existing.values()).reduce((a, r) => add(a, r.status), empty());
    return (
      <>
        {header}
        <form method="get" action={b} className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card sm:grid-cols-[1fr_12rem_auto]">
          <Field label={`${t.common.class} / ${t.common.group}`}><ScopeSelect scopes={scopes} value={scope?.key} t={t} /></Field>
          <Field label={t.common.date}><Input type="date" name="date" defaultValue={day} max={today()} /></Field>
          <div className="flex items-end"><button className={buttonClass("primary")}>{t.common.filter}</button></div>
        </form>
        {!scope ? <EmptyState icon="attendance" title={t.attendance.pick} /> : (
          <form action={saveAttendance.bind(null, slug)}>
            <input type="hidden" name="scope" value={scope.key} />
            <input type="hidden" name="date" value={day} />
            <Card
              title={`${scope.name} · ${date(day, locale)}`}
              description={existing.size ? <span className="inline-flex items-center gap-2">{t.attendance.alreadySaved} <StatusChips c={c} t={t} /></span> : `${students.length} ${t.common.results}`}
              bodyClassName="p-0"
              actions={students.length > 0 && <div className="flex gap-2"><MarkAllPresent label={t.attendance.markAllPresent} /><Submit icon="check">{t.attendance.saveAll}</Submit></div>}
            >
              {students.length ? (
                <ul className="divide-y divide-slate-100">
                  {students.map((s) => {
                    const r = existing.get(s.id);
                    const cur = r?.status ?? "present";
                    return (
                      <li key={s.id} className="grid grid-cols-1 gap-3 px-5 py-3 lg:grid-cols-[minmax(12rem,1fr)_auto_7rem_minmax(10rem,14rem)] lg:items-center">
                        <div className="flex items-center gap-3">
                          <input type="hidden" name="student" value={s.id} />
                          <Avatar name={`${s.last_name} ${s.first_name}`} size="sm" />
                          <span className="truncate text-sm font-medium text-slate-900">{s.last_name} {s.first_name}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${s.last_name} ${s.first_name}`}>
                          {STATUSES.map((st) => (
                            <label key={st} className={cx("cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition has-[:checked]:text-white",
                              st === "present" && "border-emerald-200 text-emerald-700 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-600",
                              st === "late" && "border-amber-200 text-amber-700 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-500",
                              st === "absent" && "border-rose-200 text-rose-700 has-[:checked]:border-rose-600 has-[:checked]:bg-rose-600",
                              st === "excused" && "border-sky-200 text-sky-700 has-[:checked]:border-sky-600 has-[:checked]:bg-sky-600")}>
                              <input type="radio" className="sr-only" name={`status_${s.id}`} value={st} defaultChecked={cur === st} />
                              {t.status[st]}
                            </label>
                          ))}
                        </div>
                        <Input name={`late_${s.id}`} type="number" min="0" max="240" inputMode="numeric" placeholder={t.attendance.minutesLate} aria-label={t.attendance.minutesLate} defaultValue={r?.minutes_late ?? ""} />
                        <Input name={`note_${s.id}`} maxLength={200} placeholder={t.common.notes} aria-label={t.common.notes} defaultValue={r?.note ?? ""} />
                      </li>
                    );
                  })}
                </ul>
              ) : <div className="p-5"><EmptyState icon="students" title={t.attendance.noStudents} /></div>}
            </Card>
          </form>
        )}
      </>
    );
  }

  // Shared period filter for history / summary / reports.
  const defaultFrom = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : tab === "summary" ? firstOfMonth() : defaultFrom;
  const monthEnd = (() => { const d = new Date(from + "T00:00:00"); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().slice(0, 10); })();
  const to = tab === "summary" ? monthEnd : /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : today();
  // Teacher filter = attendance recorded by that teacher's login.
  const memberMap = new Map<string, string>();
  const teacherList: { id: string; name: string }[] = [];
  let teacherUser: string | undefined;
  if (isAdmin) {
    const { data, error: mErr } = await supabase.from("memberships").select("user_id, teacher_id, teachers(full_name)").eq("tenant_id", tenant.id).eq("role", "teacher");
    if (mErr) throw new Error(mErr.message);
    for (const m of (data ?? []) as any[]) {
      memberMap.set(m.user_id, m.teachers?.full_name ?? "—");
      if (m.teacher_id) teacherList.push({ id: m.teacher_id, name: m.teachers?.full_name ?? "—" });
      if (m.teacher_id === sp.teacher) teacherUser = m.user_id;
    }
    teacherList.sort((a, b2) => a.name.localeCompare(b2.name));
  }
  let q = supabase.from("attendance_records")
    .select(`id, session_date, status, minutes_late, note, recorded_by, class_id, group_id, student_id, classes(name), groups(name), students${sp.q ? "!inner" : ""}(id, first_name, last_name)`, { count: "exact" })
    .eq("tenant_id", tenant.id).gte("session_date", from).lte("session_date", to)
    .order("session_date", { ascending: false }).limit(tab === "history" ? 300 : 5000);
  if (scope) q = scope.class_id ? q.eq("class_id", scope.class_id) : q.eq("group_id", scope.group_id!);
  if (sp.student) q = q.eq("student_id", sp.student);
  if (isAdmin && sp.teacher) q = q.eq("recorded_by", teacherUser ?? "00000000-0000-0000-0000-000000000000");
  if (sp.q) { const s = sanitizeSearch(sp.q); if (s) q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%`, { referencedTable: "students" }); }
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  const recs = (data ?? []) as any[];
  const total = recs.reduce((a, r) => add(a, r.status), empty());
  const totalRate = rateOf(total);
  const name = (r: any) => `${r.students?.last_name ?? ""} ${r.students?.first_name ?? ""}`.trim();

  const filterBar = (extra?: React.ReactNode) => (
    <form method="get" action={b} className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card sm:flex-row sm:flex-wrap sm:items-end">
      <input type="hidden" name="tab" value={tab} />
      {tab === "summary" ? (
        <Field label={t.common.period}><Select name="from" defaultValue={from}>{Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); const v = firstOfMonth(d); return <option key={v} value={v}>{monthLabel(v, locale)}</option>; })}</Select></Field>
      ) : (
        <>
          <Field label={t.common.from}><Input type="date" name="from" defaultValue={from} /></Field>
          <Field label={t.common.to}><Input type="date" name="to" defaultValue={to} /></Field>
        </>
      )}
      {tab !== "reports" && <div className="sm:w-52"><Field label={`${t.common.class} / ${t.common.group}`}><ScopeSelect scopes={scopes} value={scope?.key} t={t} allLabel={t.common.all} /></Field></div>}
      {extra}
      <button className={buttonClass("primary")}><Icon name="search" className="h-4 w-4" />{t.common.filter}</button>
    </form>
  );

  // ── History ──
  if (tab === "history") {
    return (
      <>
        {header}
        {filterBar(<>
          <div className="sm:w-56"><Field label={t.common.student}><SearchField defaultValue={sp.q} placeholder={t.students.searchPlaceholder} label={t.common.student} /></Field></div>
          {isAdmin && <div className="sm:w-48"><Field label={t.common.teacher}><Select name="teacher" defaultValue={sp.teacher ?? ""}><option value="">{t.attendance.allTeachers}</option>{teacherList.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field></div>}
        </>)}
        <Card title={t.attendance.history} description={<span className="inline-flex flex-wrap items-center gap-2">{count ?? recs.length} {t.dashboard.records} · {totalRate === null ? "—" : pct(totalRate)} <StatusChips c={total} t={t} /></span>} bodyClassName="p-0"
          actions={isAdmin && <ButtonLink small variant="secondary" href={`/t/${slug}/export/attendance?from=${from}&to=${to}`} icon="arrowUpRight">{t.common.export}</ButtonLink>}>
          {recs.length ? (
            <ul className="divide-y divide-slate-100">
              {recs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                  <span className="w-28 shrink-0 text-slate-500">{date(r.session_date, locale)}</span>
                  <Link href={`/t/${slug}/students/${r.student_id}?tab=academic`} className="min-w-[10rem] flex-1 truncate font-medium text-slate-900 hover:text-brand-700">{name(r)}</Link>
                  <span className="truncate text-slate-500">{r.classes?.name ?? r.groups?.name}</span>
                  <Badge tone={statusTone(r.status === "excused" ? "partial" : r.status)}>{t.status[r.status as "present"]}{r.minutes_late ? ` (${r.minutes_late}′)` : ""}</Badge>
                  {r.note && <span className="w-full truncate text-xs text-slate-500 sm:w-auto">{r.note}</span>}
                  {isAdmin && r.recorded_by && memberMap.get(r.recorded_by) && <span className="text-xs text-slate-400">{t.attendance.recordedBy} {memberMap.get(r.recorded_by)}</span>}
                  <Link href={`${b}?scope=${encodeURIComponent(r.class_id ? `c:${r.class_id}` : `g:${r.group_id}`)}&date=${r.session_date}`} className="ms-auto text-xs font-medium text-brand-700 hover:underline">{t.common.edit}</Link>
                </li>
              ))}
            </ul>
          ) : <div className="p-5"><EmptyState icon="attendance" title={t.attendance.noRecords} /></div>}
        </Card>
      </>
    );
  }

  // ── Monthly summary per student, with repeated-absence flag ──
  if (tab === "summary") {
    const threshold = Math.max(1, Number(sp.threshold) || 3);
    const per = new Map<string, { id: string; name: string; c: Counts }>();
    for (const r of recs) { const v = per.get(r.student_id) ?? { id: r.student_id, name: name(r), c: empty() }; add(v.c, r.status); per.set(r.student_id, v); }
    const rows = Array.from(per.values()).sort((a, b) => b.c.absent - a.c.absent || a.name.localeCompare(b.name));
    const flagged = rows.filter((r) => r.c.absent >= threshold).length;
    return (
      <>
        {header}
        {filterBar(<div className="w-28"><Field label={t.attendance.threshold}><Input type="number" name="threshold" min="1" max="31" defaultValue={threshold} /></Field></div>)}
        <Card title={`${t.attendance.tabSummary} · ${monthLabel(from, locale)}`} description={<span className="inline-flex flex-wrap items-center gap-2">{rows.length} {t.common.student.toLowerCase()}(s) · {totalRate === null ? "—" : pct(totalRate)} {flagged > 0 && <Badge tone="red">{flagged} {t.attendance.flagged}</Badge>}</span>} bodyClassName="p-0">
          {rows.length ? (
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => {
                const rate = rateOf(r.c);
                return (
                  <li key={r.id} className={cx("flex flex-wrap items-center gap-3 px-5 py-3", r.c.absent >= threshold && "bg-rose-50/40")}>
                    <Link href={`/t/${slug}/students/${r.id}?tab=academic`} className="flex min-w-[12rem] flex-1 items-center gap-3">
                      <Avatar name={r.name} size="sm" />
                      <span className="truncate text-sm font-medium text-slate-900 hover:text-brand-700">{r.name}</span>
                      {r.c.absent >= threshold && <Badge tone="red"><Icon name="alert" className="me-1 h-3 w-3" />{t.attendance.repeatedAbsences}</Badge>}
                    </Link>
                    <StatusChips c={r.c} t={t} />
                    <span className={cx("w-14 text-end text-sm font-semibold tabular-nums", rate !== null && rate < 80 ? "text-rose-700" : "text-slate-900")}>{rate === null ? "—" : pct(rate)}</span>
                  </li>
                );
              })}
            </ul>
          ) : <div className="p-5"><EmptyState icon="attendance" title={t.attendance.noRecords} /></div>}
        </Card>
      </>
    );
  }

  // ── Reports (admin): by period bucket, by class/group, top absences ──
  const gran = sp.gran === "week" || sp.gran === "month" ? sp.gran : "day";
  const bucketOf = (d: string) => {
    if (gran === "month") return d.slice(0, 7) + "-01";
    if (gran === "week") { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); }
    return d;
  };
  const buckets = new Map<string, Counts>(), byScope = new Map<string, { name: string; c: Counts }>(), absences = new Map<string, { id: string; name: string; n: number }>();
  for (const r of recs) {
    const k = bucketOf(r.session_date); buckets.set(k, add(buckets.get(k) ?? empty(), r.status));
    const sk = r.class_id ?? r.group_id; const s = byScope.get(sk) ?? { name: r.classes?.name ?? r.groups?.name ?? "—", c: empty() }; add(s.c, r.status); byScope.set(sk, s);
    if (r.status === "absent") { const a = absences.get(r.student_id) ?? { id: r.student_id, name: name(r), n: 0 }; a.n++; absences.set(r.student_id, a); }
  }
  const bucketLabel = (k: string) => gran === "month" ? monthLabel(k, locale) : gran === "week" ? `${t.attendance.weekly} ${date(k, locale)}` : date(k, locale);
  const row = (label: React.ReactNode, c: Counts, key: string) => {
    const r = rateOf(c);
    return (
      <tr key={key}>
        <td className="whitespace-nowrap px-5 py-2.5 text-slate-800">{label}</td>
        <td className="px-3 py-2.5 text-end tabular-nums">{c.total}</td>
        <td className="px-3 py-2.5 text-end tabular-nums text-emerald-700">{c.present}</td>
        <td className="px-3 py-2.5 text-end tabular-nums text-amber-700">{c.late}</td>
        <td className="px-3 py-2.5 text-end tabular-nums text-rose-700">{c.absent}</td>
        <td className="px-3 py-2.5 text-end tabular-nums text-sky-700">{c.excused}</td>
        <td className="px-5 py-2.5 text-end font-semibold tabular-nums">{r === null ? "—" : pct(r)}</td>
      </tr>
    );
  };
  const thead = (first: string) => (
    <thead><tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500">
      <th className="px-5 py-2.5 text-start font-medium">{first}</th><th className="px-3 py-2.5 text-end font-medium">{t.dashboard.records}</th>
      <th className="px-3 py-2.5 text-end font-medium">{t.status.present}</th><th className="px-3 py-2.5 text-end font-medium">{t.status.late}</th>
      <th className="px-3 py-2.5 text-end font-medium">{t.status.absent}</th><th className="px-3 py-2.5 text-end font-medium">{t.status.excused}</th>
      <th className="px-5 py-2.5 text-end font-medium">{t.attendance.rate}</th>
    </tr></thead>
  );
  return (
    <>
      {header}
      {filterBar(<div className="sm:w-40"><Field label={t.common.period}><Select name="gran" defaultValue={gran}><option value="day">{t.attendance.daily}</option><option value="week">{t.attendance.weekly}</option><option value="month">{t.attendance.monthly}</option></Select></Field></div>)}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[{ l: t.dashboard.records, v: total.total }, { l: t.status.present, v: total.present }, { l: t.status.late, v: total.late }, { l: t.status.absent, v: total.absent }, { l: t.attendance.rate, v: totalRate === null ? "—" : pct(totalRate) }].map((k) => (
          <div key={k.l} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card"><div className="text-xs text-slate-500">{k.l}</div><div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{k.v}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title={`${gran === "day" ? t.attendance.daily : gran === "week" ? t.attendance.weekly : t.attendance.monthly} · ${date(from, locale)} → ${date(to, locale)}`} className="xl:col-span-2" bodyClassName="p-0"
          actions={<ButtonLink small variant="secondary" href={`/t/${slug}/export/attendance?from=${from}&to=${to}`} icon="arrowUpRight">{t.common.export}</ButtonLink>}>
          {buckets.size ? <div className="overflow-x-auto"><table className="min-w-full text-sm">{thead(t.common.period)}<tbody className="divide-y divide-slate-100">{Array.from(buckets.entries()).sort(([a], [b2]) => b2.localeCompare(a)).map(([k, c]) => row(bucketLabel(k), c, k))}</tbody></table></div> : <div className="p-5"><EmptyState icon="chart" title={t.attendance.noRecords} /></div>}
        </Card>
        <Card title={t.attendance.absenceStats} bodyClassName="p-0">
          {absences.size ? (
            <ul className="divide-y divide-slate-100">
              {Array.from(absences.values()).sort((a, b2) => b2.n - a.n).slice(0, 10).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <Link href={`/t/${slug}/students/${a.id}?tab=academic`} className="truncate font-medium text-slate-900 hover:text-brand-700">{a.name}</Link>
                  <Badge tone="red">{a.n} {t.attendance.absences.toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          ) : <div className="p-5"><EmptyState icon="check" title={t.attendance.noRecords} /></div>}
        </Card>
        <Card title={t.attendance.byGroup} className="xl:col-span-3" bodyClassName="p-0">
          {byScope.size ? <div className="overflow-x-auto"><table className="min-w-full text-sm">{thead(`${t.common.class} / ${t.common.group}`)}<tbody className="divide-y divide-slate-100">{Array.from(byScope.entries()).map(([k, v]) => row(<Link href={`${b}?tab=summary&scope=${encodeURIComponent(scopes.find((s) => s.class_id === k || s.group_id === k)?.key ?? "")}`} className="hover:text-brand-700">{v.name}</Link>, v.c, k))}</tbody></table></div> : <div className="p-5"><EmptyState icon="chart" title={t.attendance.noRecords} /></div>}
        </Card>
      </div>
    </>
  );
}
