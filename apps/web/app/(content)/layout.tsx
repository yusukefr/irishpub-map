import type { ReactNode } from "react";
import { AppHeader } from "../components/app-header";
import { AppVersionFooter } from "../components/app-version-footer";
import { getRequestLocale } from "../lib/i18n/server";

/**
 * StoryやGuideで共有する通常のDocument Flow用Shellを提供します。
 * @param {{ children: ReactNode }} props - Contentページの内容。
 * @returns {Promise<JSX.Element>} Header、Content本文、通常Footerを含むShell。
 */
export default async function ContentLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await getRequestLocale();

  return (
    <div className="content-app-shell">
      <AppHeader locale={locale} />
      <main className="content-main">{children}</main>
      <AppVersionFooter locale={locale} />
    </div>
  );
}
