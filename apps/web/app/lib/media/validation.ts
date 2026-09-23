import sharp from "sharp";
import {
  MEDIA_MAX_DIMENSION,
  MEDIA_MAX_FILE_SIZE_BYTES,
  MEDIA_MAX_PIXEL_COUNT,
  type MediaMimeType,
} from "@irishpub-map/shared/media";

const FORMAT_MIME: Record<string, MediaMimeType> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const MIME_EXTENSION: Record<MediaMimeType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Error raised when the file fails a media upload validation rule. */
export class MediaValidationError extends Error {
  /** Creates a validation error with a safe category. @param {"too_large" | "unsupported" | "invalid" | "dimensions"} kind - Safe validation category. */
  constructor(public readonly kind: "too_large" | "unsupported" | "invalid" | "dimensions") {
    super("Invalid media upload.");
    this.name = "MediaValidationError";
  }
}

/** Verified image bytes and metadata used by persistence layers. */
export type ValidatedMedia = {
  buffer: Buffer;
  mimeType: MediaMimeType;
  extension: string;
  width: number;
  height: number;
  fileSize: number;
};

/**
 * Checks claimed metadata against the decoded image and enforces media limits.
 * @param {File} file - Uploaded file.
 * @returns {Promise<ValidatedMedia>} Verified image bytes and metadata.
 */
export async function validateMediaFile(file: File): Promise<ValidatedMedia> {
  if (file.size > MEDIA_MAX_FILE_SIZE_BYTES) throw new MediaValidationError("too_large");
  if (!file.size) throw new MediaValidationError("invalid");
  const buffer = Buffer.from(await file.arrayBuffer());
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(buffer, { animated: true }).metadata();
  } catch {
    throw new MediaValidationError("invalid");
  }
  if (!metadata.format || !(metadata.format in FORMAT_MIME)) throw new MediaValidationError("unsupported");
  if ((metadata.pages ?? 1) > 1) throw new MediaValidationError("unsupported");
  const mimeType = FORMAT_MIME[metadata.format];
  const extension = MIME_EXTENSION[mimeType];
  if (file.type && file.type.toLowerCase() !== mimeType) throw new MediaValidationError("unsupported");
  const extensionSeparator = file.name.lastIndexOf(".");
  const claimedExtension = extensionSeparator >= 0 ? file.name.slice(extensionSeparator + 1).toLowerCase() : "";
  if (claimedExtension && ![extension, ...(mimeType === "image/jpeg" ? ["jpeg"] : [])].includes(claimedExtension)) {
    throw new MediaValidationError("unsupported");
  }
  const { width, height } = metadata;
  if (!width || !height) throw new MediaValidationError("invalid");
  if (width > MEDIA_MAX_DIMENSION || height > MEDIA_MAX_DIMENSION || width * height > MEDIA_MAX_PIXEL_COUNT) {
    throw new MediaValidationError("dimensions");
  }
  try {
    await sharp(buffer, { limitInputPixels: MEDIA_MAX_PIXEL_COUNT }).stats();
  } catch {
    throw new MediaValidationError("invalid");
  }
  return { buffer, mimeType, extension, width, height, fileSize: buffer.byteLength };
}
