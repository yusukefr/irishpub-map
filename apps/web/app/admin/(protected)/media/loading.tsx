import { getTranslation } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import styles from "../../../components/media/media.module.css";

/** Media管理画面の初回遷移時に読み込み状態を通知します。
 * @returns {Promise<JSX.Element>} アクセシブルな読み込み状態。
 */
export default async function AdminMediaLoading() {
  const locale = await getRequestLocale();
  return (
    <p role="status" aria-live="polite" className={styles.message}>
      {getTranslation(locale).admin.media.loading}
    </p>
  );
}
