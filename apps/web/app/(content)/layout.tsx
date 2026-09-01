import type { ReactNode } from "react";
import { AppHeader } from "../components/app-header";
import { AppVersionFooter } from "../components/app-version-footer";
import { getTranslation } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n/server";

/**
 * StoryやGuideで共有する通常のDocument Flow用Shellを提供します。
 * @param {{ children: ReactNode }} props - Contentページの内容。
 * @returns {Promise<JSX.Element>} Header、Content本文、通常Footerを含むShell。
 */
export default async function ContentLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await getRequestLocale();
  const t = getTranslation(locale);

  return (
    <div className="content-app-shell">
      <AppHeader locale={locale} navigationItems={[{ href: "/discover", label: t.discover.navigation }]} />
      <main className="content-main">{children}</main>
      <AppVersionFooter locale={locale} />
    </div>
  );
}
