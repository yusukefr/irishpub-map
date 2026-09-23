"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminMediaPage, MediaAsset } from "@irishpub-map/shared/media";
import { ADMIN_MEDIA_PAGE_SIZE } from "@irishpub-map/shared/media";
import { isMediaAsset } from "./presentation";

type MediaLibraryResponse = AdminMediaPage & {
  databaseConfigured: boolean;
  storageConfigured: boolean;
};

function isLibraryResponse(value: unknown): value is MediaLibraryResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<MediaLibraryResponse>;
  return (
    Array.isArray(response.media) &&
    response.media.every(isMediaAsset) &&
    Number.isSafeInteger(response.total) &&
    Number.isSafeInteger(response.page) &&
    response.pageSize === ADMIN_MEDIA_PAGE_SIZE &&
    typeof response.databaseConfigured === "boolean" &&
    typeof response.storageConfigured === "boolean"
  );
}

async function requestMediaPage(targetPage: number): Promise<MediaLibraryResponse> {
  const response = await fetch(`/api/admin/media?page=${targetPage}`);
  const value: unknown = await response.json();
  if (!response.ok || !isLibraryResponse(value)) throw new Error("Invalid media response.");
  return value;
}

/** 管理一覧とPickerで共通するpage-based Media Library状態を管理します。
 * @param {boolean} enabled - 一覧取得を開始するかどうか。
 * @returns {object} 一覧、状態、ページ操作をまとめた値。
 */
export function useMediaLibrary(enabled = true) {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [databaseConfigured, setDatabaseConfigured] = useState(false);
  const [storageConfigured, setStorageConfigured] = useState(false);
  const [configurationKnown, setConfigurationKnown] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const latestRequestId = useRef(0);
  const retryPage = useRef(1);

  const loadPage = useCallback(async (targetPage: number, allowCorrection = true) => {
    const requestId = ++latestRequestId.current;
    retryPage.current = targetPage;
    setLoading(true);
    setError(false);
    try {
      let value = await requestMediaPage(targetPage);
      if (requestId !== latestRequestId.current) return;
      const lastPage = Math.max(1, Math.ceil(value.total / value.pageSize));
      if (allowCorrection && targetPage > 1 && value.media.length === 0 && value.total > 0 && targetPage !== lastPage) {
        retryPage.current = lastPage;
        value = await requestMediaPage(lastPage);
        if (requestId !== latestRequestId.current) return;
      }
      setDatabaseConfigured(value.databaseConfigured);
      setStorageConfigured(value.storageConfigured);
      setConfigurationKnown(true);
      setTotal(value.total);
      setMedia(value.media);
      setPage(value.page);
      setLoaded(true);
    } catch {
      if (requestId !== latestRequestId.current) return;
      setLoaded(true);
      setError(true);
    } finally {
      if (requestId === latestRequestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadPage(1);
    });
    return () => {
      active = false;
      latestRequestId.current += 1;
    };
  }, [enabled, loadPage]);

  const goToPage = useCallback(
    (nextPage: number) => {
      if (
        loading ||
        nextPage < 1 ||
        nextPage === page ||
        nextPage > Math.max(1, Math.ceil(total / ADMIN_MEDIA_PAGE_SIZE))
      )
        return;
      void loadPage(nextPage);
    },
    [loading, loadPage, page, total],
  );

  const refreshFirstPage = useCallback(async () => {
    await loadPage(1);
  }, [loadPage]);

  const retry = useCallback(() => void loadPage(retryPage.current), [loadPage]);

  return {
    media,
    total,
    page,
    pageSize: ADMIN_MEDIA_PAGE_SIZE,
    loading,
    error,
    databaseConfigured,
    storageConfigured,
    configurationKnown,
    loaded,
    goToPage,
    refreshFirstPage,
    retry,
  };
}
