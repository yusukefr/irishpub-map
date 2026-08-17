# 開発環境・セットアップ手順

## 必要環境

- Node.js 24 系
- npm
- nvm 推奨

Node.js バージョンは `.nvmrc` に合わせます。

```bash
nvm use
```

## セットアップ

```bash
npm install
```

## 起動

```bash
npm run dev
```

Web アプリは `apps/web` の Next.js アプリとして起動します。

## agent-browserによるブラウザ確認

ブラウザから公開画面を確認する場合は、プロジェクトに追加した`agent-browser`を使用します。`agent-browser`のバージョンは`package-lock.json`で固定され、Chrome本体はリポジトリへ含めません。

初回のみ、Chrome for Testingを取得します。

```bash
npx agent-browser install
```

Linuxでブラウザのシステム依存ライブラリも必要な場合は、環境のパッケージ管理者権限を確認したうえで次を実行します。

```bash
npx agent-browser install --with-deps
```

別のターミナルで開発サーバーを起動し、トップページを開いて読み込みを待ちます。

```bash
npm run dev

npx agent-browser open http://localhost:3000
npx agent-browser wait --load networkidle
npx agent-browser snapshot -i
```

`snapshot -i`で表示された`@eN`形式の参照を使って、検索やチェックボックスなどの主要操作を確認します。画面が変わった後は参照が無効になるため、操作のたびにスナップショットを取り直します。

```bash
npx agent-browser fill @e1 "東京"
npx agent-browser press Enter
npx agent-browser snapshot -i

# スナップショットで確認した参照番号に置き換えます
npx agent-browser click @e2
npx agent-browser snapshot -i
```

画面サイズを指定してスクリーンショットを取得できます。デスクトップ幅と、モバイル幅の目安である390px幅を確認します。

```bash
npx agent-browser set viewport 1280 900
npx agent-browser screenshot /tmp/irishpub-map-desktop.png

npx agent-browser set viewport 390 844
npx agent-browser screenshot /tmp/irishpub-map-mobile.png
```

確認が終わったらブラウザセッションを終了します。

```bash
npx agent-browser close
```

Chromeをダウンロードできない環境では、既にインストール済みのChromeを自動検出させるか、`AGENT_BROWSER_EXECUTABLE_PATH`で実行ファイルのパスを指定できます。認証情報やトークンはコマンド、スクリーンショット、リポジトリへ保存しません。

## 環境変数

`.env.example` を参考に `.env.local` を作成できます。

```bash
cp .env.example .env.local
```

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

## 店舗データの一括インポート

インポート先は004正規化後の pubs、prefectures、pub_statuses、tags、pub_tags です。既存JSONB構成を使う環境は、移行手順の001〜004を順番に実行してからインポートしてください。

`scripts/import-pubs.mjs` は、JSON形式の店舗データをNeonの `pubs` テーブルへ追加します。`id` が既に存在する店舗は更新せずにスキップするため、同じファイルを再実行しても安全です。入力は `packages/shared` の `Pub` 型と同じ形式の配列で、既定のファイル名はリポジトリルートの `pubs.json` です。

移行後の `pubs` は独立カラム構成です。既存の JSONB 構成を移行する場合は、先に [店舗テーブル移行手順](../operations/database-migration.md) を Preview／Production ごとに実行してください。

Neonの接続文字列は、ローカルのシェル環境変数として一時的に設定して実行します。接続文字列は出力・コミットしません。ProductionとPreviewの接続先が異なる場合は、それぞれ実行します。

```bash
DATABASE_URL="$NEON_PRODUCTION_DATABASE_URL" npm run import-pubs -- pubs.json

DATABASE_URL="$NEON_PREVIEW_DATABASE_URL" npm run import-pubs -- pubs.json
```

`NEON_PRODUCTION_DATABASE_URL` と `NEON_PREVIEW_DATABASE_URL` は、Neon ConsoleまたはVercel Projectの環境変数から安全に取得した接続文字列をシェルへ設定した一時的な変数名です。実際の値を `.env`、シェル履歴、リポジトリへ残さないでください。別の入力ファイルを使う場合は、末尾のパスを置き換えます。

```bash
DATABASE_URL="$NEON_PRODUCTION_DATABASE_URL" npm run import-pubs -- path/to/pubs.json
```

実行結果は `Imported <追加件数>, skipped <既存ID件数>, total <入力件数>` の形式で表示されます。無効な形式や入力内で重複する `id` がある場合は、DBへの書き込み前にエラーで停止します。

パスワードハッシュはローカルで生成し、値をリポジトリに保存しません。

```bash
node -e 'const { randomBytes, scryptSync } = require("crypto"); const password = process.argv[1]; const salt = randomBytes(16).toString("base64"); console.log(salt + ":" + scryptSync(password, salt, 64).toString("base64"))' '設定したいパスワード'
```

## テスト

単体テストは Vitest で実行します。coverage threshold は 90% 以上です。

```bash
npm test
```

watch モード:

```bash
npm run test:watch
```

## 型チェック

```bash
npm run typecheck
```

## Lint

```bash
npm run lint
```

## Format

コードの書式にはPrettierを使用します。整形を実行する場合は `format`、書式を確認するだけの場合は `format:check` を実行します。

```bash
npm run format
npm run format:check
```

CIでは `format:check` が実行されるため、Pull Requestを作成する前にローカルでも確認してください。

## Build

```bash
npm run build
```

## Audit

```bash
npm audit --omit=dev
```

## 推奨検証セット

アプリ本体を変更した場合は、原則として以下を実行します。

```bash
npm test
npm run format:check
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

## 関連資料

- [コード規約・開発規約](../development/conventions.md)
- [API 方針](../specs/api.md)
- [システム構成](../architecture/system-overview.md)
