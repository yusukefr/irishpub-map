# Content directory

StoryとGuideのTrusted MDXを、1コンテンツ1ディレクトリ・locale別ファイルで管理します。

```text
content/
└── discover/
    └── guides/
        └── split-the-g/
            ├── ja.mdx
            └── en.mdx
```

公開対象は、`apps/web/app/lib/content/registry.ts`へ日本語・英語の両方を明示登録してください。Request由来のslugをDynamic Importへ直接渡さず、Content RepositoryからRegistry経由で読み込みます。

MDXのmetadataは本文ファイルからexportし、slug、kind、category、Stable Tag ID、公開日を含めます。Frontmatter、Raw HTML、Remote MDX、ユーザー投稿MDXは使用しません。

実際のDiscoverページと記事は後続Issue #309以降で追加します。
