import { AdminCalendarEditor } from "../../../../components/admin-calendar-editor";
import { isE2ETestMode } from "../../../../lib/e2e-test-mode";
import { requireAdminSession } from "../../../../lib/admin-server";
import { isCalendarDatabaseConfigured } from "../../../../lib/calendar/repository";
import { getRequestLocale } from "../../../../lib/i18n/server";

/**
 * Calendar EventをDraft作成する管理フォームを表示します。
 * @returns {Promise<JSX.Element>} Calendar新規作成UI。
 */
export default async function NewAdminCalendarPage() {
  await requireAdminSession();
  const locale = await getRequestLocale();
  return (
    <AdminCalendarEditor
      initialEvent={null}
      databaseConfigured={isCalendarDatabaseConfigured() || isE2ETestMode()}
      locale={locale}
    />
  );
}
