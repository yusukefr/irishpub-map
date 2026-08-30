"use client";

import { DEFAULT_LOCALE } from "@irishpub-map/shared/locale";
import { getTranslation, parseLocale } from "../../../lib/i18n";

/**
 * 管理店舗一覧を取得できない場合に再試行手段を表示します。
 * @param {{ reset: () => void }} root0 - Next.jsのエラー回復操作。
 * @param {() => void} root0.reset - 対象セグメントを再描画する関数。
 * @returns {JSX.Element} 管理店舗一覧のエラー表示。
 */
export default function AdminPubsError({ reset }: { reset: () => void }) {
  // Error BoundaryはClient Componentのため、ルート要素へ反映済みの言語を参照します。
  const locale =
    typeof document === "undefined" ? DEFAULT_LOCALE : (parseLocale(document.documentElement.lang) ?? DEFAULT_LOCALE);
  const t = getTranslation(locale);
  return (
    <section className="admin-panel" role="alert">
      <h1>{t.admin.adminPubsLoadFailed}</h1>
      <button type="button" onClick={reset}>
        {t.admin.retry}
      </button>
    </section>
  );
}
