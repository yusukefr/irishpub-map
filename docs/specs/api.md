# API 方針

## 現状

Next.js Route Handler で公開 API と管理 API を提供します。公開画面はサーバー側から API 経由で店舗データを取得します。`DATABASE_URL` が設定されている環境では Neon を読み書きし、未設定時は `data/pubs.json` をフォールバックとして使います。

## 公開 API

### `GET /api/pubs`

店舗一覧を返します。レスポンスは `packages/shared` の `Pub` 型に合わせ、API 側で `asPubs` による検証を行います。

レスポンス例:

```json
{
  "pubs": [
    {
      "id": "example-pub",
      "name": "Example Pub",
      "prefecture": "東京都",
      "address": "東京都...",
      "latitude": 35.681,
      "longitude": 139.767,
      "websiteUrl": null,
      "googleMapsUrl": null,
      "instagramUrl": null,
      "tags": ["guinness"],
      "status": "open"
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

Vercel Preview Deployment Protection を有効にしている場合は、`VERCEL_AUTOMATION_BYPASS_SECRET` に Protection Bypass for Automation secret を設定してください。設定されている場合、サーバー側 fetch は `x-vercel-protection-bypass` ヘッダーを送信します。未設定で SSO リダイレクトされた場合、トップページは server error を避けるため同じ検証処理を通した店舗データへフォールバックします。

検索・絞り込みは、取得済みの店舗データに対してブラウザで実行します。そのため `prefecture` や `query` のクエリパラメーターは現在の公開 API では受け付けません。

## 管理 API

管理 API は有効な管理者セッション Cookie を必要とします。ログイン用の環境変数が未設定の場合、ログイン API は `503` を返します。`DATABASE_URL` が未設定の場合、管理画面での一覧取得はできますが、更新系 API は `503` を返します。

| メソッド | パス | 成功時 | 主な失敗時 |
| --- | --- | --- | --- |
| `POST` | `/api/admin/login` | `200` と `Set-Cookie` | 資格情報不一致は `401`、管理者設定なしは `503` |
| `POST` | `/api/admin/logout` | `200` と期限切れの Cookie | なし |
| `GET` | `/api/admin/pubs` | `200` と `{ pubs, databaseConfigured }` | 未認証は `401` |
| `POST` | `/api/admin/pubs` | `201` と `{ pub }` | 未認証は `401`、不正データは `400`、DB 未設定は `503` |
| `PUT` | `/api/admin/pubs/:id` | `200` と `{ pub }` | 未認証は `401`、不正データは `400`、対象なしは `404`、DB 未設定は `503` |
| `DELETE` | `/api/admin/pubs/:id` | `200` と `{ ok: true }` | 未認証は `401`、対象なしは `404`、DB 未設定は `503` |

`POST` と `PUT` の JSON 本文は `Pub` と同じフィールドを使います。新規作成時の `id` はサーバーで生成され、更新時は URL の `:id` が使われます。フィールドの詳細は[店舗データ仕様](data.md)を参照してください。

## 今後の拡張候補

- `GET /api/pubs/:id`: 店舗詳細を返す
- モバイルアプリからの API 利用

## 注意点

- API を追加・変更する場合でも、`packages/shared` の型と検証を優先して使います。
- 秘密値はリポジトリにコミットしません。
- Google Maps など有料 API へ切り替える場合は、料金と利用制限を確認してから実装します。
