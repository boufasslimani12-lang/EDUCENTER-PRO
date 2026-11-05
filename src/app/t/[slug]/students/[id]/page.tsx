import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { money, date, monthLabel, pct } from "@/lib/format";
import { Card, Flash, Badge, statusTone, ButtonLink, Avatar, Tabs, InfoItem, EmptyState, cx } from "@/components/ui";
import { Submit, Menu, menuItemClass } from "@/components/client";
import { Icon } from "@/components/icons";
import { EnrollmentFields, StudentFields } from "@/components/enrollment-fields";
import { updateStudent, setArchived, enroll, withdraw, saveDocuments } from "../actions";

type Tab = "overview" | "enrollment" | "finance" | "academic";

export default async function StudentPage({ params, searchParams }: Props<{ id: string }>) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const lk = await lookups(supabase, tenant.id);

  const { data: s, error: sErr } = await supabase.from("students").select("*").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!s) notFound();

  const [enr, docs, reqs, inst, pays, att, grades] = await Promise.all([
    supabase.from("enrollments").select("*, academic_years(name, is_active), classes(name), student_groups(group_id, groups(name))").eq("student_id", id).order("enrolled_on", { ascending: false }),
    supabase.from("student_documents").select("requirement_id, received").eq("student_id", id),
    supabase.from("document_requirements").select("id, name").eq("tenant_id", tenant.id).eq("is_active", true).order("name"),
    supabase.from("installment_balances").select("*").eq("student_id", id).order("period", { ascending: false }).limit(24),
    supabase.from("payments").select("*").eq("student_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("attendance_records").select("session_date, status, minutes_late, classes(name), groups(name)").eq("student_id", id).order("session_date", { ascending: false }).limit(30),
    supabase.from("grades").select("score, observation, assessments(title, held_on, max_score, subjects(name))").eq("student_id", id).limit(50),
  ]);
  for (const r of [enr, docs, reqs, inst, pays, att, grades]) if (r.error) throw new Error(r.error.message);

  const enrollments = (enr.data ?? []) as any[];
  const current = enrollments.find((e) => e.academic_year_id === lk.activeYear?.id);
  const received = new Set((docs.data ?? []).filter((d: any) => d.received).map((d: any) => d.requirement_id));
  const reqList = (reqs.data ?? []) as any[];
  const complete = reqList.every((r) => received.has(r.id));
  const installments = (inst.data ?? []) as any[];
  const payments = (pays.data ?? []) as any[];
  const attRows = (att.data ?? []) as any[];
  const gradeRows = (grades.data ?? []) as any[];
  const balanceDue = installments.reduce((sum, i) => sum + Math.max(0, Number(i.balance)), 0);
  const attRate = attRows.length ? (attRows.filter((a) => a.status !== "absent").length / attRows.length) * 100 : null;
  const name = `${s.last_name} ${s.first_name}`;
  const groupNames = (current?.student_groups ?? []).map((g: any) => g.groups?.name).filter(Boolean) as string[];

  const tab: Tab = (["enrollment", "finance", "academic"] as const).find((k) => k === sp.tab) ?? "overview";
  const base = `/t/${slug}/students/${id}`;
  const b = `/t/${slug}`;
  const m = (n: unknown) => money(n as number, locale, tenant.currency);

  return (
    <>
      <Link href={`${b}/students`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <Icon name="chevronLeft" className="h-4 w-4 rtl:rotate-180" />{t.students.title}
      </Link>
      <Flash sp={sp} dismissLabel={t.common.dismiss} />

      {/* Header */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-card">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
          <Avatar name={name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{name}</h1>
              {s.archived_at ? <Badge>{t.students.archived}</Badge> : current?.status === "active" ? <Badge tone="green">{t.common.active}</Badge> : <Badge tone="amber">{t.students.noEnrollment}</Badge>}
              {reqList.length > 0 && <Badge tone={complete ? "green" : "amber"}>{t.students.docsStatus}: {complete ? t.students.complete : t.students.incomplete}</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {[s.code, current?.classes?.name, groupNames.join(", "), lk.activeYear?.name].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!s.archived_at && <ButtonLink href={`${b}/payments?student=${id}`} icon="card">{t.payments.record}</ButtonLink>}
            <Menu label={t.common.moreActions}>
              <Link href={`${b}/payments?student=${id}`} className={menuItemClass}><Icon name="card" className="h-4 w-4 text-slate-400" />{t.students.viewPayments}</Link>
              <Link href={`${base}?tab=enrollment`} className={menuItemClass}><Icon name="layers" className="h-4 w-4 text-slate-400" />{t.students.enroll}</Link>
              <div className="my-1 h-px bg-slate-100" />
              <form action={setArchived.bind(null, slug, id, !s.archived_at)}>
                <Submit variant="ghost" className={cx(menuItemClass, "justify-start font-normal", s.archived_at ? "text-slate-700" : "text-rose-700 hover:bg-rose-50")} confirm={s.archived_at ? t.students.restoreConfirm : t.students.archiveConfirm} icon={s.archived_at ? "refresh" : "inbox"}>
                  {s.archived_at ? t.common.restore : t.common.archive}
                </Submit>
              </form>
            </Menu>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl border-t border-slate-100 bg-slate-100 lg:grid-cols-4">
          {[
            { label: t.students.balanceDue, value: m(balanceDue), tone: balanceDue > 0 ? "text-amber-700" : "text-slate-900" },
            { label: t.common.fee, value: current ? m(Number(current.monthly_fee) - Number(current.monthly_discount)) : "—", tone: "text-slate-900" },
            { label: t.attendance.rate, value: attRate === null ? "—" : pct(attRate), tone: "text-slate-900" },
            { label: t.students.docsStatus, value: reqList.length ? `${received.size}/${reqList.length}` : "—", tone: complete ? "text-slate-900" : "text-amber-700" },
          ].map((x) => (
            <div key={x.label} className="bg-white px-5 py-3">
              <dt className="text-xs text-slate-500">{x.label}</dt>
              <dd className={cx("mt-0.5 text-base font-semibold tabular-nums", x.tone)}>{x.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6">
        <Tabs current={tab} tabs={[
          { key: "overview", label: t.students.tabOverview, href: base },
          { key: "enrollment", label: t.students.tabEnrollment, href: `${base}?tab=enrollment`, count: enrollments.length },
          { key: "finance", label: t.students.tabFinance, href: `${base}?tab=finance`, count: installments.length },
          { key: "academic", label: t.students.tabAcademic, href: `${base}?tab=academic` },
        ]} />
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <form action={updateStudent.bind(null, slug, id)} className="xl:col-span-2">
              <Card title={t.students.profile} description={t.common.requiredHint}>
                <StudentFields t={t} s={s} />
                <div className="mt-6 flex justify-end border-t border-slate-100 pt-4"><Submit icon="check">{t.students.saveProfile}</Submit></div>
              </Card>
            </form>
            <div className="space-y-6">
              <Card title={t.students.guardian}>
                <dl className="grid grid-cols-1 gap-3">
                  <InfoItem label={t.students.guardianName}>{s.guardian_name}{s.guardian_relation ? ` (${s.guardian_relation})` : ""}</InfoItem>
                  <InfoItem label={t.students.guardianPhone} dir="ltr">{s.guardian_phone && <a className="text-brand-700 hover:underline" href={`tel:${s.guardian_phone}`}>{s.guardian_phone}</a>}</InfoItem>
                  <InfoItem label={t.common.phone} dir="ltr">{s.phone}</InfoItem>
                  <InfoItem label={t.students.birthDate}>{s.birth_date ? date(s.birth_date, locale) : null}</InfoItem>
                </dl>
              </Card>
              {reqList.length > 0 && (
                <Card title={t.students.documents} actions={<Badge tone={complete ? "green" : "amber"}>{complete ? t.students.complete : t.students.incomplete}</Badge>}>
                  <form action={saveDocuments.bind(null, slug, id)}>
                    <ul className="space-y-1">
                      {reqList.map((r) => (
                        <li key={r.id}>
                          <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                            <input type="hidden" name="req" value={r.id} />
                            <input type="checkbox" name="received" value={r.id} defaultChecked={received.has(r.id)} className="rounded border-slate-300 text-brand-600" />
                            <span className="flex-1 text-slate-700">{r.name}</span>
                            <span className={cx("text-xs", received.has(r.id) ? "text-emerald-700" : "text-slate-400")}>{received.has(r.id) ? t.students.received : t.students.missing}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex justify-end"><Submit small variant="secondary" icon="check">{t.common.save}</Submit></div>
                  </form>
                </Card>
              )}
            </div>
          </div>
        )}

        {tab === "enrollment" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {lk.activeYear ? (
              <form action={enroll.bind(null, slug, id)} className="xl:col-span-2">
                <input type="hidden" name="tab" value="enrollment" />
                <Card title={current ? `${t.students.currentEnrollment} — ${lk.activeYear.name}` : t.students.noEnrollment} description={t.students.enrollHint}>
                  <EnrollmentFields t={t} years={lk.years.filter((y) => !y.archived_at)} classes={lk.classes} groups={lk.activeGroups}
                    defaults={{
                      academic_year_id: lk.activeYear.id, class_id: current?.class_id,
                      monthly_fee: current ? Number(current.monthly_fee) : Number(tenant.default_monthly_fee),
                      monthly_discount: Number(current?.monthly_discount ?? 0),
                      groups: (current?.student_groups ?? []).map((g: any) => g.group_id),
                    }} />
                  <div className="mt-6 flex justify-end border-t border-slate-100 pt-4"><Submit icon="check">{current ? t.common.save : t.students.reenroll}</Submit></div>
                </Card>
              </form>
            ) : <div className="xl:col-span-2"><EmptyState icon="layers" title={t.students.noEnrollment} /></div>}
            <Card title={t.students.enrollmentHistory} bodyClassName="p-0">
              {enrollments.length ? (
                <ol className="divide-y divide-slate-100">
                  {enrollments.map((e) => (
                    <li key={e.id} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">{e.academic_years?.name}</span>
                        <Badge tone={e.status === "active" ? "green" : "gray"}>{e.status}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{e.classes?.name ?? "—"}{(e.student_groups ?? []).length ? ` · ${(e.student_groups ?? []).map((g: any) => g.groups?.name).join(", ")}` : ""}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{m(e.monthly_fee)} − {m(e.monthly_discount)} · {t.students.since} {date(e.enrolled_on, locale)}</div>
                      {e.status === "active" && (
                        <form action={withdraw.bind(null, slug, e.id, id)} className="mt-2">
                          <Submit small variant="ghost" icon="logout" confirm={t.students.withdrawConfirm}>{t.students.withdraw}</Submit>
                        </form>
                      )}
                    </li>
                  ))}
                </ol>
              ) : <div className="p-5"><EmptyState title={t.students.noHistory} /></div>}
            </Card>
          </div>
        )}

        {tab === "finance" && (
          <div className="space-y-6">
            <Card title={t.payments.installments} bodyClassName="p-0" actions={!s.archived_at && <ButtonLink small href={`${b}/payments?student=${id}`} icon="card">{t.payments.record}</ButtonLink>}>
              {installments.length ? (
                <ul className="divide-y divide-slate-100">
                  {installments.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                      <div className="min-w-[9rem] flex-1">
                        <div className="text-sm font-medium text-slate-900">{monthLabel(i.period, locale)}</div>
                        <div className="text-xs text-slate-500">{i.invoice_no} · {t.payments.dueOn} {date(i.due_on, locale)}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-end text-xs sm:text-sm">
                        <div><div className="text-slate-500">{t.payments.due}</div><div className="tabular-nums text-slate-800">{m(Number(i.amount_due) - Number(i.discount))}</div></div>
                        <div><div className="text-slate-500">{t.payments.paid}</div><div className="tabular-nums text-emerald-700">{m(i.amount_paid)}</div></div>
                        <div><div className="text-slate-500">{t.payments.balance}</div><div className="font-semibold tabular-nums text-slate-900">{m(i.balance)}</div></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={statusTone(i.payment_status)}>{t.status[i.payment_status as keyof typeof t.status]}</Badge>
                        <Link className="text-xs font-medium text-brand-700 hover:underline" href={`${b}/documents/invoice/${i.id}`}>{t.payments.invoice}</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <div className="p-5"><EmptyState icon="receipt" title={t.payments.noInstallments} /></div>}
            </Card>
            <Card title={t.students.paymentHistory} bodyClassName="p-0">
              {payments.length ? (
                <ul className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", p.voided_at ? "bg-slate-100 text-slate-400" : "bg-income-soft text-income")}><Icon name="card" className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">{p.receipt_no}</div>
                        <div className="truncate text-xs text-slate-500">{date(p.paid_on, locale)} · {p.method}{p.voided_at && p.void_reason ? ` · ${p.void_reason}` : ""}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={cx("text-sm font-semibold tabular-nums", p.voided_at ? "text-slate-400 line-through" : "text-income")}>{m(p.amount)}</span>
                        {p.voided_at ? <Badge tone="red">{t.status.voided}</Badge> : <Link className="text-xs font-medium text-brand-700 hover:underline" href={`${b}/documents/receipt/${p.id}`}>{t.payments.receipt}</Link>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <div className="p-5"><EmptyState icon="card" title={t.payments.noRecent} /></div>}
            </Card>
          </div>
        )}

        {tab === "academic" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title={t.students.attendanceHistory} bodyClassName="p-0">
              {attRows.length ? (
                <ul className="divide-y divide-slate-100">
                  {attRows.map((a, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                      <span className="min-w-0 truncate">{date(a.session_date, locale)} <span className="text-slate-500">· {a.classes?.name ?? a.groups?.name}</span></span>
                      <Badge tone={statusTone(a.status)}>{t.status[a.status as "present"]}{a.minutes_late ? ` (${a.minutes_late}′)` : ""}</Badge>
                    </li>
                  ))}
                </ul>
              ) : <div className="p-5"><EmptyState icon="attendance" title={t.dashboard.noAttendance} /></div>}
            </Card>
            <Card title={t.students.gradesHistory} bodyClassName="p-0">
              {gradeRows.length ? (
                <ul className="divide-y divide-slate-100">
                  {gradeRows.map((g, i) => (
                    <li key={i} className="px-5 py-2.5 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="min-w-0 truncate text-slate-800">{g.assessments?.subjects?.name} — {g.assessments?.title}</span>
                        <span className="font-semibold tabular-nums text-slate-900">{g.score ?? "—"}/{g.assessments?.max_score}</span>
                      </div>
                      {g.observation && <div className="mt-0.5 text-xs text-slate-500">{g.observation}</div>}
                    </li>
                  ))}
                </ul>
              ) : <div className="p-5"><EmptyState icon="award" title={t.common.empty} /></div>}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
