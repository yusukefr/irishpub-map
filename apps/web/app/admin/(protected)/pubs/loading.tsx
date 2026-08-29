/**
 * 管理店舗の検索・ページ移動中に表示するフォールバックです。
 * @returns {JSX.Element} 管理店舗一覧の読み込み表示。
 */
export default function AdminPubsLoading() {
  return <p role="status">店舗を読み込んでいます…</p>;
}
