import { getRequestLocale } from "../../../../lib/i18n/server";
import { requireAdminSession } from "../../../../lib/admin-server";
import { getPrefectures, getPubStatuses, getPubTypes, getTags } from "../../../../lib/master-repository";
import { isDatabaseConfigured } from "../../../../lib/pub-repository";
import { AdminPubEditor } from "../../../../components/admin-pub-editor";

/**
 * 管理者向けの店舗新規登録フォームを表示します。初期状態は非公開の下書きです。
 * @returns {Promise<JSX.Element>} 店舗登録画面。
 */
export default async function NewAdminPubPage() {
  await requireAdminSession();
  const locale = await getRequestLocale();
  const [prefectures, statuses, pubTypes, tags] = await Promise.all([
    getPrefectures(locale),
    getPubStatuses(locale),
    getPubTypes(locale),
    getTags(locale),
  ]);
  return (
    <AdminPubEditor
      initialPub={null}
      prefectures={prefectures}
      municipalities={[]}
      statuses={statuses}
      pubTypes={pubTypes}
      tags={tags}
      databaseConfigured={isDatabaseConfigured()}
      locale={locale}
    />
  );
}
