import { parseAdminMediaPage, AdminMediaSearchValidationError } from "@irishpub-map/shared/media";
import { adminApiErrorResponse, getAdminApiAuthorizationError } from "../../../lib/admin-api";
import { isMediaDatabaseConfigured, listMediaAssets } from "../../../lib/media/repository";
import { isMediaStorageConfigured } from "../../../lib/media/storage";
import { MediaUploadServiceError, uploadAdminMedia } from "../../../lib/media/service";
import { MediaValidationError } from "../../../lib/media/validation";
import { isE2ETestMode } from "../../../lib/e2e-test-mode";

export const runtime = "nodejs";

/**
 * Lists media assets for authenticated administrators.
 * @param {Request} request - Authenticated list request with optional page query.
 * @returns {Promise<Response>} Fixed-size media page or a safe API error.
 */
export async function GET(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  let page: number;
  try {
    page = parseAdminMediaPage(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof AdminMediaSearchValidationError) return adminApiErrorResponse("invalid_request", 400);
    throw error;
  }
  const databaseConfigured = isMediaDatabaseConfigured() || isE2ETestMode();
  if (!databaseConfigured)
    return Response.json({
      media: [],
      total: 0,
      page,
      pageSize: 50,
      databaseConfigured: false,
      storageConfigured: isMediaStorageConfigured(),
    });
  try {
    return Response.json({
      ...(await listMediaAssets(page)),
      databaseConfigured,
      storageConfigured: isMediaStorageConfigured(),
    });
  } catch {
    return adminApiErrorResponse("internal_error", 500);
  }
}

/**
 * Validates and stores a single uploaded image.
 * @param {Request} request - Multipart upload request.
 * @returns {Promise<Response>} Created media DTO or a safe API error.
 */
export async function POST(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!isMediaDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  if (!isMediaStorageConfigured()) return adminApiErrorResponse("media_storage_unavailable", 503);
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "multipart/form-data") {
    return adminApiErrorResponse("invalid_content_type", 415);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return adminApiErrorResponse("invalid_request", 400);
  }
  const entries = [...form.entries()];
  if (entries.length !== 1 || entries[0][0] !== "file" || !(entries[0][1] instanceof File))
    return adminApiErrorResponse("invalid_request", 400);
  try {
    return Response.json({ media: await uploadAdminMedia(entries[0][1]) }, { status: 201 });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      if (error.kind === "too_large") {
        console.error(JSON.stringify({ event: "media_validation_failed", errorCategory: "file_too_large" }));
        return adminApiErrorResponse("media_file_too_large", 413);
      }
      if (error.kind === "unsupported") {
        console.error(JSON.stringify({ event: "media_validation_failed", errorCategory: "unsupported_format" }));
        return adminApiErrorResponse("media_unsupported_format", 415);
      }
      if (error.kind === "dimensions") {
        console.error(JSON.stringify({ event: "media_validation_failed", errorCategory: "dimensions_exceeded" }));
        return adminApiErrorResponse("media_dimensions_exceeded", 422);
      }
      console.error(JSON.stringify({ event: "media_validation_failed", errorCategory: "invalid_image" }));
      return adminApiErrorResponse("media_invalid_image", 422);
    }
    if (error instanceof MediaUploadServiceError) {
      return error.kind === "blob_failed"
        ? adminApiErrorResponse("media_storage_unavailable", 503)
        : adminApiErrorResponse("internal_error", 500);
    }
    return adminApiErrorResponse("internal_error", 500);
  }
}
