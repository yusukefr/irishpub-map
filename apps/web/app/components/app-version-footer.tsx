import appVersion from "../../../../app-version.json";
import { formatMessage, getTranslation, type Locale } from "../lib/i18n";

type AppVersionFooterProps = {
  locale: Locale;
  variant?: "default" | "compact";
};

/**
 * ビルドに含まれるバージョン番号とリリース日を表示します。
 * @param {AppVersionFooterProps} props - 表示言語と表示形式。
 * @returns {JSX.Element} バージョン情報と公開方針への導線を含むフッター。
 */
export function AppVersionFooter({ locale, variant = "default" }: AppVersionFooterProps) {
  const t = getTranslation(locale);

  return (
    <footer
      className={variant === "compact" ? "app-version app-version-compact" : "app-version"}
      aria-label={t.footer.ariaLabel}
    >
      <span>v{appVersion.version}</span>
      {variant === "default" ? (
        <span>{formatMessage(t.footer.releaseDate, { date: appVersion.releaseDate })}</span>
      ) : null}
      <a href="/privacy">{t.footer.privacyPolicy}</a>
    </footer>
  );
}
