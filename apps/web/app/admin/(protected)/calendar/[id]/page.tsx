import { notFound } from "next/navigation";
import { AdminCalendarEditor } from "../../../../components/admin-calendar-editor";
import { AdminCalendarServiceError, readAdminCalendarEvent } from "../../../../lib/admin-calendar-service";
import { requireAdminSession } from "../../../../lib/admin-server";
import { isE2ETestMode } from "../../../../lib/e2e-test-mode";
import { isCalendarDatabaseConfigured } from "../../../../lib/calendar/repository";
import { isCalendarEventId } from "../../../../lib/calendar/validation";
import { getRequestLocale } from "../../../../lib/i18n/server";

/**
 * 指定Calendar Eventの管理フォームを表示します。
 * @param {{ params: Promise<{ id: string }> }} props - 動的ルートパラメーター。
 * @returns {Promise<JSX.Element>} Calendar編集UI。
 */
export default async function EditAdminCalendarPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
  if (!isCalendarEventId(id)) notFound();
  const [event, locale] = await Promise.all([getCalendarOrNotFound(id), getRequestLocale()]);
  return (
    <AdminCalendarEditor
      initialEvent={event}
      databaseConfigured={isCalendarDatabaseConfigured() || isE2ETestMode()}
      locale={locale}
    />
  );
}

async function getCalendarOrNotFound(id: string) {
  try {
    return await readAdminCalendarEvent(id);
  } catch (error) {
    if (error instanceof AdminCalendarServiceError && error.code === "not_found") notFound();
    throw error;
  }
}
