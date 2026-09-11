# Editorial Contentのキャッシュ方針

公開Contentは読み取り頻度が高く更新頻度が低いため、次のタグを公開読み取りキャッシュの契約とします。

- 個別: `content:{kind}:{slug}`
- 一覧: `content:list:{kind}`

現在は既存RouteがCache Componentsと互換になっていないため、公開Repositoryのキャッシュ自体は有効化していません。管理APIは、公開、公開済みContentの更新、Draftへの変更がtransactionで成功した後に、該当する個別タグと一覧タグを `revalidateTag(tag, { expire: 0 })` で失効させます。kindまたはslugを変更した公開済みContentでは、変更前後のタグを失効させます。

これにより、公開読み取りへ上記タグを接続した時点から管理更新を即時反映できます。Cache Componentsを有効化する場合は、既存Routeのruntime APIをSuspense境界または個別キャッシュへ移行してから行います。
