import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { money, date, monthLabel } from "@/lib/format";
import { Card, Flash, Badge, Avatar, Tabs, InfoItem, EmptyState, Select, Field, ButtonLink, cx } from "@/components/ui";
import { Submit, Menu, menuItemClass } from "@/components/client";
import { Icon } from "@/components/icons";
import { TeacherFields } from "@/components/teacher-fields";
import { WeekGrid, durationMin } from "@/components/week-grid";
import * as A from "../actions";

type Tab = "profile" | "assignments" | "schedule" | "attendance" | "pay";

export default async function TeacherPage({ params, searchParams }: Props<{ id: string }>) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const b = `/t/${slug}`;
  const base = `${b}/teachers/${id}`;

  const { data: x, error: xErr } = await supabase.from("teachers").select("*").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (xErr) throw new Error(xErr.message);
  if (!x) notFound();

  const [assigns, member, invite, tt, stmts, rules, lk] = await Promise.all([
    supabase.from("teacher_assignments").select("id, class_id, group_id, subject_id, classes(name), groups(name), subjects(name)").eq("teacher_id", id).order("created_at"),
    supabase.from("memberships").select("id, user_id, is_active").eq("teacher_id", id).maybeSingle(),
    supabase.from("invitations").select("id, email").eq("teacher_id", id).is("accepted_at", null).maybeSingle(),
    supabase.from("timetable_entries").select("id, weekday, starts_at, ends_at, room, classes(name), groups(name), subjects(name), academic_years!inner(is_active)").eq("teacher_id", id).eq("academic_years.is_active", true),
    supabase.from("remuneration_statements").select("id, period, calculated_amount, calculated_at, remuneration_payments(id, amount, paid_on, method, note)").eq("teacher_id", id).order("period", { ascending: false }).limit(24),
    supabase.from("remuneration_rules").select("id, percentage, basis, classes(name), groups(name)").eq("teacher_id", id),
    lookups(supabase, tenant.id),
  ]);
  for (const r of [assigns, member, invite, tt, stmts, rules]) if (r.error) throw new Error(r.error.message);

  // Attendance sessions recorded by this teacher's login (grouped by date + class/group).
  let sessions: { date: string; scope: string; n: number; absent: number }[] = [];
  if (member.data?.user_id) {
    const { data, error } = await supabase.from("attendance_records").select("session_date, status, classes(name), groups(name)").eq("tenant_id", tenant.id).eq("recorded_by", member.data.user_id).order("session_date", { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);
    const map = new Map<string, { date: string; scope: string; n: number; absent: number }>();
    for (const r of (data ?? []) as any[]) {
      const scope = r.classes?.name ?? r.groups?.name ?? "—";
      const k = `${r.session_date}|${scope}`;
      const v = map.get(k) ?? { date: r.session_date, scope, n: 0, absent: 0 };
      v.n++; if (r.status === "absent") v.absent++;
      map.set(k, v);
    }
    sessions = Array.from(map.values()).slice(0, 40);
  }

  const assignments = (assigns.data ?? []) as any[];
  const entries = (tt.data ?? []) as any[];
  const statements = ((stmts.data ?? []) as any[]).map((s) => {
    const paid = (s.remuneration_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
    return { ...s, paid, outstanding: Number(s.calculated_amount) - paid };
  });
  const payouts = statements.flatMap((s) => (s.remuneration_payments ?? []).map((p: any) => ({ ...p, period: s.period }))).sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  const weeklyMin = entries.reduce((a, e) => a + durationMin(e), 0);
  const totalDue = statements.reduce((a, s) => a + Math.max(0, s.outstanding), 0);
  const subjects = Array.from(new Set(assignments.map((a) => a.subjects?.name).filter(Boolean))) as string[];
  const m = (n: unknown) => money(n as number, locale, tenant.currency);
  const tab: Tab = (["assignments", "schedule", "attendance", "pay"] as const).find((k) => k === sp.tab) ?? "profile";
  const accountState = member.data?.is_active ? "linked" : invite.data ? "invited" : "none";

  return (
    <>
      <Link href={`${b}/teachers`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <Icon name="chevronLeft" className="h-4 w-4 rtl:rotate-180" />{t.teachers.title}
      </Link>
      <Flash sp={sp} dismissLabel={t.common.dismiss} />

      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-card">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
          <Avatar name={x.full_name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{x.full_name}</h1>
              {x.is_active ? <Badge tone="green">{t.common.active}</Badge> : <Badge>{t.teachers.archived}</Badge>}
              {accountState === "linked" ? <Badge tone="blue">{t.teachers.linked}</Badge> : accountState === "invited" ? <Badge tone="amber">{t.status.pending}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">{[x.specialization, subjects.join(", ")].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ButtonLink variant="secondary" href={`${b}/remuneration`} icon="wallet">{t.nav.remuneration}</ButtonLink>
            <Menu label={t.common.moreActions}>
              <Link href={`${base}?tab=assignments`} className={menuItemClass}><Icon name="layers" className="h-4 w-4 text-slate-400" />{t.teachers.assign}</Link>
              <Link href={`${b}/timetable?teacher=${id}`} className={menuItemClass}><Icon name="calendar" className="h-4 w-4 text-slate-400" />{t.nav.timetable}</Link>
              <div className="my-1 h-px bg-slate-100" />
              <form action={A.setTeacherActive.bind(null, slug, id, !x.is_active)}>
                <Submit variant="ghost" className={cx(menuItemClass, "justify-start font-normal", x.is_active ? "text-rose-700 hover:bg-rose-50" : "text-slate-700")} confirm={x.is_active ? t.teachers.archiveConfirm : t.teachers.restoreConfirm} icon={x.is_active ? "inbox" : "refresh"}>
                  {x.is_active ? t.teachers.archive : t.teachers.restore}
                </Submit>
              </form>
            </Menu>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl border-t border-slate-100 bg-slate-100 lg:grid-cols-4">
          {[
            { label: t.teachers.classesGroups, value: String(new Set(assignments.map((a) => a.class_id ?? a.group_id)).size) },
            { label: t.teachers.weeklyHours, value: `${Math.round((weeklyMin / 60) * 10) / 10} ${t.timetable.hours}` },
            { label: t.teachers.sessionsRecorded, value: String(sessions.length) },
            { label: t.remuneration.outstanding, value: m(totalDue) },
          ].map((k) => (
            <div key={k.label} className="bg-white px-5 py-3"><dt className="text-xs text-slate-500">{k.label}</dt><dd className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">{k.value}</dd></div>
          ))}
        </dl>
      </section>

      <div className="mt-6">
        <Tabs current={tab} tabs={[
          { key: "profile", label: t.teachers.tabProfile, href: base },
          { key: "assignments", label: t.teachers.tabAssignments, href: `${base}?tab=assignments`, count: assignments.length },
          { key: "schedule", label: t.teachers.tabSchedule, href: `${base}?tab=schedule`, count: entries.length },
          { key: "attendance", label: t.teachers.tabAttendance, href: `${base}?tab=attendance` },
          { key: "pay", label: t.teachers.tabPay, href: `${base}?tab=pay` },
        ]} />
      </div>

      <div className="mt-6">
        {tab === "profile" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <form action={A.updateTeacher.bind(null, slug, id)} className="xl:col-span-2">
              <Card title={t.common.details} description={t.common.requiredHint}>
                <TeacherFields t={t} v={x} />
                <div className="mt-6 flex justify-end border-t border-slate-100 pt-4"><Submit icon="check">{t.teachers.saveTeacher}</Submit></div>
              </Card>
            </form>
            <div className="space-y-6">
              <Card title={t.teachers.account}>
                {accountState === "linked" ? (
                  <p className="flex items-start gap-2 text-sm text-slate-600"><Icon name="check" className="mt-0.5 h-4 w-4 text-emerald-600" />{t.teachers.accountLinkedHint}</p>
                ) : (
                  <div className="space-y-3 text-sm">
                    {invite.data ? <p className="text-slate-600"><Badge tone="amber">{t.status.pending}</Badge> <span dir="ltr">{invite.data.email}</span></p> : <Badge>{t.teachers.notLinked}</Badge>}
                    {x.email ? (
                      <form action={A.inviteTeacher.bind(null, slug, id)} className="space-y-2">
                        <p className="text-xs text-slate-500">{t.teachers.inviteHint}</p>
                        <Submit variant="secondary" icon="arrowUpRight">{t.teachers.invite}</Submit>
                      </form>
                    ) : <p className="text-xs text-slate-500">{t.teachers.needEmail}</p>}
                  </div>
                )}
              </Card>
              <Card title={t.students.contactInfo}>
                <dl className="grid gap-3">
                  <InfoItem label={t.common.email} dir="ltr">{x.email && <a className="text-brand-700 hover:underline" href={`mailto:${x.email}`}>{x.email}</a>}</InfoItem>
                  <InfoItem label={t.common.phone} dir="ltr">{x.phone && <a className="text-brand-700 hover:underline" href={`tel:${x.phone}`}>{x.phone}</a>}</InfoItem>
                  <InfoItem label={t.teachers.hireDate}>{x.hire_date ? date(x.hire_date, locale) : null}</InfoItem>
                </dl>
              </Card>
            </div>
          </div>
        )}

        {tab === "assignments" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card title={t.teachers.assignments} className="xl:col-span-2" bodyClassName="p-0">
              {assignments.length ? (
                <ul className="divide-y divide-slate-100">
                  {assignments.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", a.class_id ? "bg-brand-50 text-brand-600" : "bg-accent-soft text-accent")}><Icon name={a.class_id ? "layers" : "groups"} className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <Link href={a.class_id ? `${b}/structure/classes/${a.class_id}` : `${b}/groups/${a.group_id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">{a.classes?.name ?? a.groups?.name}</Link>
                        <div className="text-xs text-slate-500">{a.class_id ? t.common.class : t.common.group} · {a.subjects?.name ?? t.common.none}</div>
                      </div>
                      <form action={A.removeAssignment.bind(null, slug, id, a.id)}>
                        <Submit small variant="ghost" icon="x" confirm={t.teachers.removeAssignmentConfirm}>{t.common.delete}</Submit>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : <div className="p-5"><EmptyState icon="layers" title={t.teachers.noAssignments} /></div>}
            </Card>
            <Card title={t.teachers.assign}>
              <form action={A.addAssignment.bind(null, slug, id)} className="space-y-4">
                <Field label={t.teachers.target} required>
                  <Select name="target" required defaultValue="">
                    <option value="" disabled>—</option>
                    <optgroup label={t.structure.classes}>{lk.activeClasses.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>
                    <optgroup label={t.nav.groups}>{lk.activeGroups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}</optgroup>
                  </Select>
                </Field>
                <Field label={t.common.subject}>
                  <Select name="subject_id" defaultValue=""><option value="">{t.common.none}</option>{lk.subjects.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
                </Field>
                <Submit icon="plus">{t.teachers.assign}</Submit>
              </form>
            </Card>
          </div>
        )}

        {tab === "schedule" && (
          <Card title={t.teachers.tabSchedule} description={`${entries.length} ${t.timetable.sessionsCount} · ${Math.round((weeklyMin / 60) * 10) / 10} ${t.timetable.hours}`} actions={<ButtonLink small variant="secondary" href={`${b}/timetable?teacher=${id}`} icon="calendar">{t.nav.timetable}</ButtonLink>}>
            {entries.length ? (
              <WeekGrid
                days={[1, 2, 3, 4, 5, 6, ...(entries.some((e) => e.weekday === 7) ? [7] : [])]}
                dayNames={t.timetable.days}
                minutesLabel={t.timetable.minutes}
                emptyDay={t.timetable.noSessionsDay}
                sessions={entries.map((e) => ({ id: e.id, weekday: e.weekday, starts_at: e.starts_at, ends_at: e.ends_at, title: e.subjects?.name ?? "—", subtitle: e.classes?.name ?? e.groups?.name, room: e.room, colorKey: e.subjects?.name ?? e.id }))}
              />
            ) : <EmptyState icon="calendar" title={t.teachers.noSchedule} />}
          </Card>
        )}

        {tab === "attendance" && (
          <Card title={t.teachers.sessionsRecorded} bodyClassName="p-0">
            {sessions.length ? (
              <ul className="divide-y divide-slate-100">
                {sessions.map((s) => (
                  <li key={s.date + s.scope} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 truncate"><span className="font-medium text-slate-900">{date(s.date, locale)}</span> <span className="text-slate-500">· {s.scope}</span></span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">{s.n} {t.common.student.toLowerCase()}{s.absent > 0 && <Badge tone="red">{s.absent} {t.status.absent.toLowerCase()}</Badge>}</span>
                  </li>
                ))}
              </ul>
            ) : <div className="p-5"><EmptyState icon="attendance" title={t.teachers.noSessions} /></div>}
          </Card>
        )}

        {tab === "pay" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card title={t.remuneration.statements} className="xl:col-span-2" bodyClassName="p-0" actions={<ButtonLink small href={`${b}/remuneration`} icon="wallet">{t.remuneration.pay}</ButtonLink>}>
              {statements.length ? (
                <ul className="divide-y divide-slate-100">
                  {statements.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                      <div className="min-w-[8rem] flex-1"><div className="text-sm font-medium text-slate-900">{monthLabel(s.period, locale)}</div><div className="text-xs text-slate-500">{t.remuneration.calculatedAt} {date(s.calculated_at, locale)}</div></div>
                      <div className="grid grid-cols-3 gap-4 text-end text-xs sm:text-sm">
                        <div><div className="text-slate-500">{t.remuneration.calculated}</div><div className="tabular-nums">{m(s.calculated_amount)}</div></div>
                        <div><div className="text-slate-500">{t.remuneration.paid}</div><div className="tabular-nums text-emerald-700">{m(s.paid)}</div></div>
                        <div><div className="text-slate-500">{t.remuneration.outstanding}</div><div className="font-semibold tabular-nums">{m(s.outstanding)}</div></div>
                      </div>
                      <Link href={`${b}/remuneration/statement/${s.id}`} className="text-xs font-medium text-brand-700 hover:underline">{t.remuneration.printStatement}</Link>
                    </li>
                  ))}
                </ul>
              ) : <div className="p-5"><EmptyState icon="wallet" title={t.remuneration.noStatements} /></div>}
            </Card>
            <div className="space-y-6">
              <Card title={t.remuneration.rules}>
                {(rules.data ?? []).length ? (
                  <ul className="space-y-2 text-sm">
                    {((rules.data ?? []) as any[]).map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-slate-700">{r.classes?.name ?? r.groups?.name ?? t.remuneration.defaultRule}</span>
                        <Badge tone="blue">{r.percentage}% · {r.basis === "due" ? t.remuneration.due : t.remuneration.collected}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-slate-500">{t.remuneration.noRules}</p>}
              </Card>
              <Card title={t.remuneration.history} bodyClassName="p-0">
                {payouts.length ? (
                  <ul className="divide-y divide-slate-100">
                    {payouts.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                        <span className="min-w-0"><span className="block text-slate-800">{date(p.paid_on, locale)} · {p.method}</span><span className="block text-xs text-slate-500">{monthLabel(p.period, locale)}{p.note ? ` · ${p.note}` : ""}</span></span>
                        <span className="font-semibold tabular-nums text-slate-900">{m(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <div className="p-5"><EmptyState icon="card" title={t.remuneration.noPayouts} /></div>}
              </Card>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
