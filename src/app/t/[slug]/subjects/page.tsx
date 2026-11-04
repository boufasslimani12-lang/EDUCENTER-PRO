import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { lookups } from "@/lib/lookups";
import { PageHeader, Card, Flash, Table, Td, Input, Badge } from "@/components/ui";
import { Submit } from "@/components/client";
import * as A from "../structure/actions";

export default async function SubjectsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, tenant } = await requireAdmin(slug);
  const { t } = await getT();
  const lk = await lookups(supabase, tenant.id);
  return (
    <>
      <PageHeader title={t.nav.subjects} />
      <Flash sp={sp} />
      <Card>
        <Table head={[t.common.name, t.structure.coefficient, t.common.status, ""]} empty={!lk.subjects.length && t.common.empty}>
          {lk.subjects.map((s) => (
            <tr key={s.id}>
              <Td className="font-medium">{s.name}</Td>
              <Td>{s.coefficient ?? "—"}</Td>
              <Td><Badge tone={s.is_active ? "green" : "gray"}>{s.is_active ? t.common.active : t.common.inactive}</Badge></Td>
              <Td className="flex gap-1">
                <form action={A.toggleSubject.bind(null, slug, s.id, !s.is_active)}><Submit small variant="secondary">{s.is_active ? t.common.archive : t.common.restore}</Submit></form>
                <form action={A.deleteSubject.bind(null, slug, s.id)}><Submit small variant="ghost" confirm={t.common.delete + " ?"}>{t.common.delete}</Submit></form>
              </Td>
            </tr>
          ))}
        </Table>
        <form action={A.addSubject.bind(null, slug)} className="mt-4 grid grid-cols-[1fr_120px_auto] gap-2">
          <Input name="name" placeholder={t.common.name} required />
          <Input name="coefficient" type="number" step="0.5" min="0" placeholder={t.structure.coefficient} />
          <Submit>{t.common.add}</Submit>
        </form>
      </Card>
    </>
  );
}
