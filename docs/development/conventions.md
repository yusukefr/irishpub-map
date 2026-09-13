# コード規約・開発規約

この文書は日常的な実装・レビューの基準です。AI agent の作業手順、変更範囲、GitHub 操作、機密情報に関する必須ルールは[AGENTS.md](../../AGENTS.md)を優先します。

## コード規約

### 型とデータ

- アプリと将来のモバイルアプリで共有する店舗型・タグのロジックは `packages/shared` に置きます。
- 外部入力、JSON、API レスポンスは `unknown` として受け取り、共有の検証関数を通してから利用します。
- 店舗データのフィールドや許容値を変更するときは、[店舗データ仕様](../specs/data.md)、共有型、テストを同じ変更で更新します。
- 公開・管理データは `DATABASE_URL` が設定された Neon を正とします。未設定時は店舗0件として扱い、データをリポジトリへ複製しません。

### Next.js と React

- Server Component を既定とし、状態、イベントハンドラ、ブラウザ API、MapLibre を使うコンポーネントだけを `"use client"` にします。
- ページ固有のロジックは `apps/web/app`、再利用するデータ取得・認証・検索ロジックは `apps/web/app/lib` に置きます。
- Route Handler は HTTP 入出力と認可を担当し、永続化の詳細を `pub-repository` へ直接書かないようにします。
- 管理 API は有効な管理者セッションを必須とし、更新系 API では `DATABASE_URL` 未設定時に書き込みを行いません。

### コメントと JSDoc

- 公開関数、コンポーネント、Route Handler、および処理の意図が名前と型だけでは読み取れない箇所には、日本語の JSDoc またはコメントを記載します。
- コメントは処理の逐語的な説明ではなく、実装理由、前提条件、副作用、フォールバックやセキュリティ上の制約を説明します。
- テストでは、特殊なモックや再現条件の目的を説明し、個々のアサーションを言い換えるだけのコメントは追加しません。
- コードを変更するときは関連コメントも確認し、実装と一致しなくなった説明を更新または削除します。

### UI とアクセシビリティ

- Public UIのブランド、Token、Component、画面Pattern、Reference Screenは[Irish Pub Map Design System](../design/README.md)をSource of Truthとします。
- 地図が利用できない環境でも、店舗一覧で必要な情報を確認できる状態を維持します。
- 操作可能な要素には目的に合う HTML 要素、ラベル、必要な ARIA 属性を使います。
- 操作領域は原則44px以上とし、Keyboardで操作できること、`:focus-visible`でFocusを確認できること、状態が色だけに依存しないことを維持します。
- 狭い画面ではDOMの読み順を保ち、Page全体の横scrollや固定・浮動要素の重なりを起こしません。
- 視覚的な変更は、関係する挙動テストに加えてDesktop幅と390px程度のMobile幅で確認し、読み込み、主要操作、横overflow、error overlayの有無を確認します。
- 外部リンクは `target="_blank"` を使う場合、`rel="noreferrer"` を併記します。

### 公開画面のデザイン基準

新しい部品を作る前に[Public UI Components](../design/components.md)の既存Component・Variantを確認し、色・寸法は[Design Tokens](../design/tokens.md)、画面構成は関係する[Screen Pattern](../design/README.md#documentation-map)を参照します。Design Systemにない判断が必要な場合は[追加ルール](../design/README.md#新しいtokenとcomponent)に従い、実装と文書を同時に更新します。

参考: [デジタル庁デザインシステム](https://design.digital.go.jp/dads/)

## 開発規約

### 作業の流れ

1. 作業前に `nvm use` で Node.js 24 系を選び、依存関係をインストールします。
2. 変更対象と影響範囲を確認し、小さく分けて実装します。
3. 挙動を変更したら対応する Vitest を追加または更新します。
4. 変更内容に応じて検証を実行し、実行結果を PR 本文へ記載します。

通常の検証コマンドは次のとおりです。

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

依存関係を変更した場合は、追加で `npm audit --omit=dev` を実行します。

### Neon Migration

Schema変更はProduction Branchへ直接適用せず、Branch-firstで検証します。具体的なMigrationの適用、Schema確認、接続先の切替、復旧手順は[Neon Migration Runbook](../runbooks/neon-migrations.md)を参照してください。

### Neon Branchの利用方針

Neon BranchはSchema変更やMigrationの検証に必要な場合だけ作成し、通常のApplication、UI、ドキュメント変更では作成しません。Preview環境の固定Branch運用と上限対策は[Neon Preview DB Runbook](../runbooks/neon-preview-branch.md)を参照してください。

### ドキュメント

- 実装を変更したときは、仕様、API、セットアップ手順、構成図・シーケンス図に差分がないか確認します。
- GitHub で描画する図は Mermaid のコードブロックで記述します。
- リポジトリ内のドキュメントリンクには相対パスを使い、変更後にリンク先が存在することを確認します。
- 公開用の Production URL は README に記載できます。Preview URL、トークン、パスワード、個人を特定する情報は記載しません。

### Git と GitHub

- `main`へ直接コミットせず、`origin/main`から作成した作業ブランチで変更します。
- GitHub Issueのタイトルは原則として日本語で作成し、`[AI Task]` や `[Bug]` などの接頭辞は英語のまま使用できます。
- Issue対応では、実装前に設計コメントを投稿し、PRには関連Issue、検証結果、省略理由、コードと文書の同期確認を記載します。
- IssueコメントとPR本文はTemplateおよびリポジトリのスクリプトを使います。AI AgentのGitHub操作に関する必須ルールと具体的な手順はrootの[AGENTS.md](../../AGENTS.md)を参照し、CI確認は[Release and CI Runbook](../runbooks/release-operations.md)を参照してください。

### ESLint と JSDoc

- ESLint の設定はリポジトリルートの `eslint.config.mjs` で管理し、Web アプリと `packages/shared/src` を同じルールで検査します。
- 公開された関数、コンポーネント、Route Handler、共有パッケージの公開型を JSDoc の対象とします。内部のイベントコールバック、局所的な変換関数、無名関数へ一律のコメントは要求しません。
- 公開関数の JSDoc には目的を記載し、引数がある場合は `@param`、戻り値がある場合は `@returns` を付けます。説明は型だけでは分からない前提、失敗時の扱い、副作用を優先します。
- 採用ルールは、JSDoc の整列・タグ名・引数名・説明・JSDoc・`@param`・`@returns` の検査と、ESLint コアの `no-eval`、`no-implied-eval`、`no-new-func`、`no-script-url`、`no-promise-executor-return` です。
- `@typescript-eslint/no-misused-promises`、`eslint-plugin-security`、`eslint-plugin-react`、`no-console`、`no-await-in-loop` は、型認識設定・誤検知・互換性・既存の正当な用途を考慮して見送ります。Prettier のルールは ESLint に重複させません。
