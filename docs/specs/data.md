# 店舗データ仕様

## 概要

店舗データは `data/pubs.json` で管理します。
型定義と最低限の検証ロジックは `packages/shared/src/pub.ts` にあります。

## データ形式

```json
{
  "id": "tokyo-dubliners-shinjuku",
  "name": "The Dubliners' Irish Pub Shinjuku",
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

## 運用メモ

- Web とモバイルで同じデータ形式を使えるように維持します。
- 店舗データを追加する場合は、重複しない `id` を付けます。
- 緯度経度は地図表示に使うため、数値で管理します。
