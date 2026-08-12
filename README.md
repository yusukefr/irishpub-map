# 日本の Irish Pub マップ

日本国内の Irish Pub を地図上で探せる Web アプリです。
まずは Web 版として公開し、店舗データや検索体験を固めたあと、同じデータ構造を使ってモバイルアプリへ展開します。

## 公開環境

公開 URL: https://irishpub-map-web.vercel.app

## ドキュメント

設計、開発、運用の詳細は `docs/` 配下に分割しています。

- [プロダクト仕様](docs/specs/product.md)
- [店舗データ仕様](docs/specs/data.md)
- [API 方針](docs/specs/api.md)
- [システム構成図](docs/architecture/system-overview.md)
- [シーケンス図](docs/architecture/sequences.md)
- [開発環境・セットアップ手順](docs/setup/development.md)
- [コード規約・開発規約](docs/development/conventions.md)
- [デプロイ手順](docs/setup/deployment.md)
- [リポジトリ設定の保守手順](docs/repository-settings/README.md)

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

## コードとドキュメントの同期

コードとドキュメントは同じ変更単位で保守します。

- コードを変更したときは、仕様、API、データ形式、環境変数、セットアップ・デプロイ手順、構成図・シーケンス図への反映要否を確認します。
- ドキュメントを変更したときは、記載した仕様、API、画面挙動、運用手順が実装と一致することを確認します。
- どちらかに差分がある場合は、もう一方も同じ Pull Request で更新します。
- Pull Request には、コードとドキュメントの同期を確認した結果を記載します。

詳細な実装・レビューの基準は[コード規約・開発規約](docs/development/conventions.md)、AI agent の必須ルールは[AGENTS.md](AGENTS.md)を参照してください。

## Codex Skills

Codex はリポジトリ配下の `.agents/skills` を自動検出します。個人の
グローバル設定に依存せず、チームで同じ手順を使えるよう、次の Skills を
管理しています。明示的に使う場合は、Codex のプロンプトで `$<skill-name>` を
指定してください。

- `gh-fix-ci`: GitHub Actions の失敗ログを調査し、修正方針を作成します。修正は承認後に実施します。
- `gh-address-comments`: 現在のブランチの Pull Request にあるレビューコメントを確認し、対応対象を選んでから修正します。
- `vercel-deploy`: Vercel へのデプロイを行います。明示的な依頼がない限りプレビューとしてデプロイし、本番デプロイはユーザーの明示指示が必要です。
- `web-test-workflow`: このリポジトリの Vitest、Testing Library、MapLibre モックを使ったテスト実装と検証を案内します。

Skills は繰り返し実行する手順を補助するものであり、リポジトリ固有の作業
ルール・変更範囲・承認要件は常に [AGENTS.md](AGENTS.md) を優先します。

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
