# API 方針

## 現状

現時点では専用 API は未作成です。
Web アプリは `data/pubs.json` の静的データと `packages/shared` の型を使います。

## 初期方針

- 初期は静的データで公開まで進める
- 店舗データの形式を先に安定させる
- API が必要になった段階で Next.js Route Handlers を追加する
- Web とモバイルが同じ API / DB を参照できる設計にする

## API 追加時の候補

- `GET /api/pubs`: 店舗一覧を返す
- `GET /api/pubs/:id`: 店舗詳細を返す
- `GET /api/pubs?prefecture=東京都`: 絞り込み検索
- `GET /api/pubs?query=dublin`: テキスト検索

## データ管理の候補

初期案:

- JSON ファイル管理

拡張時の候補:

- Supabase
- Next.js Route Handlers
- Supabase Storage または外部画像 URL

## 注意点

- API を追加する場合でも、`packages/shared` の型を優先して使います。
- 認証や管理画面は初期 MVP には含めません。
- Google Maps など有料 API へ切り替える場合は、料金と利用制限を確認してから実装します。
