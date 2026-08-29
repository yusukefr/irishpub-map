import { getTranslation } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

/**
 * 管理店舗の検索・ページ移動中に表示するフォールバックです。
 * @returns {Promise<JSX.Element>} 選択言語に対応した管理店舗一覧の読み込み表示。
 */
export default async function AdminPubsLoading() {
  const t = getTranslation(await getRequestLocale());
  return <p role="status">{t.admin.loadingAdminPubs}</p>;
}
