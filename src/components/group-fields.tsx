import type { Dictionary } from "@/lib/i18n";
import { Field, Input, Select } from "./ui";

/** Group inputs (name, subject, level, fee, capacity); names match structure/actions.ts. */
export function groupFormFields(t: Dictionary, lk: any, g?: any) {
  return (
    <>
      <Field label={t.common.name} required><Input name="name" required maxLength={60} defaultValue={g?.name} /></Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.common.subject}><Select name="subject_id" defaultValue={g?.subject_id ?? ""}><option value="">{t.common.none}</option>{lk.subjects.filter((s: any) => s.is_active || s.id === g?.subject_id).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label={t.common.level}><Select name="level_id" defaultValue={g?.level_id ?? ""}><option value="">{t.common.none}</option>{lk.levels.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label={t.structure.groupFee} hint={t.groups.feeHint}><Input name="monthly_fee" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={g?.monthly_fee ?? ""} /></Field>
        <Field label={t.structure.capacity} hint={t.structure.capacityHint}><Input name="capacity" type="number" step="1" min="1" inputMode="numeric" defaultValue={g?.capacity ?? ""} /></Field>
      </div>
    </>
  );
}
