import { randomUUID } from "node:crypto";
import type { MediaAsset } from "@irishpub-map/shared/media";
import { rejectE2ETestMutation } from "../e2e-test-mode";
import { insertMediaAsset } from "./repository";
import { deleteMediaBlob, uploadMediaBlob } from "./storage";
import { validateMediaFile } from "./validation";

/** Internal media upload failure with a safe stage identifier. */
export class MediaUploadServiceError extends Error {
  /**
   * Identifies a failed upload stage without retaining provider details.
   * @param {"blob_failed" | "database_failed" | "compensation_failed"} kind - Failed stage.
   */
  constructor(public readonly kind: "blob_failed" | "database_failed" | "compensation_failed") {
    super("Media upload failed.");
  }
}

/**
 * Validates, uploads, persists, and compensates a failed database insert.
 * @param {File} file - Uploaded image.
 * @returns {Promise<MediaAsset>} Persisted media DTO.
 */
export async function uploadAdminMedia(file: File): Promise<MediaAsset> {
  rejectE2ETestMutation();
  const image = await validateMediaFile(file);
  const id = randomUUID();
  const storageKey = `media/${id}.${image.extension}`;
  let blob: { url: string };
  try {
    blob = await uploadMediaBlob(storageKey, image.buffer, image.mimeType);
  } catch {
    console.error(
      JSON.stringify({
        event: "media_blob_upload_failed",
        assetId: id,
        storageKey,
        fileSize: image.fileSize,
        detectedMime: image.mimeType,
        errorCategory: "blob_upload",
      }),
    );
    throw new MediaUploadServiceError("blob_failed");
  }
  try {
    return await insertMediaAsset({
      id,
      storageKey,
      url: blob.url,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      fileSize: image.fileSize,
    });
  } catch {
    console.error(
      JSON.stringify({
        event: "media_db_insert_failed",
        assetId: id,
        storageKey,
        fileSize: image.fileSize,
        detectedMime: image.mimeType,
        errorCategory: "database_insert",
      }),
    );
    try {
      await deleteMediaBlob(blob.url);
    } catch {
      console.error(
        JSON.stringify({
          event: "media_compensation_delete_failed",
          assetId: id,
          storageKey,
          errorCategory: "blob_delete",
        }),
      );
      throw new MediaUploadServiceError("compensation_failed");
    }
    throw new MediaUploadServiceError("database_failed");
  }
}
