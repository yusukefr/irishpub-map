"use client";

import { LOCALE_COOKIE, LOCALES, type Locale, getTranslation } from "../lib/i18n";

type LanguageSwitcherProps = { locale: Locale };

/**
 * 選択言語をCookieへ保存し、サーバー描画の文言・メタデータを即時更新します。
 * @param {{ locale: Locale }} root0 - 現在選択中のロケール。
 * @param {Locale} root0.locale - 現在選択中のロケール。
 * @returns {JSX.Element} 表示言語を切り替えるセレクトボックス。
 */
export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const t = getTranslation(locale).language;

  return (
    <label className="language-switcher">
      <span>{t.label}</span>
      <select
        aria-label={t.label}
        value={locale}
        onChange={(event) => {
          const nextLocale = event.target.value as Locale;

          if (!LOCALES.includes(nextLocale) || nextLocale === locale) {
            return;
          }

          // UI設定のため、クライアントから読めるCookieとして1年間保存します。
          document.cookie = `${LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
          window.location.reload();
        }}
      >
        <option value="ja">{t.ja}</option>
        <option value="en">{t.en}</option>
      </select>
    </label>
  );
}
