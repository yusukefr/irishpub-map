"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaAsset } from "@irishpub-map/shared/media";
import { getTranslation, type Locale } from "../../lib/i18n";
import { isMediaAsset } from "../../lib/media/presentation";
import { useMediaLibrary } from "../../lib/media/use-media-library";
import { Button } from "../ui/button";
import { MediaLibrary } from "./media-library";
import { MediaUploader } from "./media-uploader";
import styles from "./media.module.css";

/** MediaPickerのlocale、初期値、操作callbackです。
 * @property {Locale} locale - 表示言語。
 * @property {string | null} selectedId - 呼び出し元で現在選択中のID。
 * @property {string} triggerLabel - Dialogを開くButtonのラベル。
 * @property {boolean} [disabled] - Pickerを無効にするかどうか。
 * @property {(media: MediaAsset) => void} onSelect - 明示確定時に呼ぶcallback。
 */
export type MediaPickerProps = {
  locale: Locale;
  selectedId: string | null;
  triggerLabel: string;
  disabled?: boolean;
  onSelect: (media: MediaAsset) => void;
};

/** 再利用可能なnative-dialog Media picker。
 * @param {MediaPickerProps} root0 - Pickerのlocale、初期選択、表示ラベル、callback。
 * @param {Locale} root0.locale - 表示言語。
 * @param {string | null} root0.selectedId - 呼び出し元で現在選択中のID。
 * @param {string} root0.triggerLabel - Dialogを開くButtonのラベル。
 * @param {boolean} [root0.disabled] - Pickerを無効にするかどうか。
 * @param {(media: MediaAsset) => void} root0.onSelect - 明示確定時に呼ぶcallback。
 * @returns {JSX.Element} Picker triggerとDialog。
 */
export function MediaPicker({ locale, selectedId, triggerLabel, disabled, onSelect }: MediaPickerProps) {
  const t = getTranslation(locale).admin.media;
  const [open, setOpen] = useState(false);
  const [temporarySelectedId, setTemporarySelectedId] = useState<string | null>(null);
  const [temporaryAsset, setTemporaryAsset] = useState<MediaAsset | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const library = useMediaLibrary(open);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>("input:not([disabled]), button:not([disabled])")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || !selectedId || temporarySelectedId !== selectedId) return;
    const listedAsset = library.media.find((asset) => asset.id === selectedId);
    if (listedAsset) return;
    if (!library.loaded) return;
    let active = true;
    fetch(`/api/admin/media/${encodeURIComponent(selectedId)}`)
      .then(async (response) => (response.ok ? response.json() : null))
      .then((value: unknown) => {
        const media = value && typeof value === "object" ? (value as { media?: unknown }).media : null;
        if (active && isMediaAsset(media)) setTemporaryAsset(media);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open, selectedId, temporarySelectedId, library.media, library.loaded]);

  function closePicker() {
    if (dialogRef.current?.open) dialogRef.current.close();
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function selectAsset(asset: MediaAsset) {
    setTemporarySelectedId(asset.id);
    setTemporaryAsset(asset);
  }

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        className={styles.trigger}
        disabled={disabled}
        onClick={() => {
          setTemporarySelectedId(selectedId);
          setTemporaryAsset(null);
          setOpen(true);
        }}
      >
        {triggerLabel}
      </Button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="media-picker-heading"
        onCancel={(event) => {
          event.preventDefault();
          closePicker();
        }}
      >
        {open ? (
          <div className={styles.dialogContent}>
            <header className={styles.dialogHeader}>
              <h2 id="media-picker-heading">{t.selectMedia}</h2>
              <Button variant="ghost" onClick={closePicker}>
                {t.cancel}
              </Button>
            </header>
            <MediaUploader
              locale={locale}
              databaseConfigured={library.databaseConfigured}
              storageConfigured={library.storageConfigured}
              onUploaded={async (asset) => {
                setTemporarySelectedId(asset.id);
                setTemporaryAsset(asset);
                await library.refreshFirstPage();
              }}
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
              selectable
              selectedId={temporarySelectedId}
              onSelect={selectAsset}
              onPageChange={library.goToPage}
              onRetry={library.retry}
            />
            <footer className={styles.pickerActions}>
              <Button variant="secondary" onClick={closePicker}>
                {t.cancel}
              </Button>
              <Button
                disabled={
                  !temporarySelectedId ||
                  library.loading ||
                  !library.databaseConfigured ||
                  !(library.media.find((asset) => asset.id === temporarySelectedId) ?? temporaryAsset)
                }
                onClick={() => {
                  const selected = library.media.find((asset) => asset.id === temporarySelectedId) ?? temporaryAsset;
                  if (!selected) return;
                  onSelect(selected);
                  closePicker();
                }}
              >
                {t.useSelected}
              </Button>
            </footer>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
