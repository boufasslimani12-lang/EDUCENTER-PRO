import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getUser, isPlatformAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { Shell } from "@/components/shell";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  if (!(await isPlatformAdmin())) notFound();
  const user = await getUser();
  const { t } = await getT();
  return (
    <Shell brand={t.platform.title} nav={[
      { href: "/platform", label: t.nav.dashboard },
      { href: "/platform/institutions", label: t.nav.institutions },
      { href: "/platform/payments", label: t.nav.subscriptions },
    ]} userEmail={user?.email ?? ""}>
      {children}
    </Shell>
  );
}
