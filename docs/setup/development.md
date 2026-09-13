# ローカル開発の開始

この文書は、Irish Pub Mapのローカル開発を開始するための最短手順です。Pub Import、Visual Regressionの基準画像更新、管理者初期設定などの低頻度な作業は[Runbooks](../README.md#documentation-router)を参照してください。

## 必要環境

- Node.js 24系（`.nvmrc`に従う）
- npm
- nvm（推奨）

```bash
nvm use
npm install
```

`nvm`を利用しない環境では、`.nvmrc`と同じNode.js major versionを選択します。

## ローカル環境変数

`.env.example`をコピーして`.env.local`を作成します。実値をGit、Issue、PR、スクリーンショットへ記録しません。

```bash
cp .env.example .env.local
```

| 変数                              | 必要な場面                      | 用途                                    |
| --------------------------------- | ------------------------------- | --------------------------------------- |
| `IRISHPUB_MAP_API_KEY`            | 任意                            | `GET /api/pubs`のAPI key                |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Preview Protectionを使う場合    | Previewのサーバー側fetch用bypass secret |
| `DATABASE_URL`                    | 公開Guideまたは永続化を使う場合 | Neon Postgres接続文字列                 |
| `ADMIN_USERNAME`                  | 管理画面を有効にする場合        | 管理者ID                                |
| `ADMIN_PASSWORD_HASH`             | 管理画面を有効にする場合        | scrypt password hash                    |
| `ADMIN_SESSION_SECRET`            | 管理画面を有効にする場合        | セッションCookie署名用のランダム値      |

`DATABASE_URL`未設定時は店舗と公開Guideを0件として扱います。3つの`ADMIN_*`変数がすべてそろうと管理画面のログインが有効になり、更新にはさらに`DATABASE_URL`が必要です。

## 起動

```bash
npm run dev
```

Next.jsアプリは`apps/web`で起動します。

## 基本検証

変更内容に応じて次を実行します。

```bash
npm test
npm run format:check
npm run typecheck
npm run lint
npm run build
npm run check:sensitive-data
```

依存関係を変更した場合は、追加で`npm audit --omit=dev`を実行します。E2Eの通常実行は`npm run test:e2e`です。

## 詳細Runbook

- [Pubを一括Importする](../runbooks/import-pubs.md)
- [Visual Regressionを更新する](../runbooks/visual-regression.md)
- [ブラウザで画面を確認する](../runbooks/browser-check.md)
- [Neon migrationを適用する](../runbooks/neon-migrations.md)
- [管理者アクセスを初期設定する](../runbooks/admin-access.md)
- [リリース・CI運用を行う](../runbooks/release-operations.md)

## 関連資料

- [コード規約・開発規約](../development/conventions.md)
- [API specification](../specs/api.md)
- [System overview](../architecture/system-overview.md)
