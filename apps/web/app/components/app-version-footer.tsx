import appVersion from "../../../../app-version.json";

export function AppVersionFooter() {
  return (
    <footer className="app-version" aria-label="アプリのバージョン情報">
      <span>v{appVersion.version}</span>
      <span>リリース日 {appVersion.releaseDate}</span>
    </footer>
  );
}
