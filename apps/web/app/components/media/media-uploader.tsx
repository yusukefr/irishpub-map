"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { MediaAsset } from "@irishpub-map/shared/media";
import { MEDIA_MAX_FILE_SIZE_BYTES } from "@irishpub-map/shared/media";
import { getAdminMediaApiErrorMessage } from "../../lib/admin-api-client";
import { formatMediaFileSize, isMediaAsset } from "../../lib/media/presentation";
import { getTranslation, type Locale } from "../../lib/i18n";
import { Button } from "../ui/button";
import styles from "./media.module.css";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Single-file client-side checks and upload shared by media manager and picker.
 * @param {object} root0 - Component props。
 * @param {Locale} root0.locale - 表示言語。
 * @param {boolean} root0.databaseConfigured - DBが利用可能かどうか。
 * @param {boolean} root0.storageConfigured - Storageが利用可能かどうか。
 * @param {(asset: MediaAsset) => void | Promise<void>} root0.onUploaded - Upload成功後のcallback。
 * @param {() => void} [root0.onSuccess] - 成功通知callback。
 * @returns {JSX.Element} ファイル選択とUpload UI。
 */
export function MediaUploader({
  locale,
  databaseConfigured,
  storageConfigured,
  onUploaded,
  onSuccess,
}: {
  locale: Locale;
  databaseConfigured: boolean;
  storageConfigured: boolean;
  onUploaded: (asset: MediaAsset) => void | Promise<void>;
  onSuccess?: () => void;
}) {
  const t = getTranslation(locale).admin.media;
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const objectUrl = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  function selectFile(nextFile: File | null) {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setPreviewUrl(null);
    setFile(nextFile);
    setError(null);
    setClientError(null);
    if (!nextFile) return;
    if (ALLOWED_MIME_TYPES.includes(nextFile.type)) {
      objectUrl.current = URL.createObjectURL(nextFile);
      setPreviewUrl(objectUrl.current);
    }
    if (nextFile.size > MEDIA_MAX_FILE_SIZE_BYTES) setClientError(t.errors.fileTooLarge);
    else if (nextFile.type && !ALLOWED_MIME_TYPES.includes(nextFile.type)) setClientError(t.errors.unsupportedFormat);
  }

  async function upload() {
    if (!file || uploading || clientError || !databaseConfigured || !storageConfigured) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/media", { method: "POST", body: formData });
      let value: unknown;
      try {
        value = await response.json();
      } catch {
        value = null;
      }
      if (!response.ok) {
        setError(getAdminMediaApiErrorMessage(locale, value));
        return;
      }
      const media = value && typeof value === "object" ? (value as { media?: unknown }).media : null;
      if (!isMediaAsset(media)) {
        setError(t.errors.uploadFailed);
        return;
      }
      selectFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onSuccess?.();
      await onUploaded(media);
    } catch {
      setError(t.errors.network);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="media-upload-heading">
      <h2 id="media-upload-heading">{t.upload}</h2>
      <div className={styles.uploader}>
        <label className={styles.fileLabel}>
          {t.chooseFile}
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => selectFile(event.currentTarget.files?.[0] ?? null)}
            disabled={uploading}
          />
        </label>
        {file ? (
          <div className={styles.preview}>
            {previewUrl ? (
              <div className={styles.previewImage}>
                <Image src={previewUrl} alt="" fill unoptimized />
              </div>
            ) : null}
            <dl className={styles.previewDetails}>
              <dt>{t.selectedFile}</dt>
              <dd>
                <strong>{file.name}</strong>
              </dd>
              <dt>{t.fileType}</dt>
              <dd>{file.type || "—"}</dd>
              <dt>{t.fileSize}</dt>
              <dd>{formatMediaFileSize(file.size, locale)}</dd>
            </dl>
          </div>
        ) : null}
        {clientError ? (
          <p className={styles.error} role="alert">
            {clientError}
          </p>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.uploaderActions}>
          <Button
            disabled={!file || Boolean(clientError) || !databaseConfigured || !storageConfigured}
            loading={uploading}
            loadingLabel={t.uploading}
            onClick={upload}
          >
            {uploading ? t.uploading : t.uploadImage}
          </Button>
        </div>
      </div>
    </section>
  );
}
