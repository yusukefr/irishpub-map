# コード規約・開発規約

この文書は日常的な実装・レビューの基準です。AI agent の作業手順、変更範囲、GitHub 操作、機密情報に関する必須ルールは[AGENTS.md](../../AGENTS.md)を優先します。

## コード規約

### 型とデータ

- アプリと将来のモバイルアプリで共有する店舗型・タグのロジックは `packages/shared` に置きます。
- 外部入力、JSON、API レスポンスは `unknown` として受け取り、共有の検証関数を通してから利用します。
- 店舗データのフィールドや許容値を変更するときは、[店舗データ仕様](../specs/data.md)、共有型、テストを同じ変更で更新します。
- `data/pubs.json` は初期データとフォールバックです。永続化後の公開・管理データは `DATABASE_URL` が設定された Neon を正とします。

### Next.js と React

- Server Component を既定とし、状態、イベントハンドラ、ブラウザ API、MapLibre を使うコンポーネントだけを `"use client"` にします。
- ページ固有のロジックは `apps/web/app`、再利用するデータ取得・認証・検索ロジックは `apps/web/app/lib` に置きます。
- Route Handler は HTTP 入出力と認可を担当し、永続化の詳細を `pub-repository` へ直接書かないようにします。
- 管理 API は有効な管理者セッションを必須とし、更新系 API では `DATABASE_URL` 未設定時に書き込みを行いません。

### UI とアクセシビリティ

- 地図が利用できない環境でも、店舗一覧で必要な情報を確認できる状態を維持します。
- 操作可能な要素には目的に合う HTML 要素、ラベル、必要な ARIA 属性を使います。
- 外部リンクは `target="_blank"` を使う場合、`rel="noreferrer"` を併記します。

## 開発規約

### 作業の流れ

1. 作業前に `nvm use` で Node.js 24 系を選び、依存関係をインストールします。
2. 変更対象と影響範囲を確認し、小さく分けて実装します。
3. 挙動を変更したら対応する Vitest を追加または更新します。
4. 変更内容に応じて検証を実行し、実行結果を PR 本文へ記載します。

通常の検証コマンドは次のとおりです。

~~~bash
npm test
npm run typecheck
npm run lint
npm run build
~~~

依存関係を変更した場合は、追加で `npm audit --omit=dev` を実行します。

### ドキュメント

- 実装を変更したときは、仕様、API、セットアップ手順、構成図・シーケンス図に差分がないか確認します。
- GitHub で描画する図は Mermaid のコードブロックで記述します。
- リポジトリ内のドキュメントリンクには相対パスを使い、変更後にリンク先が存在することを確認します。
- 公開用の Production URL は README に記載できます。Preview URL、トークン、パスワード、個人を特定する情報は記載しません。

### Git と GitHub

- `main` へ直接コミットせず、`origin/main` から作成した作業ブランチで変更します。
- Issue 対応では、実装前に `scripts/comment-issue-design.sh --issue <number> --body-file <file>` で設計方針を投稿します。
- 複数行の Issue コメントと PR 本文は必ず `--body-file` を使います。`--body` にリテラルの `\n` や改行を渡しません。
- PR は `scripts/create-pr.sh` で作成し、関連 Issue、検証結果、必要な reviewer / assignee を設定します。

GitHub 操作スクリプトの `PR_REVIEWER` と `PR_ASSIGNEE` は実行環境の変数を参照します。ローカル `.env` を使う場合は、実行前にシェルへ export してください。

~~~bash
set -a
source .env
set +a
scripts/create-pr.sh --issue <number> --title "<title>" --body-file pr-body.md
~~~
