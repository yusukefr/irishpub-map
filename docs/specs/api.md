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

| メソッド | パス | 成功時 | 主な失敗時 |
| --- | --- | --- | --- |
| `POST` | `/api/admin/login` | `200` と `Set-Cookie` | 資格情報不一致は `401`、管理者設定なしは `503` |
| `POST` | `/api/admin/logout` | `200` と期限切れの Cookie | なし |
| `GET` | `/api/admin/pubs` | `200` と `{ pubs, databaseConfigured }`。各店舗に `isPublished` を含む | 未認証は `401` |
| `GET` | `/api/admin/master/prefectures` | `200` と `{ prefectures }` | 未認証は `401`、取得失敗は `500` |
| `GET` | `/api/admin/master/municipalities?prefectureCode=:code` | `200` と `{ municipalities }` | 未認証は `401`、都道府県コード不正は `400`、取得失敗は `500` |
| `GET` | `/api/admin/master/tags` | `200` と `{ tags }` | 未認証は `401`、取得失敗は `500` |
| `GET` | `/api/admin/master/statuses` | `200` と `{ statuses }` | 未認証は `401`、取得失敗は `500` |
| `POST` | `/api/admin/pubs` | `201` と `{ pub }`。`pub` に `isPublished` を含む | 未認証は `401`、不正データは `400`、DB 未設定は `503` |
| `PUT` | `/api/admin/pubs/:id` | `200` と `{ pub }`。`pub` に `isPublished` を含む | 未認証は `401`、不正データは `400`、対象なしは `404`、DB 未設定は `503` |
| `DELETE` | `/api/admin/pubs/:id` | `200` と `{ ok: true }` | 未認証は `401`、対象なしは `404`、DB 未設定は `503` |

`POST` と `PUT` の JSON 本文は `Pub` と同じフィールドを使います。公開状態は入力に含めず、新規作成時の `id` はサーバーで生成され、DB既定値により非公開になります。更新時は URL の `:id` が使われます。フィールドの詳細は[店舗データ仕様](data.md)を参照してください。

参照マスタAPIはDB行を直接返さず、`packages/shared/src/admin-master.ts` のDTOへ変換します。都道府県は `{ code, name }`、市区町村は `{ code, prefectureCode, name }`、タグは `{ id, key, name }`、営業ステータスは `{ code, key, name }` です。表示名は日本語を既定とし、Repositoryは将来のロケール指定に備えて日本語フォールバックを持ちます。`prefectureCode` は1〜47の10進整数だけを受け付け、DBクエリへパラメータとして渡します。

管理APIは共通認証ヘルパーで、管理者設定が揃い、有効な署名済みセッションを持つリクエストだけを許可します。現行は単一管理者モデルのため、このセッションを管理権限として扱います。Repositoryの例外時はDB・SQL・接続情報を含まない一般化したエラーを返します。

Issue #273では取得Repositoryを公開用と管理用へ分離し、管理一覧の現行 `Pub` に `isPublished` を追加しました。親Issue #264の後続改修で、NULL許容の管理用DTO、公開切替専用API、同一Origin検証、構造化Validationエラーを追加します。確定した契約は[管理店舗の下書き・公開設計](admin-pub-lifecycle.md)を参照してください。

## 今後の拡張候補

- `GET /api/pubs/:id`: 店舗詳細を返す
- モバイルアプリからの API 利用

## 注意点

- API を追加・変更する場合でも、`packages/shared` の型と検証を優先して使います。
- 秘密値はリポジトリにコミットしません。
- Google Maps など有料 API へ切り替える場合は、料金と利用制限を確認してから実装します。
