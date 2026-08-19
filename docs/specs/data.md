# 店舗データ仕様

## 概要

DBでは都道府県を prefectures.code、営業状況を pub_statuses.code、タグを pub_tags の複数行、市区町村コードを municipality_codes のマスタとして保存します。公開APIはNeonの店舗データを返し、市区町村名から `municipalityCode` を解決できた場合に付加します。

型定義と検証ロジックは `packages/shared/src/pub.ts` にあります。Neon Postgres の項目別カラム、制約、インデックスは[項目別カラムの定義](database-columns.md)を参照してください。既存 DB の移行は[移行手順](../operations/database-migration.md)に従います。

店舗データはNeonの `pubs` テーブルを正とします。`DATABASE_URL` が未設定の環境では公開APIと管理画面は空の店舗一覧を表示し、更新操作は利用できません。新規データは管理画面または一括インポート手順でNeonへ投入します。

読み出した配列は `asPubs` で検証します。配列以外、必須項目の欠落、不正な緯度経度、重複した `id`、未定義の `status` を含むデータは受け付けません。タグは `packages/shared/src/tag-definitions.json` の内部キーへ正規化し、店舗内の重複を除去します。詳細は [タグの正規化仕様](tag-normalization.md) を参照してください。

## データ形式

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
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

| フィールド         | 型             | 必須 | 説明                                      |
| ------------------ | -------------- | ---- | ----------------------------------------- |
| `id`               | string         | yes  | 店舗を一意に識別するRFC 4122 UUID         |
| `name`             | string         | yes  | 店舗名                                    |
| `kana`             | string         | no   | 店舗名の読み（ひらがな）。かな検索に使用  |
| `prefecture`       | string         | yes  | DB登録時は共有定義の47都道府県名に限定    |
| `city`             | string         | no   | 市区町村                                  |
| `municipalityCode` | string or null | no   | 市区町村マスタから解決した6桁の団体コード |
| `address`          | string         | yes  | 住所                                      |
| `latitude`         | number         | yes  | 緯度                                      |
| `longitude`        | number         | yes  | 経度                                      |
| `websiteUrl`       | string \| null | no   | HTTP(S)の公式サイト URL                   |
| `googleMapsUrl`    | string \| null | no   | HTTP(S)のGoogle Maps URL                  |
| `instagramUrl`     | string \| null | no   | HTTP(S)のInstagram URL                    |
| `tags`             | string[]       | yes  | 検索・絞り込み用タグ                      |
| `status`           | string         | yes  | 店舗状態                                  |

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
- `municipalityCode` は保存せず、読み出し時に `prefecture` と `city` に一致する市区町村マスタから付加します。

## 運用メモ

- Web とモバイルで同じデータ形式を使えるように維持します。
- 店舗データを追加する場合は、重複しない `id` を付けます。
- 緯度経度は地図表示に使うため、数値で管理します。
