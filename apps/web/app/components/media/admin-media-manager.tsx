"use client";

import { useState } from "react";
import { getTranslation, type Locale } from "../../lib/i18n";
import { useMediaLibrary } from "../../lib/media/use-media-library";
import { MediaLibrary } from "./media-library";
import { MediaUploader } from "./media-uploader";
import styles from "./media.module.css";

/** /admin/mediaの見出し、Upload、共有Libraryを組み立てます。
 * @param {object} root0 - Component props。
 * @param {Locale} root0.locale - 表示言語。
 * @returns {JSX.Element} 管理用Media画面。
 */
export function AdminMediaManager({ locale }: { locale: Locale }) {
  const t = getTranslation(locale).admin.media;
  const library = useMediaLibrary();
  const [uploaded, setUploaded] = useState(false);

  async function handleUpload() {
    setUploaded(true);
    await library.refreshFirstPage();
  }

  return (
    <section className={`admin-panel admin-wide ${styles.manager}`}>
      <header className={styles.heading}>
        <h1>{t.heading}</h1>
        <p>{t.description}</p>
      </header>
      {uploaded ? (
        <p className={styles.message} role="status" aria-live="polite">
          {t.uploadSuccess}
        </p>
      ) : null}
      <MediaUploader
        locale={locale}
        databaseConfigured={library.databaseConfigured}
        storageConfigured={library.storageConfigured}
        onUploaded={handleUpload}
        onSuccess={() => setUploaded(true)}
      />
      <MediaLibrary
        locale={locale}
        media={library.media}
        total={library.total}
        page={library.page}
        pageSize={library.pageSize}
        loading={library.loading}
        error={library.error}
        databaseConfigured={library.databaseConfigured}
        storageConfigured={library.storageConfigured}
        configurationKnown={library.configurationKnown}
        onPageChange={library.goToPage}
        onRetry={library.retry}
      />
    </section>
  );
}
