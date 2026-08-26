# 店舗データ仕様

## 概要

公開API、Web、管理画面は `packages/shared/src/pub.ts` の共有 `Pub` 型を使用します。永続化時は、言語に依存しない属性を `pubs`、表示文言を各翻訳テーブル、タグを `tags` と `pub_tags` に分けて保存します。DB構成は[データベース定義書](database.md)、カラムと制約は[テーブル・カラム定義](database-columns.md)を参照してください。

店舗データはNeon Postgresを正とします。`DATABASE_URL` が未設定の環境では公開APIと管理画面は空の店舗一覧を表示し、更新操作は利用できません。

この文書の `Pub` は現行の公開・表示用データ形式です。親Issue #264の管理画面改修では、未完成の下書きをこの型へ混在させず、公開用 `PublicPub`、管理用 `AdminPub`、作成・更新入力を分離します。確定した後続設計は[管理店舗の下書き・公開設計](admin-pub-lifecycle.md)を参照してください。

## APIデータ形式

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "The Dubliners' Irish Pub Shinjuku",
  "kana": "ざだぶりなーず あいりっしゅぱぶ しんじゅく",
  "prefecture": "東京都",
  "city": "新宿区",
  "municipalityCode": "131041",
  "address": "東京都新宿区...",
  "latitude": 35.0,
  "longitude": 139.0,
  "websiteUrl": "https://example.com",
  "googleMapsUrl": "https://maps.google.com/...",
  "instagramUrl": null,
  "tags": ["guinness", "live-music", "food"],
  "tagDisplayNames": {
    "guinness": "ギネス",
    "live-music": "ライブ音楽",
    "food": "食事あり"
  },
  "status": "open",
  "statusDisplayName": "営業中"
}
```

## フィールド

| フィールド | 型 | 必須 | DBでの取得元・説明 |
| --- | --- | --- | --- |
| `id` | string | yes | `pubs.id`。RFC 4122 UUID |
| `name` | string | yes | 選択ロケールの `pub_translations.name` |
| `kana` | string \| null | no | 選択ロケールの `pub_translations.name_reading` |
| `prefecture` | string | yes | 選択ロケールの `prefecture_translations.name` |
| `city` | string \| null | no | 選択ロケールの `municipality_translations.name` |
| `municipalityCode` | string \| null | no | `pubs.municipality_code`。有効な場合は数字6桁 |
| `address` | string | yes | 選択ロケールの `pub_translations.address` |
| `latitude` | number | yes | `pubs.latitude` |
| `longitude` | number | yes | `pubs.longitude` |
| `websiteUrl` | string \| null | no | `pubs.website_url`。HTTP(S) URL |
| `googleMapsUrl` | string \| null | no | `pubs.google_maps_url`。HTTP(S) URL |
| `instagramUrl` | string \| null | no | `pubs.instagram_url`。HTTP(S) URL |
| `tags` | string[] | yes | `pub_tags` で関連付く `tags.key` |
| `tagDisplayNames` | Record<string, string> | no | 内部キーを選択ロケールの `tag_translations.name` へ対応付けた値 |
| `status` | string | yes | `pubs.status_code` に対応する共有営業状況値 |
| `statusDisplayName` | string | no | 選択ロケールの `pub_status_translations.display_name` |

## ロケール

一覧取得では要求ロケールの翻訳を優先し、登録がない場合は日本語（`ja`）へフォールバックします。店舗、都道府県、市区町村、営業状況、タグは同じ優先順位で選択します。言語に依存しないID、コード、緯度経度、URL、タグ関係はロケールによって変わりません。

## 営業状況

共有 `Pub` 型で利用できる値は次の4つです。

- `open`
- `temporarily_closed`
- `closed`
- `unknown`

DBでは数値の `pubs.status_code` と `pub_statuses.code` で関連付け、内部キーを `pub_statuses.key`、表示名を `pub_status_translations.display_name` に保存します。

## 検証と保存

- 読み出した店舗は `asPubs` で検証します。必須項目の欠落、不正な緯度経度、重複ID、未定義の営業状況を含む値は受け付けません。
- 新規作成時の `id` はサーバーがUUIDを発行します。更新時はURLに指定した `id` を維持します。
- 作成・更新では日本語の市区町村名を `municipality_translations` から一意に解決し、`pubs.municipality_code` に保存します。解決できない場合はエラーにします。
- 店舗名、読み、住所の作成・更新は、日本語の `pub_translations` へ保存します。
- タグは共有定義で正規化・重複排除し、`tags`、`tag_translations`、`pub_tags` へ保存します。
- URL項目は省略または `null` にできます。DB制約はHTTP(S) URLだけを許可します。
- 削除時は、店舗翻訳と店舗・タグ関係が外部キーによってカスケード削除されます。

## 運用

新規データは管理画面または `scripts/import-pubs.mjs` でNeonへ投入します。一括投入は既存UUIDを更新せずスキップします。リポジトリには店舗データのスナップショットを保存しません。
