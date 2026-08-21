import { getTranslation } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";
import { LoginForm } from "../../components/admin-login-form";

/**
 * 管理者ログインフォームを表示します。
 * @returns {JSX.Element} 管理者ログイン画面。
 */
export default async function AdminLoginPage() {
  const locale = await getRequestLocale();
  const t = getTranslation(locale);
  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <p className="eyebrow">Irish Pub Map</p>
        <h1>{t.admin.loginHeading}</h1>
        <LoginForm locale={locale} />
      </section>
    </main>
  );
}
