import { Suspense } from "react";
import { getT } from "@/lib/i18n";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";

export default async function Page() {
  const { t } = await getT();
  const l = { ...t.auth, email: t.common.email, submit: t.auth.sendReset };
  return (
    <AuthShell title={t.auth.forgot}>
      <Suspense>
        <AuthForm mode="forgot" l={l} />
      </Suspense>
    </AuthShell>
  );
}
