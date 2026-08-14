# 店舗データ仕様

## 概要

型定義と検証ロジックは `packages/shared/src/pub.ts` にあります。
Neon Postgres のテーブル、カラム、JSONB 構造、ER 図は[データベース定義書](database.md)を参照してください。

`data/pubs.json` は初期データとフォールバックです。`DATABASE_URL` が未設定の環境では公開 API と管理画面の表示に同ファイルを使います。Neon を設定した環境では、テーブルが空の場合に同ファイルを初期投入し、その後の管理画面による追加・編集・削除は Neon の `pubs` テーブルへ保存します。

読み出した配列は `asPubs` で検証します。配列以外、必須項目の欠落、不正な緯度経度、重複した `id`、未定義の `status` を含むデータは受け付けません。

## データ形式

```json
{
  "id": "tokyo-dubliners-shinjuku",
  "name": "The Dubliners' Irish Pub Shinjuku",
  "kana": "ざだぶりなーず あいりっしゅぱぶ しんじゅく",
  "prefecture": "東京都",
  "city": "新宿区",
  "address": "東京都新宿区...",
  "latitude": 35.0,
  "longitude": 139.0,
  "websiteUrl": "https://example.com",
  "googleMapsUrl": "https://maps.google.com/...",
  "instagramUrl": null,
  "tags": ["guinness", "live-music", "food"],
  "status": "unknown"
}
```

## フィールド

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `id` | string | yes | 店舗を一意に識別する ID |
| `name` | string | yes | 店舗名 |
| `kana` | string | no | 店舗名の読み（ひらがな）。かな検索に使用 |
| `prefecture` | string | yes | 都道府県 |
| `city` | string | no | 市区町村 |
| `address` | string | yes | 住所 |
| `latitude` | number | yes | 緯度 |
| `longitude` | number | yes | 経度 |
| `websiteUrl` | string \| null | no | 公式サイト URL |
| `googleMapsUrl` | string \| null | no | Google Maps URL |
| `instagramUrl` | string \| null | no | Instagram URL |
| `tags` | string[] | yes | 検索・絞り込み用タグ |
| `status` | string | yes | 店舗状態 |

## `status`

現在利用できる値:

- `open`
- `temporarily_closed`
- `closed`
- `unknown`

## 管理画面からの更新

- 新規作成時の `id` はサーバーが UUID を発行します。
- 更新時は URL に指定した `id` を維持します。
- 作成、更新、削除には `DATABASE_URL` と有効な管理者セッションが必要です。
- `city` と各 URL 項目は省略または `null` にできます。`tags` は文字列の配列です。

## 運用メモ

- Web とモバイルで同じデータ形式を使えるように維持します。
- 店舗データを追加する場合は、重複しない `id` を付けます。
- 緯度経度は地図表示に使うため、数値で管理します。
