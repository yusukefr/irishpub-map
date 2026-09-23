import { AdminMediaManager } from "../../../components/media/admin-media-manager";
import { requireAdminSession } from "../../../lib/admin-server";
import { getRequestLocale } from "../../../lib/i18n/server";

/** 認証済み管理者へMedia Assetの一覧とUpload UIを表示します。
 * @returns {Promise<JSX.Element>} 認証済み管理者向けMediaページ。
 */
export default async function AdminMediaPage() {
  await requireAdminSession();
  const locale = await getRequestLocale();
  return <AdminMediaManager locale={locale} />;
}
