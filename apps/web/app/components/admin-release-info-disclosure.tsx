"use client";

import { useState, type ReactNode } from "react";

/**
 * MobileでRelease詳細を省スペース表示する開閉Controlを提供します。
 * @param {{ heading: string; versionLabel: string; version: string; children: ReactNode }} props - 見出し、Version、詳細。
 * @returns {JSX.Element} Desktopでは常時詳細、Mobileでは開閉可能なRelease情報。
 */
export function AdminReleaseInfoDisclosure({
  heading,
  versionLabel,
  version,
  children,
}: {
  heading: string;
  versionLabel: string;
  version: string;
  children: ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <h2>{heading}</h2>
      <button
        className="admin-release-info-toggle"
        type="button"
        aria-expanded={isExpanded}
        aria-controls="admin-release-info-details"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>{heading}</span>
        <span aria-hidden="true">·</span>
        <span>
          {versionLabel}: {version}
        </span>
      </button>
      <div id="admin-release-info-details" className={`admin-release-info-details${isExpanded ? " is-open" : ""}`}>
        {children}
      </div>
    </>
  );
}
