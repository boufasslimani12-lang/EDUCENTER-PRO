import { Field, Input, Select, Grid } from "./ui";
import type { Dictionary } from "@/lib/i18n";

type Opt = { id: string; name: string; academic_year_id?: string; monthly_fee?: number | null };

export function EnrollmentFields({ t, years, classes, groups, defaults }: {
  t: Dictionary; years: Opt[]; classes: Opt[]; groups: Opt[];
  defaults?: { academic_year_id?: string; class_id?: string | null; monthly_fee?: number; monthly_discount?: number; groups?: string[] };
}) {
  const sel = new Set(defaults?.groups ?? []);
  return (
    <div className="space-y-4">
      <Grid cols={2}>
        <Field label={t.common.academicYear}>
          <Select name="academic_year_id" defaultValue={defaults?.academic_year_id} required>
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </Select>
        </Field>
        <Field label={t.students.primaryClass}>
          <Select name="class_id" defaultValue={defaults?.class_id ?? ""}>
            <option value="">{t.common.none}</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label={t.common.fee} hint="MAD">
          <Input name="monthly_fee" type="number" min="0" step="0.01" defaultValue={defaults?.monthly_fee ?? 0} />
        </Field>
        <Field label={t.common.discount} hint="MAD / mois">
          <Input name="monthly_discount" type="number" min="0" step="0.01" defaultValue={defaults?.monthly_discount ?? 0} />
        </Field>
      </Grid>
      {groups.length > 0 && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">{t.students.groups}</legend>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <input type="checkbox" name="groups" value={g.id} defaultChecked={sel.has(g.id)} />
                <span>{g.name}</span>
                {g.monthly_fee ? <span className="ms-auto text-xs text-slate-500">+{g.monthly_fee} MAD</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

export function StudentFields({ t, s }: { t: Dictionary; s?: Record<string, any> }) {
  return (
    <div className="space-y-4">
      <Grid cols={3}>
        <Field label={t.students.lastName + " *"}><Input name="last_name" required defaultValue={s?.last_name} /></Field>
        <Field label={t.students.firstName + " *"}><Input name="first_name" required defaultValue={s?.first_name} /></Field>
        <Field label={t.students.code}><Input name="code" defaultValue={s?.code ?? ""} /></Field>
        <Field label={t.students.birthDate}><Input name="birth_date" type="date" defaultValue={s?.birth_date ?? ""} /></Field>
        <Field label={t.students.gender}>
          <Select name="gender" defaultValue={s?.gender ?? ""}>
            <option value="">{t.common.none}</option>
            <option value="m">{t.students.male}</option>
            <option value="f">{t.students.female}</option>
          </Select>
        </Field>
        <Field label={t.common.phone}><Input name="phone" type="tel" dir="ltr" defaultValue={s?.phone ?? ""} /></Field>
        <Field label={t.common.email}><Input name="email" type="email" dir="ltr" defaultValue={s?.email ?? ""} /></Field>
        <Field label={t.common.address} className="sm:col-span-2"><Input name="address" defaultValue={s?.address ?? ""} /></Field>
      </Grid>
      <Grid cols={3}>
        <Field label={t.students.guardianName}><Input name="guardian_name" defaultValue={s?.guardian_name ?? ""} /></Field>
        <Field label={t.students.guardianPhone}><Input name="guardian_phone" type="tel" dir="ltr" defaultValue={s?.guardian_phone ?? ""} /></Field>
        <Field label={t.students.guardianRelation}><Input name="guardian_relation" defaultValue={s?.guardian_relation ?? ""} /></Field>
      </Grid>
      <Field label={t.common.notes}><textarea name="notes" rows={2} defaultValue={s?.notes ?? ""} className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></Field>
    </div>
  );
}
