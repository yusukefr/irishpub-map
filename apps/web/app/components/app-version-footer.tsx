import appVersion from "../../../../app-version.json";
import { formatMessage, getTranslation, type Locale } from "../lib/i18n";

type AppVersionFooterProps = {
  locale: Locale;
};

/**
 * ビルドに含まれるバージョン番号とリリース日を表示します。
 * @param {AppVersionFooterProps} props - 表示言語。
 * @returns {JSX.Element} バージョン情報と公開方針への導線を含むフッター。
 */
export function AppVersionFooter({ locale }: AppVersionFooterProps) {
  const t = getTranslation(locale);

  return (
    <footer className="app-version" aria-label={t.footer.ariaLabel}>
      <span>v{appVersion.version}</span>
      <span>{formatMessage(t.footer.releaseDate, { date: appVersion.releaseDate })}</span>
      <a href="/privacy">{t.footer.privacyPolicy}</a>
    </footer>
  );
}
