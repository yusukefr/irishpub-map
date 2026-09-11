import { AdminContentEditor } from "../../../../components/admin-content-editor";
import { requireAdminSession } from "../../../../lib/admin-server";
import { isContentDatabaseConfigured } from "../../../../lib/admin-content-repository";
import { isE2ETestMode } from "../../../../lib/e2e-test-mode";
import { getRequestLocale } from "../../../../lib/i18n/server";

/**
 * Editorial ContentをDraft作成する管理フォームを表示します。
 * @returns {Promise<JSX.Element>} Content新規作成画面。
 */
export default async function NewAdminContentPage() {
  await requireAdminSession();
  const locale = await getRequestLocale();
  return (
    <AdminContentEditor
      initialContent={null}
      databaseConfigured={isContentDatabaseConfigured() || isE2ETestMode()}
      locale={locale}
    />
  );
}
