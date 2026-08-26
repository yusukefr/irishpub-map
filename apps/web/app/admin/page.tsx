import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslation } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n/server";
import { AdminPubManager } from "../components/admin-pub-manager";
import { getAdminSession, isAdminConfigured } from "../lib/admin-auth";
import { getAdminPubs, isDatabaseConfigured } from "../lib/pub-repository";

/**
 * 管理設定とセッションを検証し、認証済み管理画面を表示します。
 * @returns {Promise<JSX.Element>} 管理画面、または設定不足時の案内画面。
 */
export default async function AdminPage() {
  const locale = await getRequestLocale();
  const t = getTranslation(locale);
  if (!isAdminConfigured())
    return (
      <main className="admin-shell">
        <section className="admin-panel">
          <h1>{t.admin.configurationRequired}</h1>
          <p>{t.admin.configurationDescription}</p>
        </section>
      </main>
    );
  const session = getAdminSession((await cookies()).toString());
  if (!session) redirect("/admin/login");
  return (
    <AdminPubManager initialPubs={await getAdminPubs()} databaseConfigured={isDatabaseConfigured()} locale={locale} />
  );
}
