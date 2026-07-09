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

## 環境変数

`.env.example` を参考に `.env.local` を作成できます。

```bash
cp .env.example .env.local
```

`IRISHPUB_MAP_API_KEY` は `GET /api/pubs` の任意の API key です。未設定または空の場合、ローカル開発では API key チェックは無効です。値を設定した場合、API へ直接アクセスするには `x-api-key` ヘッダーが必要です。Web アプリのトップページはサーバー側で同じ値を付与して API を呼び出します。

`VERCEL_AUTOMATION_BYPASS_SECRET` は Vercel の Deployment Protection を有効にした Preview 環境で、サーバー側から同じ Preview URL の API を fetch するための任意設定です。Vercel の Protection Bypass for Automation secret を設定すると、`x-vercel-protection-bypass` ヘッダーとして送信します。

## テスト

単体テストは Vitest で実行します。
coverage threshold は 90% 以上です。

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
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```
