import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberships, getUser, isPlatformAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n";
import { AuthShell } from "@/components/auth-shell";
import { signOut } from "./actions/auth";

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  await supabase.rpc("claim_invitations");

  const [admin, memberships] = await Promise.all([isPlatformAdmin(), getMemberships()]);
  if (memberships.length === 1 && !admin) redirect(`/t/${memberships[0].tenants.slug}`);
  if (memberships.length === 0 && admin) redirect("/platform");

  const { t } = await getT();
  return (
    <AuthShell title={t.auth.chooseWorkspace}>
      {memberships.length === 0 && !admin && <p className="text-sm text-slate-600">{t.auth.noWorkspace}</p>}
      <ul className="space-y-2">
        {admin && (
          <li>
            <Link className="block rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50" href="/platform">
              {t.nav.platform}
            </Link>
          </li>
        )}
        {memberships.map((m) => (
          <li key={m.tenant_id}>
            <Link className="block rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50" href={`/t/${m.tenants.slug}`}>
              <span className="font-medium">{m.tenants.name}</span>{" "}
              <span className="text-xs text-slate-500">({m.role})</span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={signOut} className="mt-6">
        <button className="text-sm text-slate-500 hover:underline">{t.common.logout}</button>
      </form>
    </AuthShell>
  );
}
