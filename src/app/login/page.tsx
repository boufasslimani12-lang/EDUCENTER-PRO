import { Suspense } from "react";
import { getT } from "@/lib/i18n";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";

export default async function Page() {
  const { t } = await getT();
  const l = { ...t.auth, email: t.common.email, submit: t.auth.login };
  return (
    <AuthShell title={t.auth.login}>
      <Suspense>
        <AuthForm mode="login" l={l} />
      </Suspense>
    </AuthShell>
  );
}
