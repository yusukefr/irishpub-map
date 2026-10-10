# 店舗データ仕様

## 概要

公開APIとWebは `packages/shared/src/pub.ts` の共有 `Pub` 型を使用します。管理画面と管理APIは `packages/shared/src/admin-pub.ts` のDTOと入力型を使用します。永続化時は、言語に依存しない属性を `pubs`、表示文言を各翻訳テーブル、タグを `tags` と `pub_tags` に分けて保存します。DB構成は[データベース定義書](database.md)、カラムと制約は[生成済みスキーマ](../generated/database-schema.md)を参照してください。

店舗データはNeon Postgresを正とします。`DATABASE_URL` が未設定の環境では公開APIと管理画面は空の店舗一覧を表示し、更新操作は利用できません。

公開用の `Pub` は公開条件を満たす表示データを表し、公開APIは公開状態そのものを含めません。Pub Typeは `irish` / `british` / `other` / `unclassified` の単一値を持ち、Gastropub等の特徴はタグで表します。管理一覧は未完成の下書きを表現できる `AdminPubListItem`、管理詳細は日英翻訳とタグIDを含む `AdminPub` を返します。作成・更新は公開状態を含まない `AdminPubWriteInput`、公開状態の変更は `SetAdminPubPublicationInput` を使用します。正確な型定義とValidationは `packages/shared/src/pub.ts` および `packages/shared/src/admin-pub.ts` を正とし、業務ルールは[管理店舗の下書き・公開設計](admin-pub-lifecycle.md)を参照してください。

`@irishpub-map/shared` は `Pub` / `PubStatus` / `PubType`、`asPubs`、`Locale` / `SUPPORTED_LOCALES` / `DEFAULT_LOCALE` / `isSupportedLocale` を公開します。サブパス `@irishpub-map/shared/pub` と `@irishpub-map/shared/locale` からも対応する型・関数をimportできます。Public APIの `locale` は現在 `ja` と `en` のみで、既定は `ja` です。

管理画面の選択肢は `packages/shared/src/admin-master.ts` の `PrefectureOption`、`MunicipalityOption`、`TagOption`、`PubStatusOption` を使用します。これらは表示に必要なコード・ID・内部キー・表示名だけを持ち、DBの行や監査用カラムをそのまま公開しません。

既知のタグキーと標準表示名は [`packages/shared/src/tag-definitions.json`](../../packages/shared/src/tag-definitions.json) をSource of Truthとし、一覧を仕様書へ複製しません。

## APIデータ形式

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "The Dubliners' Irish Pub Shinjuku",
  "prefecture": "東京都",
  "address": "東京都新宿区...",
  "latitude": 35.681,
  "longitude": 139.767,
  "websiteUrl": null,
  "googleMapsUrl": null,
  "instagramUrl": null,
  "tags": ["guinness"],
  "tagDisplayNames": { "guinness": "ギネス" },
  "status": "open",
  "statusDisplayName": "営業中",
  "pubType": "irish",
  "pubTypeDisplayName": "アイリッシュパブ"
}
```

## フィールド

| フィールド | 型 | 必須 | DBでの取得元・説明 |
| --- | --- | --- | --- |
| `id` | string | yes | `pubs.id`。RFC 9562 variantのUUID version 1〜8 |
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
| `tagDisplayNames` | Record<string, string> | no | 内部キーを選択ロケール優先、日本語フォールバックの `tag_translations.name` へ対応付けた値 |
| `status` | `PubStatus` | yes | `pubs.status_code` に対応する共有営業状況値 |
| `statusDisplayName` | string | no | 選択ロケール優先、日本語フォールバックの `pub_status_translations.display_name` |
| `pubType` | `irish` \| `british` \| `other` \| `unclassified` | yes | `pub_types.key`。未確認の既存公開店は `unclassified` |
| `pubTypeDisplayName` | string | no | 選択ロケール優先、日本語フォールバックの種別名 |

`kana`、`city`、`municipalityCode`、`tagDisplayNames`、`statusDisplayName`、`pubTypeDisplayName` は共有型でoptionalです。現在のRepositoryと `asPubs` は空のoptional文字列を省き、JSON化では値のないoptional fieldが省略されます。URL 3項目はTypeScript型でoptionalかつnullableで、現在の公開データでは値がなければ `null` を返します。`latitude`、`longitude`、`address` は公開DTOで必須ですが、物理DB列がnullableな項目があります。公開前のApplication Validationで必須条件を確認し、読出し時にDTOを検証します。

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

- 公開用データの読み出しは `asPubs` で検証します。IDはUUID、name / prefecture / addressは空でない文字列、latitudeは有限数の−90〜90、longitudeは有限数の−180〜180、URLはHTTP(S)、status / pubTypeは定義済み値である必要があります。タグは文字列配列で、重複IDや不正データは受け付けません。optional文字列はtrim・空文字除去、タグは共有正規化関数で正規化します。
- 管理画面・管理APIの作成・更新入力には `AdminPubWriteInput` を使用します。
- 新規作成時の `id` はApplication ServiceがUUIDを発行し、更新時はURLで指定された既存IDを維持します。
- `prefectureCode`、`municipalityCode`、`status`、`tagIds` は保存前にDB上のマスタと照合します。市区町村については指定された都道府県への所属も検証します。
- 日本語翻訳は必須として `pub_translations` に保存し、英語翻訳は任意で保存します。英語翻訳が `null` の場合は既存の英語翻訳を削除します。
- タグは既存のタグIDを受け取り、`pub_tags` のrelationとして保存します。`tagIds = []` の場合は店舗のタグrelationをすべて解除します。
- 店舗本体、翻訳、タグrelationの作成・更新は単一transactionで処理します。
- URL項目は未入力を `null` に正規化し、HTTP(S)、2,048文字以内、URL内ユーザー情報なし、制御文字なしを検証します。公式サイトは任意ホスト、Google Mapsは `www.google.com/maps/...`・`google.com/maps/...`・`maps.google.com/...`・`maps.app.goo.gl/<code>`、Instagramはプロフィール・`/p/<id>`・`/reel/<id>` のみを受け付けます。URLへのHTTPアクセスやリダイレクト追跡はしません。
- 住所は前後空白を除去し、制御文字を拒否して300文字以内とします。Draftの日本語住所は任意ですが公開時は必須です。英語翻訳を登録する場合は英語住所を必須とします。
- 削除時は店舗を削除し、店舗翻訳と `pub_tags` は外部キーのCASCADEにより削除します。

## 運用

管理API経由の新規店舗はApplication側で `is_published = FALSE` を明示して非公開で作成します。別系統の運用用インポートとして `scripts/import-pubs.mjs` も利用できます。インポート処理では `is_published` を明示せず、`pubs.is_published` のDB既定値により非公開で作成します。一括投入は既存UUIDを更新せずスキップします。リポジトリには店舗データのスナップショットを保存しません。
