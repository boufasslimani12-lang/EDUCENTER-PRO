import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getT } from "@/lib/i18n";
import { getUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type NavItem, type NotificationItem } from "./app-shell";

export type { NavItem };

/** Server wrapper: loads the per-user chrome data (notifications, sidebar state) and renders the client shell. */
export async function Shell({ brand, subtitle, homeHref, nav, children, role, banner, searchHref, settingsHref, billingHref, tenantId }: {
  brand: string; subtitle?: string; homeHref: string; nav: NavItem[]; children: ReactNode; role: string; banner?: ReactNode;
  searchHref?: string; settingsHref?: string; billingHref?: string; tenantId?: string;
}) {
  const { t, locale } = await getT();
  const user = await getUser();
  const supabase = await createClient();
  let q = supabase.from("notifications").select("id, title, body, link, created_at, read_at").eq("user_id", user?.id ?? "").order("created_at", { ascending: false }).limit(8);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q;
  // Only same-origin links are rendered as navigation targets.
  const notifications = ((data ?? []) as NotificationItem[]).map((n) => ({ ...n, link: n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : null }));
  const collapsed = (await cookies()).get("sidebar")?.value === "collapsed";

  return (
    <AppShell
      brand={brand}
      subtitle={subtitle}
      homeHref={homeHref}
      nav={nav}
      locale={locale}
      user={{ email: user?.email ?? "", role }}
      searchHref={searchHref}
      settingsHref={settingsHref}
      billingHref={billingHref}
      notifications={notifications}
      initialCollapsed={collapsed}
      banner={banner}
      labels={{
        appName: t.app.name, notifications: t.nav.notifications, noNotifications: t.nav.noNotifications, markAllRead: t.nav.markAllRead,
        collapse: t.nav.collapse, expand: t.nav.expand, openMenu: t.nav.openMenu, closeMenu: t.nav.closeMenu, profile: t.nav.profile,
        logout: t.common.logout, search: t.nav.searchStudents, settings: t.nav.settings, billing: t.nav.billing,
      }}
    >
      {children}
    </AppShell>
  );
}
