"use client";

import { formatMessage, getTranslation, type Locale } from "../../lib/i18n";
import { Button } from "../ui/button";
import type { MediaAsset } from "@irishpub-map/shared/media";
import { MediaGrid } from "./media-grid";
import styles from "./media.module.css";

/** Shared list, status and fixed page-based pagination for admin and picker.
 * @param {object} root0 - Component props。
 * @param {Locale} root0.locale - 表示言語。
 * @param {MediaAsset[]} root0.media - 現在表示中のMedia。
 * @param {number} root0.total - 全件数。
 * @param {number} root0.page - 現在のページ番号。
 * @param {number} root0.pageSize - 1ページの件数。
 * @param {boolean} root0.loading - 取得中かどうか。
 * @param {boolean} root0.error - 取得に失敗したかどうか。
 * @param {boolean} root0.databaseConfigured - DBが利用可能かどうか。
 * @param {boolean} root0.storageConfigured - Storageが利用可能かどうか。
 * @param {boolean} root0.configurationKnown - 設定状態をAPIで確認済みかどうか。
 * @param {boolean} [root0.selectable] - Pickerとして選択可能にするかどうか。
 * @param {string | null} [root0.selectedId] - 選択中のMedia ID。
 * @param {(asset: MediaAsset) => void} [root0.onSelect] - 選択時のcallback。
 * @param {(page: number) => void} root0.onPageChange - ページ変更callback。
 * @param {() => void} root0.onRetry - 再取得callback。
 * @returns {JSX.Element} Media一覧と状態表示。
 */
export function MediaLibrary({
  locale,
  media,
  total,
  page,
  pageSize,
  loading,
  error,
  databaseConfigured,
  storageConfigured,
  configurationKnown,
  selectable = false,
  selectedId,
  onSelect,
  onPageChange,
  onRetry,
}: {
  locale: Locale;
  media: MediaAsset[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: boolean;
  databaseConfigured: boolean;
  storageConfigured: boolean;
  configurationKnown: boolean;
  selectable?: boolean;
  selectedId?: string | null;
  onSelect?: (asset: MediaAsset) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}) {
  const t = getTranslation(locale).admin.media;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <section className={styles.section} aria-labelledby={`media-library-${selectable ? "picker" : "admin"}`}>
      <div className={styles.libraryHeading}>
        <h2 id={`media-library-${selectable ? "picker" : "admin"}`}>{t.mediaLibrary}</h2>
        {databaseConfigured ? <span>{total}</span> : null}
      </div>
      {configurationKnown && !databaseConfigured ? <p className={styles.warning}>{t.databaseUnavailable}</p> : null}
      {configurationKnown && databaseConfigured && !storageConfigured ? (
        <p className={styles.warning}>{t.storageUnavailable}</p>
      ) : null}
      {loading && media.length === 0 ? (
        <p className={styles.message} role="status" aria-live="polite">
          {t.loading}
        </p>
      ) : null}
      {error ? (
        <div className={styles.section}>
          <p className={styles.error} role="alert">
            {t.loadFailed}
          </p>
          {!configurationKnown || databaseConfigured ? (
            <Button variant="secondary" onClick={onRetry}>
              {t.retry}
            </Button>
          ) : null}
        </div>
      ) : null}
      {!error && configurationKnown && databaseConfigured && media.length === 0 && !loading ? (
        <p className={styles.empty}>{t.noMedia}</p>
      ) : null}
      {media.length > 0 ? (
        <div aria-busy={loading}>
          {loading ? (
            <p className={styles.srOnly} role="status" aria-live="polite">
              {t.loading}
            </p>
          ) : null}
          <MediaGrid
            locale={locale}
            media={media}
            selectable={selectable}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </div>
      ) : null}
      {configurationKnown && databaseConfigured ? (
        <nav className={styles.pager} aria-label={t.mediaLibrary}>
          <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}>
            {t.previousPage}
          </Button>
          <span aria-live="polite">{formatMessage(t.pageSummary, { from, to, total })}</span>
          <Button
            variant="secondary"
            disabled={page * pageSize >= total || loading}
            onClick={() => onPageChange(page + 1)}
          >
            {t.nextPage}
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
