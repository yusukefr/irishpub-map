# AGENTS.md

このリポジトリで AI agent が作業するための運用ルールです。

## Project Overview

- 日本国内の Irish Pub を地図上で探せる Web アプリです。
- まず Web 版を優先し、将来的に同じデータ構造を使ってモバイルアプリへ展開します。
- 店舗データはNeon Postgresで管理し、共通型は `packages/shared` で管理します。DATABASE_URL未設定時は店舗0件として扱います。

## Tech Stack

- Node.js 24 系
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
- `db/migrations`: Neon Postgres のスキーマ移行SQL
- `data`: 市区町村コードのマスタCSV。店舗データは含めない
- `docs`: 仕様、構成、開発・運用手順
- `.agents/skills`: このリポジトリで共有するCodex Skills
- `.github`: Issue / Pull Request テンプレートなど GitHub 設定

店舗データの永続化先はNeon Postgresです。ローカルからのデータ投入はインポート手順を使用します。

## Standard Commands

作業前に Node.js のバージョンを合わせてください。

```bash
nvm use
npm install
```

通常の検証コマンド:

```bash
npm test
npm run format:check
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

PRの最新HEADに対するCI確認:

```bash
scripts/verify-pr-ci.sh --pr <pull-request-number>
# 最新HEADにCIがない場合に、手動CIを起動して待機する
scripts/verify-pr-ci.sh --pr <pull-request-number> --dispatch
```

コードの整形にはPrettierを使用します。書式を変更する場合は `npm run format`、確認だけの場合は `npm run format:check` を実行してください。

開発サーバー:

```bash
npm run dev
```

## コード規約・開発規約

コード規約・開発規約は [docs/development/conventions.md](docs/development/conventions.md) を参照してください。この AGENTS.md の必須ルールと矛盾する場合は、AGENTS.md を優先します。

## Working Rules

- `main` ブランチへ直接コミットしないでください。
- Issue 対応時は、Issue の内容を読んだ後、実装前に設計方針・影響範囲・検証方針を Issue コメントに投稿してください。
- GitHub Issue のタイトルは日本語で作成してください。`[AI Task]` や `[Bug]` など `[]` 内の接頭辞は英語のままで構いません。
- Issue の設計コメントは `scripts/comment-issue-design.sh --issue <issue-number> --body-file <file>` を使ってください。複数行の本文を `--body` に渡したり、`\n` などのエスケープ文字列で改行を表現してはいけません。
- Issue 対応時は `origin/main` 起点で作業ブランチを作成してください。
- ブランチ名は `ai/<short-description>` を基本にしてください。
- 変更前に `git status --short --branch` を確認してください。
- ユーザーや他の agent の未コミット変更を勝手に戻さないでください。
- Issue の作業範囲に書かれたファイル・ディレクトリ以外は、必要性が明確な場合だけ変更してください。
- 実装意図、前提条件、副作用が名前と型だけでは読み取れない箇所には、日本語のコメントまたは JSDoc を記載してください。処理の逐語的な説明は避け、コード変更時は関連コメントも更新してください。
- アプリ本体を変更した場合は、原則として test / typecheck / lint / build を実行してください。
- コードまたはドキュメントを変更した場合は、対応するもう一方に更新が必要かを必ず確認してください。仕様、API、データ形式、環境変数、運用手順、画面挙動に差分がある場合は、コードとドキュメントを同じ作業で更新し、PR 本文に確認結果を記載してください。
- 依存関係を変更した場合は、`npm audit --omit=dev` も確認してください。
- GitHub 操作は、作業環境に設定された専用の git/GitHub 認証を使ってください。アカウント名はリポジトリへ記録しないでください。

## ESLint と JSDoc

- ESLint の設定はリポジトリルートの `eslint.config.mjs` で管理し、Web アプリと `packages/shared/src` を同じルールで検査します。
- 公開された関数、コンポーネント、Route Handler、共有パッケージの公開型を JSDoc の対象とします。内部のイベントコールバック、局所的な変換関数、無名関数へ一律のコメントは要求しません。
- 公開関数の JSDoc には目的を記載し、引数がある場合は `@param`、戻り値がある場合は `@returns` を付けます。説明は型だけでは分からない前提、失敗時の扱い、副作用を優先します。
- 採用ルールは、JSDoc の整列・タグ名・引数名・説明・JSDoc・`@param`・`@returns` の検査と、ESLint コアの `no-eval`、`no-implied-eval`、`no-new-func`、`no-script-url`、`no-promise-executor-return` です。
- `@typescript-eslint/no-misused-promises`、`eslint-plugin-security`、`eslint-plugin-react`、`no-console`、`no-await-in-loop` は、型認識設定・誤検知・互換性・既存の正当な用途を考慮して見送ります。Prettier のルールは ESLint に重複させません。

## Public UI Design Rules

- 公開画面のデザインを変更する場合は、[UI とアクセシビリティ](docs/development/conventions.md)の「公開画面のデザイン基準」に従ってください。
- 探索体験では「目的を伝える」「検索・絞り込みを操作する」「地図と結果一覧を確認する」の順に、見出しとレイアウトで情報階層を明確にします。
- 既存の意味的なデザイントークンを再利用し、深いグリーン、温かいゴールド、明るい生成りを基調とする Irish Pub Map の視覚言語を維持します。新しい色、余白、角丸、影を繰り返し使う場合は、個別の値を増やさずトークンとして定義します。
- 操作要素は原則44px以上の操作領域、視認できるキーボードフォーカス、目的が分かるラベルを備えます。動的に変わる検索結果数や状態は、必要に応じて支援技術へ通知します。
- 公開画面の視覚的な変更では、関連する挙動テストに加えて、デスクトップ幅と390px幅程度のモバイル幅でブラウザ表示を確認します。読み込み、主要操作、エラーオーバーレイの有無を確認してください。

## Pull Request Rules

- PR は `main` を base にしてください。
- PR 本文は日本語で記載してください。
- 関連 Issue がある場合は `Closes #<issue-number>` を含めてください。
- 実行した検証コマンドと結果を PR 本文に記載してください。
- PR作成後または修正push後は `scripts/verify-pr-ci.sh --pr <pull-request-number>` で、最新HEAD SHAに `Lint, Test, Build` が紐づいていることを確認してください。
- 最新HEADに成功したCIがない場合は `scripts/verify-pr-ci.sh --pr <pull-request-number> --dispatch` で手動CIを実行し、結果をPR本文または作業報告へ記載してください。`workflow_dispatch` の結果はPRの通常チェックへ紐づかない場合があるため、手動実行であることも明記してください。
- 検証を省略した場合は、理由を明記してください。
- PR 作成時は `scripts/create-pr.sh` を使ってください。
- PR 本文は `.github/pull_request_template.md` をベースにした本文ファイルを必ず `--body-file` で渡してください。`--body` は使用しないでください。
- Issue をもとに PR を作成する場合は、`scripts/create-pr.sh --issue <issue-number>` を指定してください。Issue の labels を PR にコピーします。
- Issue をもとにしない PR の場合は、PR に `ai-agent` label を設定してください。
- PR の reviewer と assignee は、必要に応じて PR_REVIEWER と PR_ASSIGNEE の環境変数で指定してください。

## Sensitive Information Rules

- 個人名、メールアドレス、アカウント名、Preview URL、トークン、秘密鍵をコードやドキュメントへ記録しないでください。公開用の Production URL は README に記載できます。
- リポジトリ・reviewer・assignee など環境固有の値は環境変数または認証済み CLI から取得してください。
- 追加の検出対象は `SENSITIVE_IDENTIFIERS` にカンマ区切りで指定してください。
- コミット前に `npm run check:sensitive-data` を実行してください。
- 検出を回避するためにフックを無効化したり、値を分割・難読化したりしないでください。

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
