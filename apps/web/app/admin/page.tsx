import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPubManager } from "../components/admin-pub-manager";
import { getAdminSession, isAdminConfigured } from "../lib/admin-auth";
import { getPubs, isDatabaseConfigured } from "../lib/pub-repository";

/**
 * 管理設定とセッションを検証し、認証済み管理画面を表示します。
 * @returns {Promise<JSX.Element>} 管理画面、または設定不足時の案内画面。
 */
export default async function AdminPage() {
  if (!isAdminConfigured())
    return (
      <main className="admin-shell">
        <section className="admin-panel">
          <h1>管理画面の設定が必要です</h1>
          <p>管理者用の環境変数を設定してください。</p>
        </section>
      </main>
    );
  const session = getAdminSession((await cookies()).toString());
  if (!session) redirect("/admin/login");
  return <AdminPubManager initialPubs={await getPubs()} databaseConfigured={isDatabaseConfigured()} />;
}
