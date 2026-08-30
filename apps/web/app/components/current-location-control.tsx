"use client";

import { useId } from "react";

/** 現在地取得の進行状態です。 */
export type GeolocationStatus = "idle" | "requesting" | "success" | "no-pubs" | "denied" | "error" | "unsupported";

type CurrentLocationControlProps = {
  status: GeolocationStatus;
  actionLabel: string;
  privacyDescription: string;
  statusMessage: string | null;
  onRequest: () => void;
};

/**
 * Map上で現在地取得を開始し、取得結果やエラーを簡潔に表示します。
 * @param {CurrentLocationControlProps} props - 現在地操作と状態表示の設定。
 * @returns {JSX.Element} 現在地取得のオーバーレイ操作。
 */
export function CurrentLocationControl({
  status,
  actionLabel,
  privacyDescription,
  statusMessage,
  onRequest,
}: CurrentLocationControlProps) {
  const privacyDescriptionId = useId();
  const isRequesting = status === "requesting";
  const isUnavailable = status === "unsupported";

  return (
    <div className="current-location-control">
      <span id={privacyDescriptionId} className="visually-hidden">
        {privacyDescription}
      </span>
      {!isUnavailable ? (
        <button
          type="button"
          className="current-location-action"
          onClick={onRequest}
          disabled={isRequesting}
          aria-describedby={privacyDescriptionId}
        >
          <span className="current-location-icon" aria-hidden="true">
            ◎
          </span>
          <span>{actionLabel}</span>
        </button>
      ) : null}
      {statusMessage ? (
        <p
          className={"current-location-status current-location-status-" + status}
          role={status === "denied" || status === "error" ? "alert" : "status"}
        >
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
