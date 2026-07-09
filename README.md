# 日本の Irish Pub マップ

日本国内の Irish Pub を地図上で探せる Web アプリです。
まずは Web 版として公開し、店舗データや検索体験を固めたあと、同じデータ構造を使ってモバイルアプリへ展開します。

## 公開 URL

- https://irishpub-map-web.vercel.app/

## ドキュメント

詳細は `docs/` 配下に分割しています。

- [プロダクト仕様](docs/specs/product.md)
- [店舗データ仕様](docs/specs/data.md)
- [API 方針](docs/specs/api.md)
- [開発環境・セットアップ手順](docs/setup/development.md)
- [デプロイ手順](docs/setup/deployment.md)

## 使用技術

- Next.js 16
- React
- TypeScript
- MapLibre GL JS
- OpenStreetMap tiles
- Tailwind CSS + global CSS
- npm workspaces
- Node.js 24 系

## クイックスタート

```bash
nvm use
npm install
npm run dev
```

Web アプリは `apps/web` の Next.js アプリとして起動します。

## 検証コマンド

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

## バージョン情報の更新

アプリの表示バージョンは `app-version.json` で管理します。リリース時は以下を更新してください。

- `version`: 公開するアプリのバージョン番号
- `releaseDate`: 公開日。`YYYY-MM-DD` 形式で記載します。

Web アプリの下部には、このファイルの `version` と `releaseDate` が表示されます。更新後は `npm run build` で表示用データを含めてビルドできることを確認してください。

## リポジトリ構成

```text
irishpub-map
├── apps/web
├── data
├── docs
├── packages/shared
├── scripts
├── tests
├── package.json
└── README.md
```

## AI Agent 向けルール

AI Agent の作業ルールは [AGENTS.md](AGENTS.md) を参照してください。
