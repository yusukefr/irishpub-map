/** Media Asset一覧APIで1ページに返す固定件数です。 */
export const ADMIN_MEDIA_PAGE_SIZE = 50;
/** Upload可能な画像の最大bytesです。 */
export const MEDIA_MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
/** Upload可能な画像の最大widthとheightです。 */
export const MEDIA_MAX_DIMENSION = 8192;
/** Upload可能な画像の最大総pixel数です。 */
export const MEDIA_MAX_PIXEL_COUNT = 40_000_000;

/** Sharpが実データから判定し、Upload後のContent-Typeに使うMIME typeです。 */
export const MEDIA_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Media Assetが利用できるMIME typeです。 */
export type MediaMimeType = (typeof MEDIA_MIME_TYPES)[number];

/** 管理APIと将来の公開Contentが共有するMedia Asset DTOです。 */
export type MediaAsset = {
  id: string;
  url: string;
  mimeType: MediaMimeType;
  width: number;
  height: number;
  fileSize: number;
  createdAt: string;
};

/** Media Asset管理一覧の固定件数ページです。 */
export type AdminMediaPage = {
  media: MediaAsset[];
  total: number;
  page: number;
  pageSize: typeof ADMIN_MEDIA_PAGE_SIZE;
};

/** Media Asset管理一覧Queryが契約を満たさない場合のエラーです。 */
export class AdminMediaSearchValidationError extends Error {
  /** 不正なpageまたは未知のQuery Parameterを表します。 */
  constructor() {
    super("Invalid admin media search parameters.");
    this.name = "AdminMediaSearchValidationError";
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Media Asset IDがUUID形式かを判定します。
 * @param {string} value - 判定対象。
 * @returns {boolean} UUID形式の場合はtrue。
 */
export function isMediaAssetId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * 管理Media一覧Queryから正の安全なページ番号を読み取ります。
 * @param {URLSearchParams} params - URLのQuery Parameter。
 * @returns {number} 1始まりのページ番号。
 */
export function parseAdminMediaPage(params: URLSearchParams): number {
  const keys = [...params.keys()];
  if (keys.some((key) => key !== "page") || params.getAll("page").length > 1) {
    throw new AdminMediaSearchValidationError();
  }
  const rawPage = params.get("page");
  if (rawPage === null) return 1;
  if (!/^[1-9]\d*$/.test(rawPage)) throw new AdminMediaSearchValidationError();
  const page = Number(rawPage);
  if (!Number.isSafeInteger(page) || (page - 1) * ADMIN_MEDIA_PAGE_SIZE > Number.MAX_SAFE_INTEGER) {
    throw new AdminMediaSearchValidationError();
  }
  return page;
}
