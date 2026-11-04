import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { PageHeader, Card, Flash } from "@/components/ui";
import { Submit } from "@/components/client";
import { EnrollmentFields, StudentFields } from "@/components/enrollment-fields";
import { createStudent } from "../actions";

export default async function NewStudent({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t } = await getT();
  const lk = await lookups(supabase, tenant.id);
  return (
    <>
      <PageHeader title={t.students.new} />
      <Flash sp={sp} />
      <form action={createStudent.bind(null, slug)} className="space-y-6">
        <Card title={t.students.profile}><StudentFields t={t} /></Card>
        {lk.activeYear && (
          <Card title={t.students.enroll}>
            <EnrollmentFields t={t} years={[lk.activeYear]} classes={lk.activeClasses} groups={lk.activeGroups}
              defaults={{ academic_year_id: lk.activeYear.id, monthly_fee: Number(tenant.default_monthly_fee) }} />
          </Card>
        )}
        <div className="flex justify-end"><Submit>{t.common.create}</Submit></div>
      </form>
    </>
  );
}
