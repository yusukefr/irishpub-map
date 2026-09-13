import { AdminQuizEditor } from "../../../../components/admin-quiz-editor";
import { readAdminContentList } from "../../../../lib/admin-content-service";
import { requireAdminSession } from "../../../../lib/admin-server";
import { isE2ETestMode } from "../../../../lib/e2e-test-mode";
import { isQuizDatabaseConfigured } from "../../../../lib/quiz/repository";
import { getRequestLocale } from "../../../../lib/i18n/server";
/**
 * QuizをDraft作成する管理フォームを表示します。
 * @returns {JSX.Element} Quiz作成フォーム。
 */
export default async function NewAdminQuizPage() {
  await requireAdminSession();
  const [locale, content] = await Promise.all([getRequestLocale(), readAdminContentList()]);
  return (
    <AdminQuizEditor
      initialQuestion={null}
      relatedGuides={content.filter((item) => item.kind === "guide")}
      databaseConfigured={isQuizDatabaseConfigured() || isE2ETestMode()}
      locale={locale}
    />
  );
}
