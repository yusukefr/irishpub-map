"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { LANGUAGE_OPTIONS, LOCALE_COOKIE, type Locale, getTranslation } from "../lib/i18n";

type LanguageSwitcherProps = { locale: Locale };

function persistLocale(nextLocale: Locale) {
  // UI設定のため、クライアントから読めるCookieとして1年間保存します。
  document.cookie = `${LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.location.reload();
}

/**
 * 選択言語をCookieへ保存し、サーバー描画の文言・メタデータを即時更新します。
 * @param {{ locale: Locale }} root0 - 現在選択中のロケール。
 * @param {Locale} root0.locale - 現在選択中のロケール。
 * @returns {JSX.Element} 現在言語と切り替え候補を示すヘッダーメニュー。
 */
export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const t = getTranslation(locale).language;
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef(new Map<Locale, HTMLButtonElement>());
  const focusLocaleOnOpenRef = useRef<Locale>(locale);
  const languageOptions = LANGUAGE_OPTIONS.map((option) => ({ ...option, label: t[option.locale] }));
  const currentLanguage = languageOptions.find((option) => option.locale === locale) ?? languageOptions[0];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    optionRefs.current.get(focusLocaleOnOpenRef.current)?.focus();

    const handleMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, locale]);

  const openMenu = (focusLocale: Locale = locale) => {
    focusLocaleOnOpenRef.current = focusLocale;
    setIsOpen(true);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(languageOptions[0].locale);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(languageOptions.at(-1)?.locale ?? locale);
    }
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, optionIndex: number) => {
    let nextIndex: number | undefined;

    if (event.key === "ArrowDown") {
      nextIndex = (optionIndex + 1) % languageOptions.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (optionIndex - 1 + languageOptions.length) % languageOptions.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = languageOptions.length - 1;
    }

    if (nextIndex !== undefined) {
      event.preventDefault();
      optionRefs.current.get(languageOptions[nextIndex].locale)?.focus();
    }
  };

  const selectLocale = (nextLocale: Locale) => {
    setIsOpen(false);

    if (nextLocale === locale) {
      triggerRef.current?.focus();
      return;
    }

    persistLocale(nextLocale);
  };

  return (
    <div className="language-switcher" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="language-switcher-trigger"
        aria-label={`${t.label}: ${currentLanguage.label}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="language-switcher-flag" aria-hidden="true">
          {currentLanguage.flag}
        </span>
        <span>LANGUAGE</span>
        <span className="language-switcher-chevron" aria-hidden="true">
          {isOpen ? "▴" : "▾"}
        </span>
      </button>
      {isOpen ? (
        <div id={menuId} className="language-switcher-menu" role="menu" aria-label={t.label}>
          {languageOptions.map((option, index) => {
            const isCurrent = option.locale === locale;

            return (
              <button
                key={option.locale}
                ref={(node) => {
                  if (node) {
                    optionRefs.current.set(option.locale, node);
                  } else {
                    optionRefs.current.delete(option.locale);
                  }
                }}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                aria-current={isCurrent ? "true" : undefined}
                tabIndex={isCurrent ? 0 : -1}
                onClick={() => selectLocale(option.locale)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                <span className="language-switcher-flag" aria-hidden="true">
                  {option.flag}
                </span>
                <span>{option.label}</span>
                <span className="language-switcher-check" aria-hidden="true">
                  {isCurrent ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
