import { getTranslation } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

/**
 * タグ一覧のServer Component取得中に支援技術へ読み込み状態を通知します。
 * @returns {Promise<JSX.Element>} タグ管理ページの読み込み表示。
 */
export default async function AdminTagsLoading() {
  const t = getTranslation(await getRequestLocale()).admin;
  return (
    <section className="admin-panel admin-wide" role="status" aria-live="polite">
      <p>{t.tagLoading}</p>
    </section>
  );
}
