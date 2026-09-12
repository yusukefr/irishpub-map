# Content directory

このディレクトリには、Neon移行前に公開していたStoryとGuideのTrusted MDXを、Rollback Sourceとして一時保持します。公開GuideのSource of TruthはNeon PostgreSQLのEditorial Contentであり、`/discover`と`/discover/guides/[slug]`はこのMDXを読みません。

```text
content/
└── discover/
    └── guides/
        └── sample/
            ├── ja.mdx
            └── en.mdx
```

旧Loaderは`apps/web/app/lib/content/legacy-repository.ts`の固定Allow Listだけから読み込み、Request由来のslugをDynamic Importへ直接渡しません。公開経路への恒久的なDB → MDX fallbackは設けません。

MDXのmetadataは単純なES Module objectとして本文ファイルからexportし、slug、kind、title、summary、category、Stable Tag ID、公開日を含めます。MDX内では`as`や`satisfies`などのTypeScript専用構文を使用せず、RepositoryのRuntime Validationで検証します。`mdx-components.tsx`は共通Component Overrideを提供しますが、MDX自体のJSX / ESMをSandboxするものではありません。Frontmatter、Raw HTML、Remote MDX、ユーザー投稿MDXは使用せず、Repository内のTrusted Contentだけを対象にします。

新しい公開Guideは管理用Editorial Content経路から日英TranslationをNeonへ保存・公開します。このディレクトリへMDXを追加しても公開一覧・詳細Routeには表示されません。既存MDXと旧Loaderの削除はIssue #382で扱います。
