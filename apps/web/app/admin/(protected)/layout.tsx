import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminNavigation } from "../../components/admin-navigation";
import { getAdminSession, isAdminConfigured } from "../../lib/admin-auth";
import { getTranslation } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

/**
 * 管理者セッションをサーバー側で検証し、管理機能共通の画面構造を提供します。
 * @param {{ children: React.ReactNode }} root0 - 保護対象の管理ページ。
 * @param {React.ReactNode} root0.children - 認証後に表示するページ本文。
 * @returns {Promise<JSX.Element>} 認証済み管理レイアウト、または設定不足の案内。
 */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  const t = getTranslation(locale).admin;
  if (!isAdminConfigured()) {
    return (
      <main className="admin-shell">
        <section className="admin-panel">
          <h1>{t.configurationRequired}</h1>
          <p>{t.configurationDescription}</p>
        </section>
      </main>
    );
  }

  if (!getAdminSession((await cookies()).toString())) redirect("/admin/login");

  return (
    <div className="admin-layout">
      <header className="admin-sidebar">
        <div>
          <p className="eyebrow">Irish Pub Map</p>
          <p className="admin-brand">Admin</p>
        </div>
        <AdminNavigation locale={locale} />
      </header>
      <main className="admin-content">{children}</main>
    </div>
  );
}
