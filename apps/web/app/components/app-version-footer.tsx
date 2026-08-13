import appVersion from "../../../../app-version.json";

/** ビルドに含まれるバージョン番号とリリース日を表示します。 */
export function AppVersionFooter() {
  return (
    <footer className="app-version" aria-label="アプリのバージョン情報">
      <span>v{appVersion.version}</span>
      <span>リリース日 {appVersion.releaseDate}（JST）</span>
    </footer>
  );
}
