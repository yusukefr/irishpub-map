import { getRequestLocale } from "../../../lib/i18n/server";
import { AdminPubManager } from "../../../components/admin-pub-manager";
import { requireAdminSession } from "../../../lib/admin-server";
import { getAdminPubs, isDatabaseConfigured } from "../../../lib/pub-repository";

/**
 * 管理者セッションを検証してから、既存の店舗管理機能を表示します。
 * @returns {Promise<JSX.Element>} 店舗管理画面。
 */
export default async function AdminPage() {
  await requireAdminSession();
  const locale = await getRequestLocale();
  return (
    <AdminPubManager initialPubs={await getAdminPubs()} databaseConfigured={isDatabaseConfigured()} locale={locale} />
  );
}
