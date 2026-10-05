import Link from "next/link";
import { formatMessage, getTranslation, type Locale } from "../lib/i18n";
import { getReleaseInfo } from "../lib/release-info";

type AppVersionFooterProps = {
  locale: Locale;
  variant?: "default" | "compact";
};

/**
 * Release metadataのVersionとJST日時を表示します。SHAは公開しません。
 * @param {AppVersionFooterProps} props - 表示言語と表示形式。
 * @returns {JSX.Element} バージョン情報と公開方針への導線を含むフッター。
 */
export function AppVersionFooter({ locale, variant = "default" }: AppVersionFooterProps) {
  const t = getTranslation(locale);
  const release = getReleaseInfo();
  const version =
    release.version === "dev"
      ? t.footer.development
      : release.version === "preview"
        ? t.footer.preview
        : release.version;

  return (
    <footer
      className={variant === "compact" ? "app-version app-version-compact" : "app-version"}
      aria-label={t.footer.ariaLabel}
    >
      <span className="app-version-number">{version}</span>
      {release.releasedAt ? (
        <span className="app-version-release-date">
          {formatMessage(variant === "compact" ? t.footer.releaseDateCompact : t.footer.releaseDate, {
            date: release.releasedAt,
          })}
        </span>
      ) : null}
      <Link href="/privacy">{t.footer.privacyPolicy}</Link>
    </footer>
  );
}
