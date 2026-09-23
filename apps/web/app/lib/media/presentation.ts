import type { MediaAsset, MediaMimeType } from "@irishpub-map/shared/media";
import type { Locale } from "../i18n";

const MEDIA_FORMATS: Record<MediaMimeType, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

/**
 * Media MIME typeを管理画面向けの短い形式名へ変換します。
 * @param {MediaMimeType} mimeType - Media AssetのMIME type。
 * @returns {string} 利用者向け形式名。
 */
export function formatMediaType(mimeType: MediaMimeType) {
  return MEDIA_FORMATS[mimeType];
}

/**
 * File sizeを1024基準で最大小数1桁まで表示します。
 * @param {number} fileSize - Byte単位のサイズ。
 * @param {Locale} locale - 表示言語。
 * @returns {string} 単位付きサイズ。
 */
export function formatMediaFileSize(fileSize: number, locale: Locale) {
  if (fileSize < 1024) return `${fileSize} B`;
  const divisor = fileSize < 1024 * 1024 ? 1024 : 1024 * 1024;
  const unit = fileSize < 1024 * 1024 ? "KB" : "MB";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(fileSize / divisor)} ${unit}`;
}

/**
 * ISO日時を現在のlocaleで管理画面向けに表示します。
 * @param {string} createdAt - ISO形式の作成日時。
 * @param {Locale} locale - 表示言語。
 * @returns {string} ローカライズした日時。
 */
export function formatMediaDate(createdAt: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(createdAt));
}

/**
 * API Response内のMediaAssetを最小限検証します。
 * @param {unknown} value - APIから受け取った値。
 * @returns {boolean} MediaAssetとして扱える場合はtrue。
 */
export function isMediaAsset(value: unknown): value is MediaAsset {
  if (!value || typeof value !== "object") return false;
  const media = value as Partial<MediaAsset>;
  return (
    typeof media.id === "string" &&
    typeof media.url === "string" &&
    ["image/jpeg", "image/png", "image/webp"].includes(media.mimeType ?? "") &&
    Number.isFinite(media.width) &&
    Number.isFinite(media.height) &&
    Number.isFinite(media.fileSize) &&
    typeof media.createdAt === "string"
  );
}
