# 既存MDX Guide移行棚卸し

## 目的と調査範囲

この文書は、Repository管理の既存Editorial GuideをNeon PostgreSQLへ移行する前に、MDX固有機能への依存と必要な変換を整理したものです。Issue #379の範囲では棚卸しだけを行い、データ投入、Migration Script、公開取得元、MDX、Registry、Rendererは変更しません。

調査は2026年9月12日時点のcommit `f991fbb90171295f7e0d47fa204aab536351ab22`を基準に、次の和集合を対象としました。

- Repository内の全`.mdx`ファイル
- `apps/web/content/discover/guides/**`
- `apps/web/app/lib/content/legacy-repository.ts`の固定loader
- `apps/web/app/lib/content/registry.ts`の`contentRegistry.guide`

結果は2 Guide、4 localeファイルです。`sample`と`split-the-g`は両Registryに登録され、どちらも日本語と英語が存在します。Registry未登録の孤立MDX、MDX実体のないRegistry Entry、片方のlocaleだけを持つGuide、Guide以外のMDXはありません。

## Guide一覧

| slug | locale | file path | title | category | publishedAt | tags | Migration Level |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `sample` | `ja` | `apps/web/content/discover/guides/sample/ja.mdx` | サンプルガイド | `culture` | `2026-09-02` | `sample` | B |
| `sample` | `en` | `apps/web/content/discover/guides/sample/en.mdx` | Sample Guide | `culture` | `2026-09-02` | `sample` | B |
| `split-the-g` | `ja` | `apps/web/content/discover/guides/split-the-g/ja.mdx` | Split the Gを楽しむ | `pub-culture` | `2026-09-05` | `split-the-g`, `guinness` | B |
| `split-the-g` | `en` | `apps/web/content/discover/guides/split-the-g/en.mdx` | How to Enjoy Split the G | `pub-culture` | `2026-09-05` | `split-the-g`, `guinness` | B |

全ファイルの`slug`、`kind`、`category`、`publishedAt`、`tags`は同一Guideの日英で一致しています。`kind`はすべて`guide`です。titleとsummaryだけがlocaleごとに異なります。

Migration Levelはファイル全体を基準にしています。本文だけなら4ファイルとも変換なしで`body_markdown`へ移せますが、先頭のJavaScript exportからmetadataを抽出して削除する必要があるためLevel Bです。JSX、独自Component、Raw HTMLなどの理由でLevel CとなるGuideはありません。

## 依存状況

| Guide / locale | 標準Markdown本文 | Frontmatter | JavaScript export | Import / dynamic import | JSX / MDX Component | Raw HTML | Link | Image |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `sample` / `ja` | Paragraph | なし | `export const metadata` | なし | なし | なし | なし | なし |
| `sample` / `en` | Paragraph | なし | `export const metadata` | なし | なし | なし | なし | なし |
| `split-the-g` / `ja` | Heading、Paragraph、Ordered / Unordered List、Link | なし | `export const metadata` | なし | なし | なし | HTTPS 2件、`/` 1件 | なし |
| `split-the-g` / `en` | Heading、Paragraph、Ordered / Unordered List、Link | なし | `export const metadata` | なし | なし | なし | HTTPS 2件、`/` 1件 | なし |

### MetadataとJavaScript

4ファイルとも先頭で次の形のES Module exportを使います。

```js
export const metadata = {
  slug,
  kind,
  title,
  summary,
  category,
  tags,
  publishedAt,
};
```

本文中のJavaScript、変数参照、式展開、event handler、任意コード実行はありません。Guideファイル自身によるstatic import、dynamic import、Component importもありません。Dynamic importはTrusted Content用固定Allow Listである`legacy-repository.ts`にだけ存在します。DB値やRequest値をimport pathへ変換する依存はありません。

`mdx-components.tsx`は受け取ったComponent定義をそのまま返し、独自Componentを登録していません。このため、移行時にMarkdownへ置換すべきComponentやSafe Markdown Rendererへ追加すべきComponentはありません。

### Raw HTML、Link、Image

Raw HTML、iframe、script、style、HTML tableはありません。Markdown Image、JSX Image、Next.js `Image`、相対画像、外部画像もなく、画像ファイルの移設や参照書き換えは不要です。

`split-the-g`の日英本文はそれぞれ次のLinkを持ちます。

- Guinness StorehouseのHTTPS Link 2件
- Irish Pub Mapのルート`/`への内部Link 1件

Guide間Linkや`/map` Linkはありません。すべてSafe Markdown Rendererの許可規則であるHTTP(S)またはルート相対URLに該当し、危険なURL Scheme、protocol-relative URL、Component経由のLinkはありません。既存Linkは文字列を変更せず移行できます。

## Safe Markdown Rendererとの互換性

| 現在使用する表現         | 対象          | Renderer対応                                          | 必要な対応     |
| ------------------------ | ------------- | ----------------------------------------------------- | -------------- |
| Paragraph                | 全ファイル    | 対応済み                                              | なし           |
| `##` / `###` Heading     | `split-the-g` | 対応済み。公開画面の見出し階層に合わせて1段下げて描画 | Markdownを維持 |
| Ordered / Unordered List | `split-the-g` | 対応済み                                              | なし           |
| HTTPS Link               | `split-the-g` | 対応済み、URL検証対象                                 | URLを維持      |
| ルート相対Link `/`       | `split-the-g` | 対応済み、URL検証対象                                 | URLを維持      |

現行Guideの移行に必要なRenderer拡張はありません。Safe Markdown RendererはRaw HTMLを無視し、許可要素に`img`を含めていませんが、現行Guideはどちらも使用していないため今回の移行を妨げません。

## MetadataのDB対応

| MDX値 | 移行先 | 変換・注意点 |
| --- | --- | --- |
| `slug` | `content_entries.slug` | 値を維持する |
| `kind` | `content_entries.kind` | 全件`guide`として保存する |
| `category` | `content_entries.category` | 値を維持する |
| `publishedAt` | `content_entries.published_at` | `YYYY-MM-DD`をTIMESTAMPTZへ変換する規則をMigrationで固定する。現行表示はUTC 00:00を基準に日付化している |
| 公開済みであること | `content_entries.status` | 全件`published`として投入する |
| `title` | `content_translations.title` | localeごとに保存する |
| `summary` | `content_translations.summary` | localeごとに保存する |
| metadata以降の本文 | `content_translations.body_markdown` | 先頭のexport blockと直後の区切り空行を除き、本文を改変せず保存する |
| locale | `content_translations.locale` | pathの`ja` / `en`を使用する |
| `tags` | 対応するEditorial Content列・関連テーブルなし | 後続Migrationで扱いを決める。暗黙に別用途の`tags` / `pub_tags`へ保存しない |
| MDXに存在しないID | `content_entries.id` | MigrationでUUIDを生成する |
| MDXに存在しない作成・更新日時 | `created_at` / `updated_at` | Migration実行時刻または明示した固定方針を使用する |

現行の`tags`と`pub_tags`は店舗用で、Editorial Contentとの関連を表せません。また、Legacy Guideの一覧・詳細UIはmetadataの`tags`を表示していません。後続Issue #380では、現在未使用であることを根拠に移行対象外とするか、Editorial Content用のデータ構造を別途設計するかを明示的に決定する必要があります。

`apps/web/content/README.md`にはmetadataのRuntime ValidationとStable Tag IDについて記載がありますが、現在の`legacy-repository.ts`は`slug`、`kind`、`title`、`summary`、`category`、`publishedAt`を型として受け取り、読み込み後のruntime validationは行っていません。MDXにある`tags`もloaderの戻り値型や公開UIでは利用されません。MigrationはREADMEの説明に依存せず、上表の実装と実データを入力契約として検証してください。この文書上のタグ値は実値どおりの文字列keyであり、UUIDではありません。

## Guide別の移行判断

### `sample`: Level B

日英とも本文はParagraphだけで、そのまま`body_markdown`へ保存できます。必要な変換はmetadata exportの抽出・削除だけです。Link、Image、JSX、Raw HTML、Component依存はありません。

後続Migrationでは、サンプルコンテンツを本番公開データとして維持するかを投入前に確認します。投入する場合は既存URL `/discover/guides/sample`を維持します。

### `split-the-g`: Level B

日英とも本文は標準Markdownだけで、そのまま`body_markdown`へ保存できます。必要な変換はmetadata exportの抽出・削除だけです。Heading、List、HTTPS Link、ルート相対Linkは現在のSafe Markdown Rendererで表現できます。

既存URL `/discover/guides/split-the-g`と本文中の`/` Linkを維持します。外部Linkも書き換え不要です。

## 後続Issueの実施事項

Issue #380のMigrationでは、少なくとも次を実施します。

1. 対象slugをこの文書の2件へ固定し、Request値やDB値からMDXをdynamic importしない。
2. 4ファイルすべてについてmetadataと本文を抽出し、日英のmetadata整合性をMigration前に検証する。
3. `publishedAt`の日付からTIMESTAMPTZへの変換規則を固定し、公開日の表示が変わらないことを検証する。
4. `tags`を移行対象外とするか、Editorial Content用の構造を設計するかを決定して記録する。
5. 同じMigrationを再実行した場合の扱いを決め、`(kind, slug)`の重複を防ぐ。
6. title、summary、bodyの文字列とLink URLが移行前後で一致することを検証する。
7. `sample`を公開データとして投入するかを決定する。
8. Production投入前にPreview環境でMigrationとverify SQLを実行する。

Issue #381で公開取得元をNeonへ切り替える際は、`/discover`の一覧と既存詳細URL2件、locale別title / summary / body、公開日、見出し階層、内部・外部Linkを確認します。Issue #382で固定loader、Registry、MDXを整理するのは、Neon切替とURL互換性の確認後です。

## 再棚卸し条件

この結果は上記基準commitのsnapshotです。Issue #380着手までに`.mdx`、`guideLoaders`、`contentRegistry.guide`のいずれかが変更された場合は、対象数、locale対応、依存表、Migration Levelを再確認します。
