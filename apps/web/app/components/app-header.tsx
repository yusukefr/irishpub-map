import { BrandLink, NavigationLink } from "./ui/header-primitives";
import { LanguageSwitcher } from "./language-switcher";
import { getTranslation, type Locale } from "../lib/i18n";
import styles from "./app-header.module.css";

/** Global Headerから提供する内部ナビゲーション項目です。 */
export type AppNavigationItem = {
  href: string;
  label: string;
  current?: boolean;
  desktopOnly?: boolean;
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
        <BrandLink className="app-brand" href="/">
          Irish Pub Map
        </BrandLink>
        {navigationItems.length ? (
          <nav className="app-navigation" aria-label={t.navigation.label}>
            {navigationItems.map((item) => (
              <NavigationLink
                key={item.href}
                href={item.href}
                current={item.current}
                className={item.desktopOnly ? styles.desktopOnly : undefined}
              >
                {item.label}
              </NavigationLink>
            ))}
          </nav>
        ) : null}
        <LanguageSwitcher locale={locale} />
      </div>
    </header>
  );
}
