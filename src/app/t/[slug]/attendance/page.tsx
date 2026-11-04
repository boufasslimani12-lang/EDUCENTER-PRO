import { requireOperational, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { today, date, pct } from "@/lib/format";
import { scopesFor, parseScope, roster } from "@/lib/scopes";
import { PageHeader, Card, Flash, Input, Select, Field, Table, Td } from "@/components/ui";
import { Submit } from "@/components/client";
import { saveAttendance } from "./actions";

export default async function AttendancePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant, role, teacherId } = await requireOperational(slug);
  const { t, locale } = await getT();
  const scopes = await scopesFor(supabase, tenant.id, role, teacherId);
  const scope = parseScope(sp.scope, scopes);
  const day = sp.date ?? today();

  let students: Awaited<ReturnType<typeof roster>> = [];
  const existing = new Map<string, any>();
  let history: any[] = [];
  if (scope) {
    students = await roster(supabase, scope);
    let q = supabase.from("attendance_records").select("student_id, status, minutes_late, note").eq("session_date", day).is("timetable_entry_id", null);
    q = scope.class_id ? q.eq("class_id", scope.class_id) : q.eq("group_id", scope.group_id!);
    const { data } = await q;
    (data ?? []).forEach((r: any) => existing.set(r.student_id, r));
    let h = supabase.from("attendance_records").select("session_date, status").order("session_date", { ascending: false }).limit(2000);
    h = scope.class_id ? h.eq("class_id", scope.class_id) : h.eq("group_id", scope.group_id!);
    const { data: hd } = await h;
    const byDay = new Map<string, { n: number; abs: number; late: number }>();
    for (const r of (hd ?? []) as any[]) {
      const d = byDay.get(r.session_date) ?? { n: 0, abs: 0, late: 0 };
      d.n++; if (r.status === "absent") d.abs++; if (r.status === "late") d.late++;
      byDay.set(r.session_date, d);
    }
    history = Array.from(byDay.entries()).slice(0, 15).map(([d, v]) => ({ d, ...v }));
  }

  return (
    <>
      <PageHeader title={t.attendance.title} />
      <Flash sp={sp} />
      <Card>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px_auto]">
          <Field label={`${t.common.class} / ${t.common.group}`}>
            <Select name="scope" defaultValue={scope?.key ?? ""} required>
              <option value="" disabled>—</option>
              {scopes.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label={t.common.date}><Input type="date" name="date" defaultValue={day} /></Field>
          <div className="flex items-end"><button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">{t.common.filter}</button></div>
        </form>
      </Card>

      {!scope && <p className="mt-6 text-sm text-slate-500">{t.attendance.pick}</p>}
      {scope && (
        <form action={saveAttendance.bind(null, slug)} className="mt-6">
          <input type="hidden" name="scope" value={scope.key} />
          <input type="hidden" name="date" value={day} />
          <Card title={`${scope.name} · ${date(day, locale)}`} actions={students.length > 0 && <Submit>{t.attendance.saveAll}</Submit>}>
            <Table head={[t.common.student, t.common.status, t.attendance.minutesLate, t.common.notes]} empty={!students.length && t.attendance.noStudents}>
              {students.map((s) => {
                const r = existing.get(s.id);
                const cur = r?.status ?? "present";
                return (
                  <tr key={s.id}>
                    <Td className="font-medium">
                      <input type="hidden" name="student" value={s.id} />
                      {s.last_name} {s.first_name}
                    </Td>
                    <Td>
                      <div className="flex gap-3">
                        {(["present", "absent", "late"] as const).map((st) => (
                          <label key={st} className="flex items-center gap-1 text-xs">
                            <input type="radio" name={`status_${s.id}`} value={st} defaultChecked={cur === st} />
                            {t.status[st]}
                          </label>
                        ))}
                      </div>
                    </Td>
                    <Td><Input name={`late_${s.id}`} type="number" min="0" className="w-20" defaultValue={r?.minutes_late ?? ""} /></Td>
                    <Td><Input name={`note_${s.id}`} className="w-48" defaultValue={r?.note ?? ""} /></Td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </form>
      )}

      {scope && history.length > 0 && (
        <Card title={t.attendance.history} className="mt-6">
          <Table head={[t.common.date, t.status.absent, t.status.late, t.attendance.rate]}>
            {history.map((h) => (
              <tr key={h.d}>
                <Td>{date(h.d, locale)}</Td>
                <Td className="tabular-nums">{h.abs}</Td>
                <Td className="tabular-nums">{h.late}</Td>
                <Td className="tabular-nums">{pct(((h.n - h.abs) / h.n) * 100)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
