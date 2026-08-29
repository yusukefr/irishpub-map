"use client";

/**
 * 管理店舗一覧を取得できない場合に再試行手段を表示します。
 * @param {{ reset: () => void }} root0 - Next.jsのエラー回復操作。
 * @param {() => void} root0.reset - 対象セグメントを再描画する関数。
 * @returns {JSX.Element} 管理店舗一覧のエラー表示。
 */
export default function AdminPubsError({ reset }: { reset: () => void }) {
  return (
    <section className="admin-panel" role="alert">
      <h1>店舗一覧を取得できませんでした。</h1>
      <button type="button" onClick={reset}>
        再試行
      </button>
    </section>
  );
}
