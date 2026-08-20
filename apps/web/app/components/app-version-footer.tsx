import appVersion from "../../../../app-version.json";
import type { Locale } from "../lib/i18n";

type AppVersionFooterProps = {
  locale: Locale;
};

/**
 * ビルドに含まれるバージョン番号とリリース日を表示します。
 * @param {AppVersionFooterProps} props - 表示言語。
 * @returns {JSX.Element} バージョン情報と公開方針への導線を含むフッター。
 */
export function AppVersionFooter({ locale }: AppVersionFooterProps) {
  const isJapanese = locale === "ja";

  return (
    <footer className="app-version" aria-label="アプリのバージョン情報">
      <span>v{appVersion.version}</span>
      <span>リリース日 {appVersion.releaseDate}（JST）</span>
      <a href="/privacy">
        {isJapanese ? "プライバシーポリシー・外部送信について" : "Privacy and external transmissions"}
      </a>
    </footer>
  );
}
