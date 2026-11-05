import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { Shell } from "@/components/shell";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  if (!(await isPlatformAdmin())) notFound();
  const { t } = await getT();
  return (
    <Shell brand={t.platform.title} homeHref="/platform" role={t.nav.platform} nav={[
      { href: "/platform", label: t.nav.dashboard, icon: "dashboard" },
      { href: "/platform/institutions", label: t.nav.institutions, icon: "building" },
      { href: "/platform/payments", label: t.nav.subscriptions, icon: "card" },
    ]}>
      {children}
    </Shell>
  );
}
