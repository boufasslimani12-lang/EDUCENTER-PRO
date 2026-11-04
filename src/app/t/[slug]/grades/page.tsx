import Link from "next/link";
import { requireOperational, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { today, date } from "@/lib/format";
import { scopesFor, parseScope, roster } from "@/lib/scopes";
import { PageHeader, Card, Flash, Input, Select, Field, Table, Td } from "@/components/ui";
import { Submit, AutoSubmitSelect } from "@/components/client";
import { addAssessment, saveGrades } from "./actions";

export default async function GradesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant, role, teacherId } = await requireOperational(slug);
  const { t, locale } = await getT();
  const scopes = await scopesFor(supabase, tenant.id, role, teacherId);
  const scope = parseScope(sp.scope, scopes);
  const { data: subjects } = await supabase.from("subjects").select("id, name").eq("tenant_id", tenant.id).eq("is_active", true).order("name");

  let assessments: any[] = [];
  let current: any = null;
  let students: Awaited<ReturnType<typeof roster>> = [];
  const grades = new Map<string, any>();
  if (scope) {
    let q = supabase.from("assessments").select("*, subjects(name), grades(score)").order("held_on", { ascending: false });
    q = scope.class_id ? q.eq("class_id", scope.class_id) : q.eq("group_id", scope.group_id!);
    assessments = (await q).data ?? [];
    current = assessments.find((a) => a.id === sp.a) ?? null;
    if (current) {
      students = await roster(supabase, scope);
      const { data } = await supabase.from("grades").select("student_id, score, observation").eq("assessment_id", current.id);
      (data ?? []).forEach((g: any) => grades.set(g.student_id, g));
    }
  }
  const avg = (a: any) => {
    const s = (a.grades ?? []).map((g: any) => g.score).filter((x: any) => x !== null).map(Number);
    return s.length ? (s.reduce((x: number, y: number) => x + y, 0) / s.length).toFixed(2) : "—";
  };
  const base = `/t/${slug}/grades?scope=${encodeURIComponent(scope?.key ?? "")}`;

  return (
    <>
      <PageHeader title={t.grades.title} />
      <Flash sp={sp} />
      <form className="mb-6 max-w-sm">
        <AutoSubmitSelect name="scope" defaultValue={scope?.key ?? ""}>
          <option value="" disabled>{t.common.class} / {t.common.group}</option>
          {scopes.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </AutoSubmitSelect>
      </form>
      {scope && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6">
            <Card title={t.grades.assessment}>
              <ul className="divide-y divide-slate-100 text-sm">
                {assessments.map((a) => (
                  <li key={a.id}>
                    <Link href={`${base}&a=${a.id}`} className={`flex justify-between py-2 hover:text-brand-700 ${current?.id === a.id ? "font-semibold text-brand-700" : ""}`}>
                      <span>{a.subjects?.name} — {a.title}<br /><span className="text-xs text-slate-500">{date(a.held_on, locale)}</span></span>
                      <span className="tabular-nums text-slate-600">{t.grades.average}: {avg(a)}/{a.max_score}</span>
                    </Link>
                  </li>
                ))}
                {!assessments.length && <li className="py-2 text-slate-500">{t.common.empty}</li>}
              </ul>
            </Card>
            <Card title={t.grades.newAssessment}>
              <form action={addAssessment.bind(null, slug)} className="space-y-3">
                <input type="hidden" name="scope" value={scope.key} />
                <Field label={t.common.subject}><Select name="subject_id" required>{(subjects ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
                <Field label={t.grades.assessment}><Input name="title" required /></Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label={t.common.date}><Input name="held_on" type="date" defaultValue={today()} /></Field>
                  <Field label={t.grades.maxScore}><Input name="max_score" type="number" step="0.5" defaultValue={20} /></Field>
                  <Field label={t.structure.coefficient}><Input name="coefficient" type="number" step="0.5" defaultValue={1} /></Field>
                </div>
                <Submit>{t.common.create}</Submit>
              </form>
            </Card>
          </div>
          {current && (
            <form action={saveGrades.bind(null, slug, current.id, `${base}&a=${current.id}`)} className="xl:col-span-2">
              <Card title={`${current.subjects?.name} — ${current.title} (/${current.max_score})`} actions={<Submit>{t.common.save}</Submit>}>
                <Table head={[t.common.student, t.grades.score, t.grades.observation]} empty={!students.length && t.attendance.noStudents}>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <Td className="font-medium"><input type="hidden" name="student" value={s.id} />{s.last_name} {s.first_name}</Td>
                      <Td><Input name={`score_${s.id}`} type="number" step="0.25" min="0" max={current.max_score} className="w-24" defaultValue={grades.get(s.id)?.score ?? ""} /></Td>
                      <Td><Input name={`obs_${s.id}`} className="min-w-[16rem]" defaultValue={grades.get(s.id)?.observation ?? ""} /></Td>
                    </tr>
                  ))}
                </Table>
              </Card>
            </form>
          )}
        </div>
      )}
    </>
  );
}
