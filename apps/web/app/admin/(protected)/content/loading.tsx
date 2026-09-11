import { getTranslation } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

/**
 * Content管理一覧の読み込み中表示です。
 * @returns {Promise<JSX.Element>} 状態通知を含むLoading UI。
 */
export default async function AdminContentLoading() {
  const locale = await getRequestLocale();
  return (
    <p role="status" className="admin-panel">
      {getTranslation(locale).admin.content.loading}
    </p>
  );
}
