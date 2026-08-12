# 開発環境・セットアップ手順

## 必要環境

- Node.js 24 系
- npm
- nvm 推奨

Node.js バージョンは `.nvmrc` に合わせます。

~~~bash
nvm use
~~~

## セットアップ

~~~bash
npm install
~~~

## 起動

~~~bash
npm run dev
~~~

Web アプリは `apps/web` の Next.js アプリとして起動します。

## 環境変数

`.env.example` を参考に `.env.local` を作成できます。

~~~bash
cp .env.example .env.local
~~~

| 変数 | 必要な場面 | 用途 |
| --- | --- | --- |
| `IRISHPUB_MAP_API_KEY` | 任意 | `GET /api/pubs` の API key。設定時は直接アクセスに `x-api-key` が必要 |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Preview の Deployment Protection を使う場合 | サーバー側の公開 API fetch で送る bypass ヘッダー |
| `DATABASE_URL` | 管理画面で永続化する場合 | Neon Postgres の接続文字列 |
| `ADMIN_USERNAME` | 管理画面を有効にする場合 | 管理者 ID |
| `ADMIN_PASSWORD_HASH` | 管理画面を有効にする場合 | `salt:base64-hash` 形式の scrypt パスワードハッシュ |
| `ADMIN_SESSION_SECRET` | 管理画面を有効にする場合 | セッション Cookie 署名用の十分に長いランダム値 |

`IRISHPUB_MAP_API_KEY` が未設定または空の場合、ローカル開発では API key チェックは無効です。値を設定した場合、Web アプリのトップページはサーバー側で同じ値を付与して API を呼び出します。

管理画面の表示とログインは、3 つの `ADMIN_*` 変数がすべて設定されている場合に有効です。店舗の追加・編集・削除には、さらに `DATABASE_URL` が必要です。DB 未設定時は `/admin` で初期データを閲覧できますが、更新操作は失敗します。

パスワードハッシュはローカルで生成し、値をリポジトリに保存しません。

~~~bash
node -e 'const { randomBytes, scryptSync } = require("crypto"); const password = process.argv[1]; const salt = randomBytes(16).toString("base64"); console.log(salt + ":" + scryptSync(password, salt, 64).toString("base64"))' '設定したいパスワード'
~~~

## テスト

単体テストは Vitest で実行します。coverage threshold は 90% 以上です。

~~~bash
npm test
~~~

watch モード:

~~~bash
npm run test:watch
~~~

## 型チェック

~~~bash
npm run typecheck
~~~

## Lint

~~~bash
npm run lint
~~~

## Build

~~~bash
npm run build
~~~

## Audit

~~~bash
npm audit --omit=dev
~~~

## 推奨検証セット

アプリ本体を変更した場合は、原則として以下を実行します。

~~~bash
npm test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
~~~

## 関連資料

- [コード規約・開発規約](../development/conventions.md)
- [API 方針](../specs/api.md)
- [システム構成](../architecture/system-overview.md)
