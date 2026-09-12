# Editorial Contentのキャッシュ方針

公開Contentは読み取り頻度が高く更新頻度が低いため、次のタグを公開読み取りキャッシュの契約とします。

- 個別: `content:{kind}:{slug}`
- 一覧: `content:list:{kind}`

公開Repositoryは、Cache Componentsを有効化していない現行構成向けのNext.js Data CacheでNeon読み取りをキャッシュします。個別取得はkind・slug・locale、一覧取得はkind・localeをキャッシュキーに含めるため、日英の結果は混線しません。時間では失効させず、管理APIによる更新成功後のタグ失効を更新契約とします。

管理APIは、公開、公開済みContentの更新、Draftへの変更がtransactionで成功した後に、該当する個別タグと一覧タグを `revalidateTag(tag, { expire: 0 })` で即時失効させます。kindまたはslugを変更した公開済みContentでは、変更前後のタグを失効させます。これにより公開内容の更新とDraft化後の次回読み取りはNeonから再取得されます。

将来Cache Componentsへ移行する場合は、既存Routeのruntime APIをSuspense境界または個別キャッシュへ移行したうえで、`use cache` / `cacheTag`へ置き換えます。タグ名とlocaleを含むキー分離は同じ契約を維持します。
