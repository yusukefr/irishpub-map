"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import type { Locale } from "../lib/i18n";
import { Button } from "./ui/button";

const messages = {
  ja: {
    share: "共有する",
    copy: "URLをコピー",
    copied: "URLをコピーしました。",
    failed: "共有できませんでした。URLをコピーして共有できます。",
    manual: "コピーできませんでした。以下のURLを選択してコピーしてください。",
    url: "共有用URL",
  },
  en: {
    share: "Share",
    copy: "Copy URL",
    copied: "URL copied.",
    failed: "Unable to share. You can copy the URL instead.",
    manual: "Unable to copy. Select and copy the URL below.",
    url: "Share URL",
  },
};

const subscribe = () => () => {};
const supportsShare = () => typeof navigator.share === "function";
const serverSupportsShare = () => true;

/**
 * 公開URLを端末の共有機能へ渡し、非対応時はコピー操作を提供します。
 * @param props 翻訳言語、公開タイトル・テキスト、呼び出し元で生成した正規URL。
 * @param props.title 公開タイトル。
 * @param props.text 任意の紹介文。
 * @param props.url 正規公開URL。
 * @param props.locale 表示言語。
 * @returns 共有ボタンと結果の読み上げ通知。
 */
export function ShareButton({
  title,
  text,
  url,
  locale,
}: {
  title: string;
  text?: string;
  url: string;
  locale: Locale;
}) {
  const t = messages[locale];
  const nativeShare = useSyncExternalStore(subscribe, supportsShare, serverSupportsShare);
  const [copyFallback, setCopyFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"copied" | "failed" | "manual" | null>(null);
  const inFlight = useRef(false);
  const copy = !nativeShare || copyFallback;

  const handleShare = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setStatus(null);
    try {
      if (copy) {
        await navigator.clipboard.writeText(url);
        setStatus("copied");
      } else {
        // ユーザー操作の有効期間を保つため、事前の非同期処理を挟みません。
        await navigator.share({ title, ...(text ? { text } : {}), url });
      }
    } catch (error) {
      if (copy) {
        setStatus("manual");
      } else if (!(error instanceof DOMException && error.name === "AbortError")) {
        setCopyFallback(true);
        setStatus("failed");
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Button variant="secondary" loading={busy} onClick={handleShare}>
        {copy ? t.copy : t.share}
      </Button>
      <p role="status" className="text-body-sm">
        {status ? t[status] : ""}
      </p>
      {status === "manual" ? (
        <label className="grid gap-2 text-body-sm">
          {t.url}
          <input className="min-w-0 w-full" readOnly value={url} onFocus={(event) => event.target.select()} />
        </label>
      ) : null}
    </div>
  );
}
