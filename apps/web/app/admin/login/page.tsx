import { LoginForm } from "../../components/admin-login-form";

/**
 * 管理者ログインフォームを表示します。
 * @returns {JSX.Element} 管理者ログイン画面。
 */
export default function AdminLoginPage() {
  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <p className="eyebrow">Irish Pub Map</p>
        <h1>管理者ログイン</h1>
        <LoginForm />
      </section>
    </main>
  );
}
