import type { Dictionary } from "@/lib/i18n";
import { Field, Input, Textarea, FormSection } from "./ui";

/** Teacher inputs grouped by topic. Field names are the contract with teachers/actions.ts. */
export function TeacherFields({ t, v }: { t: Dictionary; v?: Record<string, any> }) {
  return (
    <>
      <FormSection title={t.students.identity} description={t.teachers.personalHint}>
        <Field label={t.auth.fullName} required><Input name="full_name" required minLength={2} maxLength={120} defaultValue={v?.full_name} autoComplete="off" /></Field>
      </FormSection>
      <FormSection title={t.students.contactInfo} description={t.teachers.contactHint}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.common.email}><Input name="email" type="email" dir="ltr" maxLength={160} defaultValue={v?.email ?? ""} /></Field>
          <Field label={t.common.phone}><Input name="phone" type="tel" inputMode="tel" dir="ltr" maxLength={40} defaultValue={v?.phone ?? ""} /></Field>
        </div>
      </FormSection>
      <FormSection title={t.teachers.professional} description={t.teachers.professionalHint}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.teachers.specialization}><Input name="specialization" maxLength={120} defaultValue={v?.specialization ?? ""} /></Field>
          <Field label={t.teachers.hireDate}><Input name="hire_date" type="date" defaultValue={v?.hire_date ?? ""} /></Field>
          <Field label={t.common.notes} className="sm:col-span-2"><Textarea name="notes" rows={3} defaultValue={v?.notes ?? ""} /></Field>
        </div>
      </FormSection>
    </>
  );
}
