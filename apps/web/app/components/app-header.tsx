import Link from "next/link";
import { LanguageSwitcher } from "./language-switcher";
import { getTranslation, type Locale } from "../lib/i18n";

/** Global Headerから提供する内部ナビゲーション項目です。 */
export type AppNavigationItem = {
  href: string;
  label: string;
  current?: boolean;
};

type AppHeaderProps = {
  locale: Locale;
  navigationItems?: readonly AppNavigationItem[];
};

/**
 * 公開画面で共有するブランド、将来のナビゲーション、言語切り替えを表示します。
 * @param {AppHeaderProps} props - 表示言語と任意のナビゲーション項目。
 * @returns {JSX.Element} サービス名と言語切り替えを含むヘッダー。
 */
export function AppHeader({ locale, navigationItems = [] }: AppHeaderProps) {
  const t = getTranslation(locale);

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link className="app-brand" href="/">
          Irish Pub Map
        </Link>
        {navigationItems.length ? (
          <nav className="app-navigation" aria-label={t.navigation.label}>
            {navigationItems.map((item) => (
              <Link key={item.href} href={item.href} aria-current={item.current ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <LanguageSwitcher locale={locale} />
      </div>
    </header>
  );
}
