import { Field, Input, Select, FormSection, Textarea } from "./ui";
import type { Dictionary } from "@/lib/i18n";

type Opt = { id: string; name: string; academic_year_id?: string; monthly_fee?: number | null };

/** Enrollment inputs: year, primary class, monthly fee / discount and group memberships. */
export function EnrollmentFields({ t, years, classes, groups, defaults }: {
  t: Dictionary; years: Opt[]; classes: Opt[]; groups: Opt[];
  defaults?: { academic_year_id?: string; class_id?: string | null; monthly_fee?: number; monthly_discount?: number; groups?: string[] };
}) {
  const sel = new Set(defaults?.groups ?? []);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.common.academicYear} required>
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
        <Field label={t.common.fee} hint="MAD / mois">
          <Input name="monthly_fee" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={defaults?.monthly_fee ?? 0} />
        </Field>
        <Field label={t.common.discount} hint="MAD / mois">
          <Input name="monthly_discount" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={defaults?.monthly_discount ?? 0} />
        </Field>
      </div>
      {groups.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-slate-700">{t.students.groups}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <label key={g.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition hover:border-brand-200 has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/60">
                <input type="checkbox" name="groups" value={g.id} defaultChecked={sel.has(g.id)} className="rounded border-slate-300 text-brand-600" />
                <span className="min-w-0 flex-1 truncate text-slate-800">{g.name}</span>
                {g.monthly_fee ? <span className="shrink-0 text-xs tabular-nums text-slate-500">+{g.monthly_fee} MAD</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

/** Student profile inputs grouped by topic. Field names are the contract with the server actions. */
export function StudentFields({ t, s }: { t: Dictionary; s?: Record<string, any> }) {
  return (
    <>
      <FormSection title={t.students.identity} description={t.students.identityHint}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.students.lastName} required><Input name="last_name" required maxLength={80} autoComplete="off" defaultValue={s?.last_name} /></Field>
          <Field label={t.students.firstName} required><Input name="first_name" required maxLength={80} autoComplete="off" defaultValue={s?.first_name} /></Field>
          <Field label={t.students.birthDate}><Input name="birth_date" type="date" defaultValue={s?.birth_date ?? ""} /></Field>
          <Field label={t.students.gender}>
            <Select name="gender" defaultValue={s?.gender ?? ""}>
              <option value="">{t.common.none}</option>
              <option value="m">{t.students.male}</option>
              <option value="f">{t.students.female}</option>
            </Select>
          </Field>
          <Field label={t.students.code} hint={t.common.optional}><Input name="code" maxLength={40} defaultValue={s?.code ?? ""} /></Field>
        </div>
      </FormSection>
      <FormSection title={t.students.contactInfo} description={t.students.contactHint}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.common.phone}><Input name="phone" type="tel" inputMode="tel" dir="ltr" defaultValue={s?.phone ?? ""} /></Field>
          <Field label={t.common.email}><Input name="email" type="email" dir="ltr" defaultValue={s?.email ?? ""} /></Field>
          <Field label={t.common.address} className="sm:col-span-2"><Input name="address" defaultValue={s?.address ?? ""} /></Field>
        </div>
      </FormSection>
      <FormSection title={t.students.guardian} description={t.students.guardianHint}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t.students.guardianName}><Input name="guardian_name" defaultValue={s?.guardian_name ?? ""} /></Field>
          <Field label={t.students.guardianPhone}><Input name="guardian_phone" type="tel" inputMode="tel" dir="ltr" defaultValue={s?.guardian_phone ?? ""} /></Field>
          <Field label={t.students.guardianRelation}><Input name="guardian_relation" defaultValue={s?.guardian_relation ?? ""} /></Field>
        </div>
      </FormSection>
      <FormSection title={t.common.notes}>
        <Textarea name="notes" rows={3} defaultValue={s?.notes ?? ""} />
      </FormSection>
    </>
  );
}
