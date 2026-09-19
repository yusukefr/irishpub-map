import { notFound } from "next/navigation";
import { AdminQuizEditor } from "../../../../components/admin-quiz-editor";
import { readAdminContentList } from "../../../../lib/admin-content-service";
import { AdminQuizServiceError, readAdminQuiz } from "../../../../lib/admin-quiz-service";
import { isE2ETestMode } from "../../../../lib/e2e-test-mode";
import { isQuizDatabaseConfigured } from "../../../../lib/quiz/repository";
import { isQuizQuestionId } from "../../../../lib/quiz/types";
import { requireAdminSession } from "../../../../lib/admin-server";
import { getRequestLocale } from "../../../../lib/i18n/server";
/**
 * 指定Questionの管理フォームを表示します。
 * @param root0 - Page props。
 * @param root0.params - URLパラメータ。
 * @returns {JSX.Element} Quiz編集フォーム。
 */
export default async function EditAdminQuizPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
  if (!isQuizQuestionId(id)) notFound();
  const [question, locale, content] = await Promise.all([
    getQuizOrNotFound(id),
    getRequestLocale(),
    readAdminContentList(),
  ]);
  return (
    <AdminQuizEditor
      initialQuestion={question}
      relatedGuides={content.filter((item) => item.kind === "guide")}
      databaseConfigured={isQuizDatabaseConfigured() || isE2ETestMode()}
      locale={locale}
    />
  );
}
async function getQuizOrNotFound(id: string) {
  try {
    return await readAdminQuiz(id);
  } catch (error) {
    if (error instanceof AdminQuizServiceError && error.code === "not_found") notFound();
    throw error;
  }
}
