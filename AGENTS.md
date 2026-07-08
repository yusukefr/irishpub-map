# AGENTS.md

このリポジトリで AI agent が作業するための運用ルールです。

## Project Overview

- 日本国内の Irish Pub を地図上で探せる Web アプリです。
- まず Web 版を優先し、将来的に同じデータ構造を使ってモバイルアプリへ展開します。
- 店舗データは `data/pubs.json`、共通型は `packages/shared` で管理します。

## Tech Stack

- Node.js 22 系
- npm workspaces
- Next.js 16
- React
- TypeScript
- MapLibre GL JS
- OpenStreetMap tiles
- Tailwind CSS + global CSS

## Repository Layout

- `apps/web`: Next.js Web アプリ
- `packages/shared`: Web/モバイルで共通利用する型やロジック
- `data/pubs.json`: 店舗データ
- `.github`: Issue / Pull Request テンプレートなど GitHub 設定

## Standard Commands

作業前に Node.js のバージョンを合わせてください。

```bash
nvm use
npm install
```

通常の検証コマンド:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

開発サーバー:

```bash
npm run dev
```

## Working Rules

- `main` ブランチへ直接コミットしないでください。
- Issue 対応時は、Issue の内容を読んだ後、実装前に設計方針・影響範囲・検証方針を Issue コメントに投稿してください。
- GitHub Issue のタイトルは日本語で作成してください。`[AI Task]` や `[Bug]` など `[]` 内の接頭辞は英語のままで構いません。
- Issue コメントの投稿には `scripts/comment-issue-design.sh --issue <issue-number> --body-file <file>` を使ってください。
- Issue 対応時は `origin/main` 起点で作業ブランチを作成してください。
- ブランチ名は `ai/<short-description>` を基本にしてください。
- 変更前に `git status --short --branch` を確認してください。
- ユーザーや他の agent の未コミット変更を勝手に戻さないでください。
- Issue の作業範囲に書かれたファイル・ディレクトリ以外は、必要性が明確な場合だけ変更してください。
- アプリ本体を変更した場合は、原則として test / typecheck / lint / build を実行してください。
- 依存関係を変更した場合は、`npm audit --omit=dev` も確認してください。
- GitHub 操作は `yf AI Agent` の git/GitHub 認証設定を使ってください。

## Pull Request Rules

- PR は `main` を base にしてください。
- PR 本文は日本語で記載してください。
- 関連 Issue がある場合は `Closes #<issue-number>` を含めてください。
- 実行した検証コマンドと結果を PR 本文に記載してください。
- 検証を省略した場合は、理由を明記してください。
- PR 作成時は `scripts/create-pr.sh` を使ってください。
- Issue をもとに PR を作成する場合は、`scripts/create-pr.sh --issue <issue-number>` を指定してください。Issue の labels を PR にコピーします。
- Issue をもとにしない PR の場合は、PR に `ai-agent` label を設定してください。
- PR には reviewer として `yusukefr`、assignee として `yf-ai-agent` を設定してください。

PR 作成例:

```bash
scripts/create-pr.sh \
  --issue 10 \
  --title "Add PR metadata automation" \
  --body-file pr-body.md
```

Issue 設計方針コメント例:

```bash
scripts/comment-issue-design.sh \
  --issue 13 \
  --body-file issue-design.md
```

## Notes

- 地図表示には WebGL が必要です。WebGL が使えない環境ではフォールバック表示になります。
- Google Maps など有料 API へ切り替える場合は、料金と利用制限を確認してから実装してください。
- 店舗データ形式は Web とモバイルで共通利用できるよう維持してください。
