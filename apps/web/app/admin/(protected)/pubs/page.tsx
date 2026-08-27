import { getRequestLocale } from "../../../lib/i18n/server";
import { AdminPubManager } from "../../../components/admin-pub-manager";
import { getAdminPubs, isDatabaseConfigured } from "../../../lib/pub-repository";

/**
 * 管理レイアウトで認証済みの利用者へ既存の店舗管理機能を表示します。
 * @returns {Promise<JSX.Element>} 店舗管理画面。
 */
export default async function AdminPage() {
  const locale = await getRequestLocale();
  return (
    <AdminPubManager initialPubs={await getAdminPubs()} databaseConfigured={isDatabaseConfigured()} locale={locale} />
  );
}
