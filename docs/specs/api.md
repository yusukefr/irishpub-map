# API 方針

## 現状

Next.js Route Handler で店舗一覧 API を提供します。Web アプリは `data/pubs.json` を直接参照せず、サーバー側から API 経由で店舗データを取得します。

## エンドポイント

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

`IRISHPUB_MAP_API_KEY` が設定されている環境では、API リクエストに `x-api-key` ヘッダーが必要です。値が一致しない場合は `401` を返します。

```bash
curl -H "x-api-key: $IRISHPUB_MAP_API_KEY" http://localhost:3000/api/pubs
```

ローカル開発で `IRISHPUB_MAP_API_KEY` が未設定の場合、API key チェックは無効です。公開環境やモバイルアプリから利用する環境では Vercel の Environment Variables に `IRISHPUB_MAP_API_KEY` を設定します。

Web アプリのトップページはサーバー側で `/api/pubs` を fetch します。API key はサーバー側のヘッダーとして付与され、ブラウザには露出しません。

Vercel Preview Deployment Protection を有効にしている場合は、`VERCEL_AUTOMATION_BYPASS_SECRET` に Protection Bypass for Automation secret を設定してください。設定されている場合、サーバー側 fetch は `x-vercel-protection-bypass` ヘッダーを送信します。未設定で SSO リダイレクトされた場合、トップページは server error を避けるため同じ検証処理を通した店舗データへフォールバックします。

## 今後の拡張候補

- `GET /api/pubs/:id`: 店舗詳細を返す
- `GET /api/pubs?prefecture=東京都`: 絞り込み検索
- `GET /api/pubs?query=dublin`: テキスト検索
- DB や管理画面からのデータ更新
- モバイルアプリからの API 利用

## 注意点

- API を追加・変更する場合でも、`packages/shared` の型と検証を優先して使います。
- 秘密値はリポジトリにコミットしません。
- Google Maps など有料 API へ切り替える場合は、料金と利用制限を確認してから実装します。
