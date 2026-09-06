# Editorial Contentのキャッシュ方針

公開Contentは読み取り頻度が高く更新頻度が低いため、将来の管理更新時に次の単位で無効化できる設計を採用します。

- 個別: `content:{kind}:{slug}`
- 一覧: `content:list:{kind}`

現在は既存RouteがCache Componentsと互換になっていないため、全体設定の有効化は行いません。管理Routeのruntime APIをSuspense境界または個別キャッシュへ移行した後、Next.jsのCache Componentsで上記タグを有効化します。
