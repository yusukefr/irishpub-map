import { AppVersionFooter } from "../components/app-version-footer";
import { getTranslation } from "../lib/i18n";
import { getPrivacyPolicy } from "../lib/i18n/privacy";
import { LanguageSwitcher } from "../components/language-switcher";
import { getRequestLocale } from "../lib/i18n/server";

/**
 * 公開画面で外部送信と情報の取扱いを説明するページです。
 * @returns {Promise<JSX.Element>} プライバシー・外部送信ページ。
 */
export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const t = getTranslation(locale);
  const policy = getPrivacyPolicy(locale);

  return (
    <main className="privacy-page-shell">
      <header className="privacy-masthead">
        <LanguageSwitcher locale={locale} />
        <div className="privacy-masthead-copy">
          <p className="eyebrow">{t.privacy.eyebrow}</p>
          <h1>{t.privacy.heading}</h1>
          <p className="lead">{t.privacy.lead}</p>
        </div>
      </header>

      <article className="privacy-content" aria-label={t.privacy.articleLabel} lang={locale}>
        <div className="privacy-sections">
          {policy.sections.map((section) => (
            <section className="privacy-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.links ? (
                <ul className="privacy-external-links">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href} rel="noreferrer" target="_blank">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        <div className="privacy-record">
          <p>{t.privacy.lastUpdated}</p>
          <p>{t.privacy.effectiveDate}</p>
          <p>{t.privacy.history}</p>
        </div>
        <a className="privacy-home-link" href="/">
          {t.privacy.homeLink}
          <span aria-hidden="true"> →</span>
        </a>
      </article>

      <AppVersionFooter locale={locale} />
    </main>
  );
}
