import type { ReactNode } from "react";
import { AppHeader } from "../components/app-header";
import { AppVersionFooter } from "../components/app-version-footer";
import { getRequestLocale } from "../lib/i18n/server";

/**
 * Mapページ専用のViewport Shellを提供します。
 * @param {{ children: ReactNode }} props - Mapページの内容。
 * @returns {Promise<JSX.Element>} Header、Map本文、compact Footerを含むShell。
 */
export default async function MapLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await getRequestLocale();

  return (
    <div className="map-app-shell">
      <AppHeader locale={locale} />
      <main className="map-app-main">{children}</main>
      <AppVersionFooter locale={locale} variant="compact" />
    </div>
  );
}
