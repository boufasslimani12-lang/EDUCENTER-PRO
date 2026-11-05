import Link from "next/link";
import { requireAdmin, type Props } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { PageHeader, Card, Flash, buttonClass } from "@/components/ui";
import { Submit } from "@/components/client";
import { Icon } from "@/components/icons";
import { TeacherFields } from "@/components/teacher-fields";
import { addTeacher } from "../actions";

export default async function NewTeacher({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  await requireAdmin(slug);
  const { t } = await getT();
  const back = `/t/${slug}/teachers`;
  return (
    <>
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <Icon name="chevronLeft" className="h-4 w-4 rtl:rotate-180" />{t.teachers.title}
      </Link>
      <PageHeader title={t.teachers.new} subtitle={t.common.requiredHint} />
      <Flash sp={sp} dismissLabel={t.common.dismiss} />
      <form action={addTeacher.bind(null, slug)}>
        <Card><TeacherFields t={t} /></Card>
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex justify-end gap-2 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Link href={back} className={buttonClass("secondary")}>{t.common.cancel}</Link>
          <Submit icon="check">{t.common.create}</Submit>
        </div>
      </form>
    </>
  );
}
