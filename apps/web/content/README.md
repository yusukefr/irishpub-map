# Content directory

StoryとGuideのTrusted MDXを、1コンテンツ1ディレクトリ・locale別ファイルで管理します。

```text
content/
└── discover/
    └── guides/
        └── sample/
            ├── ja.mdx
            └── en.mdx
```

公開対象は、`apps/web/app/lib/content/registry.ts`へ日本語・英語の両方を明示登録してください。Request由来のslugをDynamic Importへ直接渡さず、Content RepositoryからRegistry経由で読み込みます。

MDXのmetadataは単純なES Module objectとして本文ファイルからexportし、slug、kind、title、summary、category、Stable Tag ID、公開日を含めます。MDX内では`as`や`satisfies`などのTypeScript専用構文を使用せず、RepositoryのRuntime Validationで検証します。`mdx-components.tsx`は共通Component Overrideを提供しますが、MDX自体のJSX / ESMをSandboxするものではありません。Frontmatter、Raw HTML、Remote MDX、ユーザー投稿MDXは使用せず、Repository内のTrusted Contentだけを対象にします。

Registry Entryにはslug、kind、loadersを持たせ、loadersのjaとenを必須にします。MDX moduleの型は`mdx.d.ts`で宣言し、実データは読み込み時に`ContentArticleMetadata`の要件を満たすか検証します。新しいGuideは日英MDXを同じslugのディレクトリへ追加してRegistryへ登録すると、`/discover`の一覧と`/discover/guides/[slug]`の詳細Routeから利用できます。Guide固有のtitle、summary、本文は翻訳JSONへ重複させず、各localeのMDXで管理します。
