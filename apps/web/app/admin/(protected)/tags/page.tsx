import { getTranslation } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

/**
 * 後続のタグ管理機能を配置する認証済みページを表示します。
 * @returns {Promise<JSX.Element>} タグ管理の準備状態を示すページ。
 */
export default async function AdminTagsPage() {
  const t = getTranslation(await getRequestLocale()).admin;
  return (
    <section className="admin-panel admin-wide">
      <p className="eyebrow">Master data</p>
      <h1>{t.tagsHeading}</h1>
      <p>{t.referenceFoundationDescription}</p>
    </section>
  );
}
