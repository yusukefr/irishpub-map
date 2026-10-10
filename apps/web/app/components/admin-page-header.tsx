/**
 * 管理画面の小さなセクション名、ページ見出し、説明、主要操作をまとめます。
 * @param {{ sectionLabel: string; title: string; description?: string; actions?: React.ReactNode }} props - ページヘッダーの内容。
 * @param {string} props.sectionLabel - 現在の管理領域を示す短いラベル。
 * @param {string} props.title - ページの主見出し。
 * @param {string} [props.description] - 見出しを補足する短い説明。
 * @param {React.ReactNode} [props.actions] - 主要操作。狭い画面では見出しの下へ配置されます。
 * @returns {JSX.Element} 共通の管理画面ページヘッダー。
 */
export function AdminPageHeader({
  sectionLabel,
  title,
  description,
  actions,
}: {
  sectionLabel: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="admin-page-header">
      <div className="admin-page-header-copy">
        <p className="admin-page-header-label">{sectionLabel}</p>
        <div>
          <h1>{title}</h1>
          {description ? <p className="admin-page-header-description">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="admin-page-header-actions">{actions}</div> : null}
    </header>
  );
}
