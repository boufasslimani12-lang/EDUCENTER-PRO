import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { money, date, monthLabel } from "@/lib/format";
import { PageHeader, Card, Flash, Table, Td, Badge, statusTone, ButtonLink } from "@/components/ui";
import { Submit } from "@/components/client";
import { EnrollmentFields, StudentFields } from "@/components/enrollment-fields";
import { updateStudent, setArchived, enroll, withdraw, saveDocuments } from "../actions";

export default async function StudentPage({ params, searchParams }: Props<{ id: string }>) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t, locale } = await getT();
  const lk = await lookups(supabase, tenant.id);

  const { data: s } = await supabase.from("students").select("*").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
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

  const enrollments = (enr.data ?? []) as any[];
  const current = enrollments.find((e) => e.academic_year_id === lk.activeYear?.id);
  const received = new Set((docs.data ?? []).filter((d: any) => d.received).map((d: any) => d.requirement_id));
  const reqList = (reqs.data ?? []) as any[];
  const complete = reqList.every((r) => received.has(r.id));
  const attRows = (att.data ?? []) as any[];
  const b = `/t/${slug}`;

  return (
    <>
      <PageHeader
        title={`${s.last_name} ${s.first_name}`}
        subtitle={<>{s.code ?? ""} {s.archived_at && <Badge>{t.students.archived}</Badge>}</>}
        actions={<>
          <ButtonLink variant="secondary" href={`${b}/students`}>{t.common.back}</ButtonLink>
          <form action={setArchived.bind(null, slug, id, !s.archived_at)}>
            <Submit variant={s.archived_at ? "secondary" : "danger"} confirm={t.common.confirm + " ?"}>{s.archived_at ? t.common.restore : t.common.archive}</Submit>
          </form>
        </>}
      />
      <Flash sp={sp} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title={t.students.profile}>
            <form action={updateStudent.bind(null, slug, id)} className="space-y-4">
              <StudentFields t={t} s={s} />
              <div className="flex justify-end"><Submit>{t.common.save}</Submit></div>
            </form>
          </Card>

          {lk.activeYear && (
            <Card title={current ? `${t.students.enroll} — ${lk.activeYear.name}` : t.students.noEnrollment}>
              <form action={enroll.bind(null, slug, id)} className="space-y-4">
                <EnrollmentFields t={t} years={lk.years.filter((y) => !y.archived_at)} classes={lk.classes} groups={lk.activeGroups}
                  defaults={{
                    academic_year_id: lk.activeYear.id, class_id: current?.class_id,
                    monthly_fee: current ? Number(current.monthly_fee) : Number(tenant.default_monthly_fee),
                    monthly_discount: Number(current?.monthly_discount ?? 0),
                    groups: (current?.student_groups ?? []).map((g: any) => g.group_id),
                  }} />
                <div className="flex justify-end"><Submit>{current ? t.common.save : t.students.reenroll}</Submit></div>
              </form>
            </Card>
          )}

          <Card title={t.payments.installments} actions={<ButtonLink small variant="secondary" href={`${b}/payments?student=${id}`}>{t.payments.record}</ButtonLink>}>
            <Table head={[t.common.period, t.payments.invoiceNo, t.payments.due, t.common.discount, t.payments.paid, t.payments.balance, t.common.status, ""]} empty={!inst.data?.length && t.common.empty}>
              {(inst.data ?? []).map((i: any) => (
                <tr key={i.id}>
                  <Td>{monthLabel(i.period, locale)}</Td>
                  <Td className="text-slate-500">{i.invoice_no}</Td>
                  <Td className="tabular-nums">{money(i.amount_due, locale)}</Td>
                  <Td className="tabular-nums">{money(i.discount, locale)}</Td>
                  <Td className="tabular-nums">{money(i.amount_paid, locale)}</Td>
                  <Td className="tabular-nums font-medium">{money(i.balance, locale)}</Td>
                  <Td><Badge tone={statusTone(i.payment_status)}>{t.status[i.payment_status as keyof typeof t.status]}</Badge></Td>
                  <Td><Link className="text-xs text-brand-700 hover:underline" href={`${b}/documents/invoice/${i.id}`}>{t.payments.invoice}</Link></Td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card title={t.students.paymentHistory}>
            <Table head={[t.payments.receiptNo, t.payments.paidOn, t.common.amount, t.common.method, t.common.status, ""]} empty={!pays.data?.length && t.common.empty}>
              {(pays.data ?? []).map((p: any) => (
                <tr key={p.id}>
                  <Td>{p.receipt_no}</Td>
                  <Td>{date(p.paid_on, locale)}</Td>
                  <Td className="tabular-nums">{money(p.amount, locale)}</Td>
                  <Td>{p.method}</Td>
                  <Td>{p.voided_at ? <Badge tone="red">{t.status.voided}</Badge> : <Badge tone="green">{t.status.paid}</Badge>}</Td>
                  <Td><Link className="text-xs text-brand-700 hover:underline" href={`${b}/documents/receipt/${p.id}`}>{t.payments.receipt}</Link></Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>

        <div className="space-y-6">
          {reqList.length > 0 && (
            <Card title={t.students.documents} actions={<Badge tone={complete ? "green" : "amber"}>{complete ? t.students.complete : t.students.incomplete}</Badge>}>
              <form action={saveDocuments.bind(null, slug, id)} className="space-y-2">
                {reqList.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <input type="hidden" name="req" value={r.id} />
                    <input type="checkbox" name="received" value={r.id} defaultChecked={received.has(r.id)} />
                    {r.name}
                  </label>
                ))}
                <div className="pt-2"><Submit small variant="secondary">{t.common.save}</Submit></div>
              </form>
            </Card>
          )}

          <Card title={t.students.enrollmentHistory}>
            <ul className="space-y-3 text-sm">
              {enrollments.map((e) => (
                <li key={e.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{e.academic_years?.name}</span>
                    <Badge tone={e.status === "active" ? "green" : "gray"}>{e.status}</Badge>
                  </div>
                  <div className="text-slate-600">{e.classes?.name ?? "—"} · {(e.student_groups ?? []).map((g: any) => g.groups?.name).join(", ")}</div>
                  <div className="text-xs text-slate-500">{money(e.monthly_fee, locale)} − {money(e.monthly_discount, locale)} · {date(e.enrolled_on, locale)}</div>
                  {e.status === "active" && (
                    <form action={withdraw.bind(null, slug, e.id, id)} className="mt-2">
                      <Submit small variant="ghost" confirm={t.common.confirm + " ?"}>{t.common.archive}</Submit>
                    </form>
                  )}
                </li>
              ))}
              {!enrollments.length && <li className="text-slate-500">{t.common.empty}</li>}
            </ul>
          </Card>

          <Card title={t.students.attendanceHistory}>
            <ul className="divide-y divide-slate-100 text-sm">
              {attRows.map((a, i) => (
                <li key={i} className="flex items-center justify-between py-1.5">
                  <span>{date(a.session_date, locale)} · <span className="text-slate-500">{a.classes?.name ?? a.groups?.name}</span></span>
                  <Badge tone={statusTone(a.status)}>{t.status[a.status as "present"]}{a.minutes_late ? ` (${a.minutes_late}′)` : ""}</Badge>
                </li>
              ))}
              {!attRows.length && <li className="text-slate-500">{t.common.empty}</li>}
            </ul>
          </Card>

          <Card title={t.students.gradesHistory}>
            <ul className="divide-y divide-slate-100 text-sm">
              {(grades.data ?? []).map((g: any, i: number) => (
                <li key={i} className="py-1.5">
                  <div className="flex justify-between"><span>{g.assessments?.subjects?.name} — {g.assessments?.title}</span><span className="tabular-nums font-medium">{g.score ?? "—"}/{g.assessments?.max_score}</span></div>
                  {g.observation && <div className="text-xs text-slate-500">{g.observation}</div>}
                </li>
              ))}
              {!grades.data?.length && <li className="text-slate-500">{t.common.empty}</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
