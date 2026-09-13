# AGENTS.md

このリポジトリで AI Agent が作業するための入口です。すべてのドキュメントを最初から読む必要はありません。まずこのファイルを確認し、現在のタスクに関係する文書だけを [Documentation Router](docs/README.md) から参照してください。

## Project

Irish Pub Map は、日本国内の Irish Pub を地図上で探せる Web アプリです。店舗データは Neon Postgres で管理し、Web と将来のモバイルアプリで共有する型やロジックは `packages/shared` に置きます。`DATABASE_URL` 未設定時は店舗0件として扱います。

主要技術は Node.js 24、npm workspaces、Next.js 16、React、TypeScript、MapLibre GL JS + OpenFreeMap（OpenMapTilesスキーマ / OpenStreetMapデータ）、Tailwind CSSです。

## Source of Truth

判断材料が矛盾する場合は、原則として次の優先順位で確認します。

1. 現在のユーザー要求 / GitHub Issue
2. 現在の実装・テスト
3. Neon の現行スキーマ・データ
4. 現行ドキュメント
5. 過去の Issue / Pull Request / Migration / 設計記録

Issue はこれから変更したい内容を表す場合があります。現行Behaviorは実装・テストを確認し、DB構造・データはNeonの現行状態を優先してください。古い設計文書と実装が矛盾する場合は、現在の実装を優先します。

Framework、Library、Vercelの仕様は、使用中のVersionに対応する公式Documentationを優先します。外部Skillは実装・設計の補助として扱います。

## Mandatory Rules

- 変更前に目的を短く説明し、不明点は仮定として明記します。自信が低い変更は先にリスクを共有します。
- 指示がない限り、このリポジトリ内だけを変更し、必要以上に変更範囲を広げません。
- 変更前に `git status --short --branch` を確認し、ユーザーや他Agentの未コミット変更を勝手に戻したり上書きしたりしません。
- `main` へ直接commitしません。Issueと関連するIssue / PR / 実装を確認し、`origin/main` 起点の `ai/<short-description>` ブランチで作業します。
- Issue対応では実装前に設計・影響範囲・検証方針を `scripts/comment-issue-design.sh --issue <number> --body-file <file>` でコメントします。
- ファイル削除、既存ファイル全体の置換、大量変更など、破壊的または復元コストの高い変更の前は確認を取り、変更は小さく分けます。
- 個人情報、アカウント名、Preview URL、credential、秘密鍵などをコード、文書、出力へ記録しません。
- コードと文書を変更したら同期要否を確認し、仕様やBehaviorに差分があれば同じ作業で更新します。
- Public UI変更前は [Design System](docs/design/README.md) を確認し、既存Token、Component、Pattern、Reference Screenを優先します。
- コミット前に `npm run check:sensitive-data` を実行し、検出回避のためにhookを無効化したり値を難読化したりしません。
- PRは `main` をbaseとし、Templateを基にした日本語の本文ファイルを `scripts/create-pr.sh` へ渡して作成します。関連Issue、検証結果、省略理由、コードと文書の同期確認を記載します。
- PR作成後または修正push後は `scripts/verify-pr-ci.sh --pr <number>` を実行します。最新HEADにCIがなければ `--dispatch` で手動CIを実行し、その旨を報告します。

## Documentation Router

詳細な参照先は [docs/README.md](docs/README.md) にあります。

| Task | Documentation |
| --- | --- |
| General development / GitHub / JSDoc | [Development conventions](docs/development/conventions.md) |
| Product behavior | [Product specification](docs/specs/product.md) |
| Public API | [API specification](docs/specs/api.md) |
| Pub data contract | [Data specification](docs/specs/data.md) |
| Database | [Database specification](docs/specs/database.md) |
| Public UI | [Design System](docs/design/README.md) |
| Privacy / Analytics | [Privacy and external transmission](docs/operations/privacy-and-external-transmission.md) |
| Development setup | [Development setup](docs/setup/development.md) |
| Deployment | [Deployment](docs/setup/deployment.md) |

`apps/web` 配下を変更するときは、同ディレクトリの `AGENTS.md` も確認し、Next.js生成ルールを維持してください。

## Validation

作業前に `nvm use` でNode.jsのVersionを合わせます。変更内容に応じて test、format check、typecheck、lint、build、E2E、Visual Regression、Accessibility、dependency auditを実行します。具体的なコマンドは [Development conventions](docs/development/conventions.md) を参照してください。

検証を省略した場合は理由をPR本文と作業報告へ記載します。
