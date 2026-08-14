# デプロイ手順

## 方針

Web アプリは Vercel にデプロイします。`main` ブランチを Production Branch とし、`main` に merge された変更が本番デプロイされる構成にします。

このリポジトリは npm workspaces 構成で、Next.js アプリは `apps/web` にあります。Vercel ではリポジトリ root をプロジェクト root として扱い、root の `vercel.json` から install / build / output を制御します。

## 公開 URL

公開 URL は README に記載します。Production URL とカスタムドメインの設定変更は Vercel の Project Settings で管理してください。

## Vercel プロジェクト設定

Vercel で対象の GitHub リポジトリを Import します。

推奨設定:

| 項目 | 値 |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `.` |
| Install Command | `npm ci` |
| Build Command | `npm run update-app-version -- --date-only && npm run build` |
| Output Directory | `apps/web/.next` |
| Production Branch | `main` |
| Node.js Version | 24.x |

`vercel.json` でも同じ build 設定を管理します。

### デプロイ時のバージョン更新

GitHub Actions のPR用ワークフローで `npm run update-app-version` が実行され、PRブランチの `app-version.json` にバージョンとリリース日をコミットします。Vercelでは `npm run update-app-version -- --date-only` により、コミット済みバージョンを維持したままリリース日だけを日本時間（JST）の当日に更新します。

機能追加や画面改修をデプロイする場合は、GitHub Actions のリポジトリVariables `APP_VERSION_BUMP` に `minor` を設定してください。未設定または `patch` の場合は patch バージョンが更新されます。`major` はこの運用では自動更新しません。

Production Domain / Alias の確認項目:

## Web Analytics と Speed Insights

アプリには `@vercel/analytics` と `@vercel/speed-insights` を組み込み、ProductionデプロイのページビューとCore Web Vitalsを収集します。追加の環境変数は不要です。

1. Vercel Project の **Analytics** を開き、Web Analyticsを有効化します。
2. Vercel Project の **Speed Insights** を開き、有効化します。
3. Productionへデプロイ後、実際のアクセスを発生させてから各ダッシュボードでデータを確認します。反映まで時間がかかる場合があります。

Analyticsはプライバシーに配慮したVercelのファーストパーティ計測です。カスタムイベントの追加や保持期間などの詳細は、Vercel Dashboardと公式ドキュメントで確認してください。
- Domains に承認済みの Production Domain が登録されている
- `main` ブランチの Production Deployment が Production Domain に紐づいている
- Preview Deployment の URL と Production URL を混同しない

## 環境変数

Vercel の Production / Preview 環境には、用途に応じて次の変数を設定します。秘密値はリポジトリにコミットしません。

| 変数 | 必要な場面 | 用途 |
| --- | --- | --- |
| `IRISHPUB_MAP_API_KEY` | 任意 | `GET /api/pubs` の API key |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Preview の Deployment Protection を使う場合 | サーバー側 fetch 用の Protection Bypass secret |
| `DATABASE_URL` | 管理画面で永続化する場合 | Neon の接続文字列 |
| `ADMIN_USERNAME` | 管理画面を有効にする場合 | 管理者 ID |
| `ADMIN_PASSWORD_HASH` | 管理画面を有効にする場合 | scrypt パスワードハッシュ |
| `ADMIN_SESSION_SECRET` | 管理画面を有効にする場合 | セッション Cookie 署名用秘密鍵 |

`IRISHPUB_MAP_API_KEY` はサーバー側で `/api/pubs` へ渡され、ブラウザには露出しません。値を設定すると、API に直接アクセスする外部クライアントは `x-api-key` ヘッダーが必要になります。

### API キーの生成

API キーは、リポジトリへ値を保存せず、ローカルのターミナルで生成します。引数なしでは5個のキーを1行ずつ出力します。

```bash
node scripts/generate-api-keys.mjs
```

生成数を指定する場合は、1〜100個の範囲で指定します。

```bash
node scripts/generate-api-keys.mjs 10
```

出力されたキーは秘密情報として扱い、必要なものだけを Vercel の `IRISHPUB_MAP_API_KEY` に登録してください。ターミナルログ、Issue、Pull Request、リポジトリ内のファイルへ貼り付けないでください。

Preview Deployment Protection を有効にしている場合、サーバー側から同じ Preview URL の `/api/pubs` を fetch すると Vercel SSO へリダイレクトされることがあります。その場合は Vercel の Protection Bypass for Automation secret を `VERCEL_AUTOMATION_BYPASS_SECRET` として Preview 環境にも設定してください。アプリはこの値を `x-vercel-protection-bypass` ヘッダーとして送信します。未設定でも SSO リダイレクト時は検証済み店舗データへフォールバックし、ページ全体が server error にならないようにしています。

管理画面のログインには `ADMIN_USERNAME`、`ADMIN_PASSWORD_HASH`、`ADMIN_SESSION_SECRET` のすべてが必要です。更新操作には、さらに `DATABASE_URL` が必要です。

## Neon Preview ブランチ上限対策

Vercel の Neon 連携で `Create database branch for deployment` の Preview 設定を有効にすると、Preview デプロイごとに Neon のブランチが作成されます。Neon Free のブランチ上限に達すると、アプリのビルドが始まる前に `Provisioning integrations failed`、`Branch limit reached` でデプロイが失敗します。

このリポジトリでは、無料枠を安定して使うため、Preview は専用の固定 Neon ブランチを共有します。Production の Neon ブランチは Preview と共有しません。

### 初回または上限到達時の設定

1. Neon Console の対象プロジェクトで、未使用の `preview/*` ブランチを確認し、不要なものだけ削除します。Production で使用しているブランチと、現在利用中の Preview ブランチは削除しません。
2. Neon Console で専用の Preview ブランチを1つ作成し、その接続文字列を取得します。接続文字列は秘密情報として扱い、リポジトリへ記録しません。
3. Vercel Project の **Storage → neon-irishpub-map** の連携設定を開き、**Create database branch for deployment → Preview** を無効にします。これが有効なままだと、Preview ごとのブランチ作成が続きます。
4. Vercel Project の **Settings → Environment Variables** で、専用 Preview ブランチの接続文字列を `DATABASE_URL` の **Preview** 環境へ登録または更新します。Production 環境の `DATABASE_URL` は変更しません。
5. 失敗したデプロイを **Redeploy** するか、作業ブランチへ新しいコミットを push します。

Vercel CLIで環境変数を登録する場合も、値をコマンドラインやシェル履歴へ残さないよう標準入力から渡します。

```bash
printf '%s' "$NEON_PREVIEW_DATABASE_URL" | vercel env add DATABASE_URL preview
```

`NEON_PREVIEW_DATABASE_URL` はシェルへ安全に読み込んだ一時的な値を想定し、`.env` やリポジトリへ追加しません。設定後は Vercel の次の Preview Deployment で、Provisioning Integrations のブランチ作成が実行されず、通常の Build ログが開始することを確認します。

この連携アクションの有効・無効は Vercel Dashboard 側の設定であり、`vercel.json` では管理できません。Neon のブランチ分離が必要になった場合は、ブランチ上限と削除運用を確認したうえで Preview の自動作成を再度有効にしてください。

## GitHub Actions の設定

CI の Slack 通知は Vercel の環境変数ではなく GitHub の Actions 設定を参照します。通知を有効にする場合は、リポジトリの **Settings → Secrets and variables → Actions** で次を設定します。

| 種別 | 名前 | 用途 |
| --- | --- | --- |
| Variable | `SLACK_CICD_CHANNEL` | 任意。通知先チャンネル |
| Secret | `SLACK_CICD_WEBHOOK_URL` | Slack Incoming Webhook URL |

## デプロイの流れ

1. GitHub と Vercel を連携し、このリポジトリを Vercel Project として Import します。
2. Root Directory が `.`、Production Branch が `main` になっていることを確認します。
3. Node.js Version を 24.x に設定します。
4. 必要な Vercel 環境変数、Neon Preview の固定ブランチ設定、必要に応じて GitHub Actions の Slack 通知設定を追加します。
5. `main` ブランチへ PR を merge します。
6. Vercel の Deployments で Production Deployment が成功していることを確認します。

## ローカルでの事前確認

PR を merge する前に、少なくとも以下を確認します。

```bash
nvm use
npm ci
npm run lint
npm test
npm run build
npm audit --omit=dev
```

## 参考

- Vercel Project Configuration: https://vercel.com/docs/project-configuration
- Vercel Monorepos: https://vercel.com/docs/monorepos
- Next.js on Vercel: https://vercel.com/docs/frameworks/full-stack/nextjs

## 管理画面と Neon Postgres

管理画面は `/admin` です。Vercel Marketplace から Neon を追加し、Production 環境には本番ブランチ、Preview 環境には[Neon Preview ブランチ上限対策](#neon-preview-ブランチ上限対策)で作成した固定ブランチの `DATABASE_URL` を設定してください。初回のデータ取得時に `pubs` テーブルを作成し、既存の `data/pubs.json` を初期投入します。`DATABASE_URL` が未設定の場合、管理画面は初期データを閲覧できますが書き込みはできません。

パスワードハッシュは、ローカルで生成して Vercel の環境変数にだけ登録します。例:

```bash
node -e 'const { randomBytes, scryptSync } = require("crypto"); const password = process.argv[1]; const salt = randomBytes(16).toString("base64"); console.log(salt + ":" + scryptSync(password, salt, 64).toString("base64"))' '設定したいパスワード'
```

Neon Free は小規模な管理用途から開始できますが、使用量と上限は Neon のダッシュボードで監視してください。

店舗データを一括追加する場合は、[開発環境・セットアップ手順の一括インポート](development.md#店舗データの一括インポート)を使用してください。ProductionとPreviewの接続先が分かれている場合は、両方へ個別に実行します。

参考: [Neon の Vercel Native Integration](https://neon.com/blog/neon-vercel-native-integration)、[Vercel の Deployment integration actions](https://vercel.com/docs/integrations/create-integration/deployment-integration-action)

API の認証・更新条件は[API 方針](../specs/api.md)、全体構成は[システム構成](../architecture/system-overview.md)を参照してください。
