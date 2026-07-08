# デプロイ手順

## 方針

Web アプリは Vercel にデプロイします。`main` ブランチを Production Branch とし、`main` に merge された変更が本番デプロイされる構成にします。

このリポジトリは npm workspaces 構成で、Next.js アプリは `apps/web` にあります。Vercel ではリポジトリ root をプロジェクト root として扱い、root の `vercel.json` から install / build / output を制御します。

## 公開 URL

現在の Vercel デプロイ先は以下です。

- https://irishpub-map-ltarenfqa-yf5.vercel.app/

この URL は Vercel の Production Deployment として、`main` ブランチへの merge 後に更新される想定です。

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

## 環境変数

現時点の Web アプリは外部 API キーや秘密情報を必要としません。そのため、Vercel に必須の Environment Variables はありません。

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
