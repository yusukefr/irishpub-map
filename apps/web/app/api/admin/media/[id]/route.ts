import { isMediaAssetId } from "@irishpub-map/shared/media";
import { adminApiErrorResponse, getAdminApiAuthorizationError } from "../../../../lib/admin-api";
import { getMediaAsset, isMediaDatabaseConfigured } from "../../../../lib/media/repository";
import { isE2ETestMode } from "../../../../lib/e2e-test-mode";

export const runtime = "nodejs";

/**
 * Returns one media asset without exposing its storage key.
 * @param {Request} request - Authenticated detail request.
 * @param {object} context - Route context.
 * @param {Promise<{ id: string }>} context.params - Dynamic media asset ID.
 * @returns {Promise<Response>} Media DTO or a safe API error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  const { id } = await context.params;
  if (!isMediaAssetId(id)) return adminApiErrorResponse("invalid_request", 400);
  if (!isMediaDatabaseConfigured() && !isE2ETestMode()) return adminApiErrorResponse("database_unavailable", 503);
  try {
    const media = await getMediaAsset(id);
    return media ? Response.json({ media }) : adminApiErrorResponse("not_found", 404);
  } catch {
    return adminApiErrorResponse("internal_error", 500);
  }
}
