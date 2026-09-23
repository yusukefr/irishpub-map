"use client";

import Image from "next/image";
import type { MediaAsset } from "@irishpub-map/shared/media";
import { formatMediaDate, formatMediaFileSize, formatMediaType } from "../../lib/media/presentation";
import { getTranslation, type Locale } from "../../lib/i18n";
import styles from "./media.module.css";

/** Media AssetのPreviewと管理用metadataを表示する再利用Gridです。
 * @param {object} root0 - Component props。
 * @param {Locale} root0.locale - 表示言語。
 * @param {MediaAsset[]} root0.media - 表示するMedia。
 * @param {string | null} [root0.selectedId] - Pickerで選択中のID。
 * @param {boolean} [root0.selectable] - 選択操作を表示するかどうか。
 * @param {(asset: MediaAsset) => void} [root0.onSelect] - 選択時のcallback。
 * @returns {JSX.Element} Media card一覧。
 */
export function MediaGrid({
  locale,
  media,
  selectedId,
  selectable = false,
  onSelect,
}: {
  locale: Locale;
  media: MediaAsset[];
  selectedId?: string | null;
  selectable?: boolean;
  onSelect?: (asset: MediaAsset) => void;
}) {
  const t = getTranslation(locale).admin.media;
  return (
    <div className={styles.grid}>
      {media.map((asset) => {
        const selected = selectedId === asset.id;
        const card = (
          <>
            <span className={styles.imageFrame}>
              <Image src={asset.url} alt="" fill sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 25vw" />
            </span>
            <dl className={styles.metadata}>
              <div>
                <dt>{t.dimensions}</dt>
                <dd>
                  {asset.width} × {asset.height}
                </dd>
              </div>
              <div>
                <dt>{t.format}</dt>
                <dd>{formatMediaType(asset.mimeType)}</dd>
              </div>
              <div>
                <dt>{t.fileSize}</dt>
                <dd>{formatMediaFileSize(asset.fileSize, locale)}</dd>
              </div>
              <div>
                <dt>{t.createdAt}</dt>
                <dd>
                  <time dateTime={asset.createdAt}>{formatMediaDate(asset.createdAt, locale)}</time>
                </dd>
              </div>
              <div>
                <dt>{t.mediaId}</dt>
                <dd>{asset.id}</dd>
              </div>
            </dl>
            {selectable ? <span className={styles.cardState}>{selected ? t.selected : ""}</span> : null}
          </>
        );
        return selectable ? (
          <button
            key={asset.id}
            type="button"
            className={styles.selectCard}
            aria-pressed={selected}
            aria-label={`${t.selectMediaAccessible}, ${asset.width} × ${asset.height}, ${formatMediaType(asset.mimeType)}, ${asset.id}`}
            onClick={() => onSelect?.(asset)}
          >
            {card}
          </button>
        ) : (
          <article key={asset.id} className={styles.card}>
            {card}
          </article>
        );
      })}
    </div>
  );
}
