import { LanguageSwitcher } from "./language-switcher";
import type { Locale } from "../lib/i18n";

type AppHeaderProps = {
  locale: Locale;
};

/**
 * Map画面のコンパクトな共通ヘッダーを表示します。
 * @param {AppHeaderProps} props - 表示言語。
 * @returns {JSX.Element} サービス名と言語切り替えを含むヘッダー。
 */
export function AppHeader({ locale }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <h1 className="app-brand">Irish Pub Map</h1>
        <LanguageSwitcher locale={locale} />
      </div>
    </header>
  );
}
