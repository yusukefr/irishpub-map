import { AdminStatusManager } from "../../../components/admin-status-manager";
import { requireAdminSession } from "../../../lib/admin-server";
import { getRequestLocale } from "../../../lib/i18n/server";
import { getAdminPubStatuses } from "../../../lib/status-repository";
import { isDataSourceConfigured } from "../../../lib/e2e-test-mode";

/**
 * 管理者セッションを検証してから、固定keyと日英表示名を含む営業ステータス管理機能を表示します。
 * @returns {Promise<JSX.Element>} 認証済み営業ステータス管理画面。
 */
export default async function AdminStatusesPage() {
  await requireAdminSession();
  const [locale, statuses] = await Promise.all([getRequestLocale(), getAdminPubStatuses()]);
  return (
    <AdminStatusManager initialStatuses={statuses} databaseConfigured={isDataSourceConfigured()} locale={locale} />
  );
}
