import { isAdminContentId } from "@irishpub-map/shared/admin-content";
import { notFound } from "next/navigation";
import { AdminContentEditor } from "../../../../components/admin-content-editor";
import { isContentDatabaseConfigured } from "../../../../lib/admin-content-repository";
import { AdminContentServiceError, readAdminContent } from "../../../../lib/admin-content-service";
import { requireAdminSession } from "../../../../lib/admin-server";
import { isE2ETestMode } from "../../../../lib/e2e-test-mode";
import { getRequestLocale } from "../../../../lib/i18n/server";

/**
 * 指定Editorial Contentの管理フォームを表示します。
 * @param {{ params: Promise<{ id: string }> }} props - URLに含まれるContent ID。
 * @returns {Promise<JSX.Element>} Content編集画面。
 */
export default async function EditAdminContentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
  if (!isAdminContentId(id)) notFound();
  const [content, locale] = await Promise.all([getContentOrNotFound(id), getRequestLocale()]);
  return (
    <AdminContentEditor
      initialContent={content}
      databaseConfigured={isContentDatabaseConfigured() || isE2ETestMode()}
      locale={locale}
    />
  );
}

async function getContentOrNotFound(id: string) {
  try {
    return await readAdminContent(id);
  } catch (error) {
    if (error instanceof AdminContentServiceError && error.code === "not_found") notFound();
    throw error;
  }
}
