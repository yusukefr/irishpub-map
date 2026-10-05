import { getTranslation, type Locale } from "../lib/i18n";
import { getReleaseInfo } from "../lib/release-info";

/**
 * 認証済み管理画面だけにRelease対象のGit SHAを表示します。
 * @param {{ locale: Locale }} root0 - 表示言語。
 * @param {Locale} root0.locale - 管理画面の表示言語。
 * @returns {JSX.Element} Release情報の詳細表示。
 */
export function AdminReleaseInfo({ locale }: { locale: Locale }) {
  const t = getTranslation(locale).admin;
  const release = getReleaseInfo();

  return (
    <aside className="admin-release-info" aria-label={t.releaseInfoHeading}>
      <h2>{t.releaseInfoHeading}</h2>
      <dl>
        <dt>{t.releaseVersion}</dt>
        <dd>{release.version === "dev" || release.version === "preview" ? t.releaseUnavailable : release.version}</dd>
        <dt>{t.releaseDate}</dt>
        <dd>{release.releasedAt ?? t.releaseUnavailable}</dd>
        <dt>{t.releaseCommit}</dt>
        <dd>
          {release.gitSha ? <code title={release.gitSha}>{release.gitSha.slice(0, 12)}</code> : t.releaseUnavailable}
        </dd>
      </dl>
    </aside>
  );
}
