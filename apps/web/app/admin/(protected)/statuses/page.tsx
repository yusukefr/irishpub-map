import { getTranslation } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

/**
 * 後続の営業ステータス管理機能を配置する認証済みページを表示します。
 * @returns {Promise<JSX.Element>} 営業ステータス管理の準備状態を示すページ。
 */
export default async function AdminStatusesPage() {
  const t = getTranslation(await getRequestLocale()).admin;
  return (
    <section className="admin-panel admin-wide">
      <p className="eyebrow">Master data</p>
      <h1>{t.statusesHeading}</h1>
      <p>{t.referenceFoundationDescription}</p>
    </section>
  );
}
