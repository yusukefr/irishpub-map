# デプロイ手順

## 方針

Web アプリは Vercel にデプロイします。`main` ブランチを Production Branch とし、`main` に merge された変更が本番デプロイされる構成にします。

このリポジトリは npm workspaces 構成で、Next.js アプリは `apps/web` にあります。Vercel ではリポジトリ root をプロジェクト root として扱い、root の `vercel.json` から install / build / output を制御します。

## 公開 URL

現在の Vercel Production URL は以下です。

- https://irishpub-map-web.vercel.app/

この URL を正式な公開 URL として扱います。Vercel の Production Domain / Alias でも `irishpub-map-web.vercel.app` が Production Deployment に紐づいていることを確認してください。

## Vercel プロジェクト設定

Vercel で GitHub リポジトリ `yusukefr/irishpub-map` を Import します。

推奨設定:

| 項目 | 値 |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `.` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `apps/web/.next` |
| Production Branch | `main` |
| Node.js Version | 24.x |

`vercel.json` でも同じ build 設定を管理します。

Production Domain / Alias の確認項目:

- Domains に `irishpub-map-web.vercel.app` が登録されている
- `main` ブランチの Production Deployment が `irishpub-map-web.vercel.app` に紐づいている
- 旧 Preview 風 URL をドキュメントや外部導線で案内していない
- Preview Deployment の URL と Production URL を混同しない

## 環境変数

Web アプリは店舗一覧 API `GET /api/pubs` を利用します。Production 環境では API key として `IRISHPUB_MAP_API_KEY` を Vercel の Environment Variables に設定してください。

`IRISHPUB_MAP_API_KEY` はサーバー側で `/api/pubs` へ渡され、ブラウザには露出しません。値を設定すると、API に直接アクセスする外部クライアントは `x-api-key` ヘッダーが必要になります。

Preview Deployment Protection を有効にしている場合、サーバー側から同じ Preview URL の `/api/pubs` を fetch すると Vercel SSO へリダイレクトされることがあります。その場合は Vercel の Protection Bypass for Automation secret を `VERCEL_AUTOMATION_BYPASS_SECRET` として Preview 環境にも設定してください。アプリはこの値を `x-vercel-protection-bypass` ヘッダーとして送信します。未設定でも SSO リダイレクト時は検証済み店舗データへフォールバックし、ページ全体が server error にならないようにしています。

今後、地図 API、管理画面、外部データ保存先などを追加する場合は、Vercel の Project Settings から環境変数を追加し、README または docs に用途と必要な環境を追記します。秘密値そのものはリポジトリにコミットしません。

## デプロイの流れ

1. GitHub と Vercel を連携し、このリポジトリを Vercel Project として Import します。
2. Root Directory が `.`、Production Branch が `main` になっていることを確認します。
3. Node.js Version を 24.x に設定します。
4. `main` ブランチへ PR を merge します。
5. Vercel の Deployments で Production Deployment が成功していることを確認します。

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

管理画面は /admin です。Vercel Marketplace から Neon を追加し、Production / Preview 環境に DATABASE_URL を設定してください。初回のデータ取得時に pubs テーブルを作成し、既存の data/pubs.json を初期投入します。

管理者認証には次の環境変数を設定します。値はリポジトリやブラウザへ保存しません。

| 変数 | 用途 |
| --- | --- |
| ADMIN_USERNAME | 管理者 ID |
| ADMIN_PASSWORD_HASH | salt:base64-hash 形式の scrypt パスワードハッシュ |
| ADMIN_SESSION_SECRET | 十分に長いランダムな Cookie 署名用秘密鍵 |
| DATABASE_URL | Neon の接続文字列（Marketplace 連携で自動設定） |

パスワードハッシュは、ローカルで生成して Vercel の環境変数にだけ登録します。例:

```bash
node -e 'const { randomBytes, scryptSync } = require("crypto"); const password = process.argv[1]; const salt = randomBytes(16).toString("base64"); console.log(salt + ":" + scryptSync(password, salt, 64).toString("base64"))' '設定したいパスワード'
```

Neon Free は小規模な管理用途から開始できますが、使用量と上限は Neon のダッシュボードで監視してください。
