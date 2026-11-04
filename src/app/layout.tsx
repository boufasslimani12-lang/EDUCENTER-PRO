import type { Metadata, Viewport } from "next";
import { getT } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "EDUCENTER PRO", template: "%s · EDUCENTER PRO" },
  description: "Plateforme de gestion pour établissements d'enseignement",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getT();
  return (
    <html lang={locale} dir={dir}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
