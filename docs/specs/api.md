# API 方針

## 現状

Next.js Route Handler で公開 API と管理 API を提供します。公開画面はサーバー側から API 経由で店舗データを取得します。`DATABASE_URL` が設定されている環境ではNeonを読み書きし、未設定時は空の店舗一覧を返します。

## 公開 API

### `GET /api/pubs`

公開状態の店舗一覧だけを返します。Repositoryが `pubs.is_published = TRUE` をSQLで絞り込み、`isPublished` 自体は公開レスポンスへ含めません。`locale` には `ja` または `en` を指定できます。指定ロケールの翻訳を優先し、未登録の表示文字列は日本語（`ja`）へフォールバックします。レスポンスは `packages/shared` の `Pub` 型に合わせ、API 側で `asPubs` による検証を行います。

レスポンス例:

```json
{
  "pubs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Example Pub",
      "prefecture": "東京都",
      "address": "東京都...",
      "latitude": 35.681,
      "longitude": 139.767,
      "websiteUrl": null,
      "googleMapsUrl": null,
      "instagramUrl": null,
      "tags": ["guinness"],
      "tagDisplayNames": { "guinness": "Guinness" },
      "status": "open",
      "statusDisplayName": "Open"
    }
  ]
}
```

## API key

`IRISHPUB_MAP_API_KEY` が設定されている環境では、API リクエストに `x-api-key` ヘッダーが必要です。値が一致しない場合は `401` を返します。Vercel の Production では環境変数自体も必須で、未設定の場合はデプロイ時の検証に失敗し、実行時も `503` を返します。

```bash
curl -H "x-api-key: $IRISHPUB_MAP_API_KEY" http://localhost:3000/api/pubs
```

ローカル開発と Preview で `IRISHPUB_MAP_API_KEY` が未設定の場合、API key チェックは無効です。設定した場合はローカルと Preview でも `x-api-key` を検証します。Production では Vercel の Environment Variables に必ず `IRISHPUB_MAP_API_KEY` を設定します。

Vercel の `VERCEL_ENV=production` を使って Production を判定します。`vercel.json` の build command で `npm run validate:production-env` を実行するため、Production の設定漏れはデプロイ時に検出されます。API キーの実値はエラーメッセージ、レスポンス、ログへ出力しません。

Web アプリのトップページはサーバー側で `/api/pubs` を fetch します。API key はサーバー側のヘッダーとして付与され、ブラウザには露出しません。

Vercel Preview Deployment Protection を有効にしている場合は、`VERCEL_AUTOMATION_BYPASS_SECRET` に Protection Bypass for Automation secret を設定してください。設定されている場合、サーバー側 fetch は `x-vercel-protection-bypass` ヘッダーを送信します。未設定でSSOへリダイレクトされた場合、トップページは静的データを複製せず店舗0件で表示します。実データを表示するには、SSOを回避できる設定とDATABASE_URLの両方を適切に構成してください。

検索・絞り込みは、取得済みの店舗データに対してブラウザで実行します。そのため `prefecture` や `query` のクエリパラメーターは現在の公開 API では受け付けません。

## 管理 API

管理 API は有効な管理者セッション Cookie を必要とします。ログイン用の環境変数が未設定の場合、ログイン API は `503` を返します。`DATABASE_URL` が未設定の場合、管理画面での一覧取得はできますが、更新系 API は `503` を返します。

失敗レスポンスは表示文言ではなく、安定した `errorCode` を返します。管理画面のClientが現在のlocaleに応じて日本語または英語へ翻訳します。Validationでは必要に応じてフィールド別の理由コード、公開条件不足では `missingFields` も返します。

```json
{ "errorCode": "invalid_credentials" }
```

```json
{
  "errorCode": "validation_error",
  "fieldErrors": { "key": "invalid_format" }
}
```

共通コードは `unauthorized`、`forbidden`、`invalid_json`、`invalid_content_type`、`database_unavailable`、`internal_error` です。ログイン、店舗、タグ、マスタ固有のコードには `invalid_credentials`、`auth_not_configured`、`invalid_pub_data`、`pub_not_found`、`publication_requirements_not_met`、`tag_conflict`、`tag_not_found`、`tag_in_use`、`invalid_tag_id`、`invalid_prefecture_code` があります。フィールド理由は `required`、`too_long`、`invalid_format`、`invalid_type`、`leading_or_trailing_space`、`immutable` です。未知のコードやJSONでないレスポンスはClientで一般化し、APIは例外文、DB・SQL・接続情報を返しません。HTTPステータスは従来どおり、認証 `401`、権限 `403`、入力 `400` / `415` / `422`、対象なし `404`、競合 `409`、設定不足 `503`、内部エラー `500` を使います。

営業ステータス管理固有のコードは、不正なURLパラメーターの `invalid_status_code` と、更新対象が存在しない `status_not_found` です。

| メソッド | パス | 成功時 | 主な失敗時 |
| --- | --- | --- | --- |
| `POST` | `/api/admin/login` | `200` と `Set-Cookie` | Origin不正は `403`、資格情報不一致は `401`、管理者設定なしは `503` |
| `POST` | `/api/admin/logout` | `200` と期限切れの Cookie | Origin不正は `403` |
| `GET` | `/api/admin/pubs` | `200` と `{ pubs, total, page, pageSize, databaseConfigured }`。各店舗に `isPublished`、マスタ識別子、タグ、更新日時を含む | 未認証は `401`、Query不正は `400` |
| `GET` | `/api/admin/master/prefectures` | `200` と `{ prefectures }` | 未認証は `401`、取得失敗は `500` |
| `GET` | `/api/admin/master/municipalities?prefectureCode=:code` | `200` と `{ municipalities }` | 未認証は `401`、都道府県コード不正は `400`、取得失敗は `500` |
| `GET` | `/api/admin/master/tags` | `200` と `{ tags }` | 未認証は `401`、取得失敗は `500` |
| `GET` | `/api/admin/tags` | `200` と `{ tags, databaseConfigured }`。日英表示名と使用店舗数を含む | 未認証は `401`、取得失敗は `500` |
| `POST` | `/api/admin/tags` | `201` と `{ tag }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、入力不正は `422`、重複は `409`、DB未設定は `503` |
| `PATCH` | `/api/admin/tags/:id` | `200` と `{ tag }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、ID不正は `400`、対象なしは `404`、重複は `409`、Content-Type不正は `415`、入力不正は `422`、DB未設定は `503` |
| `DELETE` | `/api/admin/tags/:id` | `200` と `{ ok: true }` | 未認証は `401`、Origin不正は `403`、ID不正は `400`、対象なしは `404`、使用中は `409`、DB未設定は `503` |
| `GET` | `/api/admin/master/statuses` | `200` と `{ statuses }` | 未認証は `401`、取得失敗は `500` |
| `GET` | `/api/admin/statuses` | `200` と `{ statuses, databaseConfigured }`。固定keyと日英表示名を含む | 未認証は `401`、取得失敗は `500` |
| `PATCH` | `/api/admin/statuses/:code` | `200` と `{ status }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、code不正は `400`、入力不正は `422`、対象なしは `404`、DB未設定は `503` |
| `POST` | `/api/admin/pubs` | `201` と非公開の `{ pub }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、入力不正は `422`、参照競合は `409`、DB未設定は `503` |
| `GET` | `/api/admin/pubs/:id` | `200` とNULL・日英翻訳・タグIDを含む `{ pub }` | 未認証は `401`、ID不正は `400`、対象なしは `404`、DB未設定は `503` |
| `PUT` | `/api/admin/pubs/:id` | `200` と公開状態を維持した `{ pub }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、入力不正・公開条件不足は `422`、参照競合は `409`、対象なしは `404`、DB未設定は `503` |
| `PATCH` | `/api/admin/pubs/:id/publication` | `200` と `{ publication: { id, isPublished, unchanged } }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、入力不正・公開条件不足は `422`、対象なしは `404`、DB未設定は `503` |
| `DELETE` | `/api/admin/pubs/:id` | `200` と `{ ok: true }` | 未認証は `401`、Origin不正は `403`、対象なしは `404`、DB 未設定は `503` |

`POST` と `PUT` は、`prefectureCode`、`municipalityCode`、座標、URL、`status`、`translations: { ja, en }`、`tagIds` を含む管理用全体スナップショットを受け付けます。日本語店舗名だけが下書きの必須項目で、その他の未入力値はNULL、英語翻訳なしは `translations.en = null`、タグ全解除は `tagIds = []` とします。`id`、`isPublished`、`updatedAt` は入力に含めません。新規IDはサーバーで生成し、常に非公開で作成します。

管理店舗一覧は1ページ50件です。`name`、`prefecture`、`municipality`、`status`、`tag`、`published`、`page` をQuery Parameterとして受け付け、指定条件をANDで適用します。店舗名は日本語名の部分一致、都道府県は1〜47、市区町村は選択都道府県に所属する6桁コード、タグはUUID、公開状態は `true` / `false` だけを受け付けます。すべての値はパラメータ化クエリへ渡し、外部入力からSQL文字列を組み立てません。一覧APIは最終ページを超えた場合も絞り込み後の `total` を保持して `pubs` を空配列で返し、管理画面 `/admin/pubs` はその結果から最後の有効ページを求め、絞り込み条件を維持してリダイレクトします。

公開状態変更本文は `{ "isPublished": true | false }` だけを受け付けます。現在値と対象存在を確認し、同じ状態への要求は `unchanged: true` として更新しません。非公開化に公開条件は適用しません。公開時は日本語店舗名・住所、都道府県、市区町村と所属関係、緯度、経度、営業ステータス、および各日本語表示名をサーバー側で再検証します。不足時は更新せず、`publication_requirements_not_met` と `missingFields` を `422` で返します。

タグ管理APIの入力、transaction、使用中削除拒否は[管理タグ仕様](tag-management.md)を参照してください。作成時は `key` と必須の `nameJa`、任意の `nameEn` を受け付け、更新時は `nameJa` と `nameEn` だけを受け付けます。

営業ステータス管理APIの固定key、日英表示名、transaction更新は[管理ステータス仕様](status-management.md)を参照してください。更新本文は必須の `nameJa` と任意の `nameEn` だけを利用し、余分な `key` は更新対象にしません。

参照マスタAPIはDB行を直接返さず、`packages/shared/src/admin-master.ts` のDTOへ変換します。都道府県は `{ code, name }`、市区町村は `{ code, prefectureCode, name }`、タグは `{ id, key, name }`、営業ステータスは `{ code, key, name }` です。表示名は日本語を既定とし、日本語へフォールバックします。画面操作で再取得する市区町村APIと管理店舗一覧APIは、言語Cookieを優先し、未指定時は `Accept-Language` から表示ロケールを決定します。`prefectureCode` は1〜47の10進整数だけを受け付け、DBクエリへパラメータとして渡します。

管理APIは共通認証ヘルパーで、管理者設定が揃い、有効な署名済みセッションを持つリクエストだけを許可します。変更系リクエストは共通の同一Origin検証も通し、`Origin` の欠落・不一致を `403` で拒否します。現行は単一管理者モデルのため、このセッションを管理権限として扱います。Repositoryの例外時はDB・SQL・接続情報を含まない一般化したエラーを返します。

Issue #273では公開状態と公開取得を、Issue #274では管理認証と同一Origin検証を、Issue #275ではタグ管理を実装しました。Issue #277では管理一覧と公開切替を追加し、Issue #278ではNULL許容の管理DTO、詳細取得、作成・通常更新・削除、参照検証、複数テーブルtransactionを追加しました。Issue #286では管理APIのエラーをコード化し、Client側の日英翻訳へ統一しました。確定した契約は[管理店舗の下書き・公開設計](admin-pub-lifecycle.md)を参照してください。

## 今後の拡張候補

- `GET /api/pubs/:id`: 店舗詳細を返す
- モバイルアプリからの API 利用

## 注意点

- API を追加・変更する場合でも、`packages/shared` の型と検証を優先して使います。
- 秘密値はリポジトリにコミットしません。
- Google Maps など有料 API へ切り替える場合は、料金と利用制限を確認してから実装します。
