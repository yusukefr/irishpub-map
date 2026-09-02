import { AdminTagManager } from "../../../components/admin-tag-manager";
import { requireAdminSession } from "../../../lib/admin-server";
import { getRequestLocale } from "../../../lib/i18n/server";
import { getAdminTags } from "../../../lib/tag-repository";
import { isDataSourceConfigured } from "../../../lib/e2e-test-mode";

/**
 * 管理者セッションを検証してから、日英翻訳と使用店舗数を含むタグ管理機能を表示します。
 * @returns {Promise<JSX.Element>} 認証済みタグ管理画面。
 */
export default async function AdminTagsPage() {
  await requireAdminSession();
  const [locale, tags] = await Promise.all([getRequestLocale(), getAdminTags()]);
  return <AdminTagManager initialTags={tags} databaseConfigured={isDataSourceConfigured()} locale={locale} />;
}
