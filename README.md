# 日本の Irish Pub マップ

日本国内の Irish Pub を地図上で探せる Web アプリです。まずWeb版で店舗データと検索体験を整え、将来は同じデータ構造を使ってモバイルアプリへ展開します。

公開URL: https://irishpub-map-web.vercel.app

## 使用技術

- Node.js 24
- npm workspaces
- Next.js 16
- React
- TypeScript
- MapLibre GL JS
- OpenStreetMap tiles
- Tailwind CSS + global CSS
- Neon Postgres

## クイックスタート

```bash
nvm use
npm install
npm run dev
```

Webアプリは `apps/web` のNext.jsアプリとして起動します。セットアップの詳細は[ローカル開発の開始](docs/setup/development.md)を参照してください。

## 基本的な開発コマンド

```bash
npm test
npm run format:check
npm run typecheck
npm run lint
npm run build
npm run check:sensitive-data
```

E2Eや依存関係変更時の確認を含む詳しい検証方針は[コード規約・開発規約](docs/development/conventions.md)を参照してください。

## リポジトリ構成

```text
irishpub-map
├── .agents/skills       # リポジトリ共通のCodex Skills
├── .github              # GitHub Actions・Issue・PR設定
├── apps/web             # Next.js Webアプリ
├── data                 # 市区町村コードのマスタ
├── db/migrations        # Neon PostgresのMigration
├── docs                 # 仕様・設計・開発・運用文書
├── packages/shared      # Web・モバイル共通の型とロジック
├── scripts              # 開発・運用スクリプト
└── tests                # リポジトリ横断のテスト
```

## ドキュメント

タスク別の参照先は [Documentation Router](docs/README.md) にまとめています。すべての文書を最初から読む必要はなく、目的に関係する文書だけを参照してください。

AI Agent向けの必須ルールと入口は [AGENTS.md](AGENTS.md) を参照してください。
