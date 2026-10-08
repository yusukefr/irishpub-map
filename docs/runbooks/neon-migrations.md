# Neon migrationを適用する

## Purpose

`db/migrations/`にあるSQL migrationを対象Neon Branchへ安全に適用し、schemaとアプリケーションの互換性を確認します。migration履歴とSQLは`db/migrations/`がSource of Truthです。

## When to use

- PRがDB schema、constraint、index、参照データに影響する場合
- 新しいアプリケーションを、必要なmigrationが未適用のNeon Branchへデプロイする前

通常のアプリケーション変更や文書変更では実行しません。

## Prerequisites

- 対象が検証用Branch、Preview用固定Branch、Productionのどれかを明確にしている。
- Neon CLIをインストールし、LocalではCLI Profile、AI / Remoteでは`NEON_API_KEY` Secret Injectionで認証する。Project-scoped Credentialを優先する。
- `config/neon-targets.json` にProject IDとPreview / Production Branch名が定義されている。Branch IDは保存せず、Resolverが実行時にNeonから取得する。
- migration SQLと対応する`*_verify.sql`を確認済みである。
- `.env.local` / `.env.development.local` はApplicationのローカル開発用であり、Migration / Schema操作では使用しない。
- Productionへ直接試行せず、先に通常Neon BranchまたはSchema-only Branchで検証している。

## Procedure

1. `--target preview|production`を明示し、接続先と現在のmigration状態を確認する。
2. 共通ResolverがRepository設定からProject / Branch名を読み、Neon CLIで現在のBranch IDとDirect / Unpooled接続先を解決・検証する。
3. Previewにup SQLとverify SQLを順に適用する。

```bash
npm run db:connection-check -- --target preview
npm run db:migrate -- --target preview db/migrations/<migration>_up.sql
npm run db:migrate -- --target preview db/migrations/<migration>_verify.sql
```

4. table、constraint、index、外部キー、必要な参照データ、`schema_migrations`をverify SQLで確認する。新規作成・更新するverify SQLは、結果行の目視確認に依存せず、不足や不整合があれば`RAISE EXCEPTION`で失敗する自己検証型にする。006 / 007のverify SQLをこの形式の例とする。Migration Runnerは結果行や機微なDBデータを出力しません。
5. 関連するアプリケーション、unit test、E2Eを検証する。
6. Preview検証に成功し、Production適用への明示承認がある場合だけ、Production Guard付きでup / verifyを実行する。

```bash
npm run db:connection-check -- --target production
npm run db:migrate -- --target production --confirm-production db/migrations/<migration>_up.sql
npm run db:migrate -- --target production --confirm-production db/migrations/<migration>_verify.sql
```

Production Migrationは`--target production`と`--confirm-production`の両方が必須です。

Schema文書を更新するときはProductionをSource of Truthとして生成します。

```bash
npm run db:schema -- --target production
npm run check:database-schema
```

Vercelは`db/migrations/`を自動適用しません。アプリをデプロイする前に、対象Branchへの適用と検証を完了します。

## Validation

- 自己検証型のverify SQLは正常終了する。
- 既存のSELECT結果確認型verify SQL（例: `001_pubs_columns_verify.sql`、`002_normalize_pub_metadata_verify.sql`）は、Migration Runnerの終了コードだけで検証完了と判断しない。Runnerは結果行を表示しないため、別途安全なSQLクライアントで結果を確認するか、実行前に自己検証型へ更新する。
- 接続先が意図したNeon Branchである。
- 必要なアプリケーション検証が成功する。
- schema documentationを更新する必要がある場合は、現行Neon schemaから再生成し、差分を確認する。

## Rollback / Recovery

- Productionで失敗を試行してrollbackする運用は行わない。検証Branchで手順と影響を確認する。
- アプリケーションだけをrollbackする場合、公開状態や下書きを失わないよう、追加済みcolumnやconstraintを安易に削除しない。
- 失敗時は対象Branch、適用済みSQL、verify結果を確認し、必要に応じて専用Issueで回復策を決める。

## Security notes

- Connection String、Password、API Key、Token、query結果に含まれる機微情報を文書、ログ、Issue、PRへ残さない。CLIは接続文字列を表示しない。
- `NEON_API_KEY`はSecret Injectionし、コマンドライン引数やshell historyへ直接書かない。
- managed worktreeにenvファイルがなくても、envコピーを作らずNeon CLI認証を確認する。
- Production / Preview / 検証用Branchを取り違えない。削除や破壊的SQLの前に対象resourceを再確認する。

## Local Application Development

`.env.development.local`（Preview）と`.env.local`（Production）は、Applicationのローカル実行に引き続き利用できます。このenvファイル運用はMigration / Schema操作には適用しません。

## AI / Remote

- managed worktreeへGit管理外envが継承されない場合があります。正式なTarget解決はworktree内envに依存しません。
- `NEON_API_KEY`を実行環境のSecretとして注入し、可能な限りProject-scoped Credentialを利用します。
- Neon MCPは利用可能な場合にBranch確認やDB調査の補助として使えます。Repository scriptの接続経路はNeon CLIです。
- 接続確認に失敗した場合はenvファイルを探すのではなく、Neon CLIの導入、ProfileまたはAPI Key認証、Repository Target定義を確認します。

## Related docs

- [通常デプロイ](../setup/deployment.md)
- [Database specification](../specs/database.md)
- [Generated database schema](../generated/database-schema.md)
- [Neon Branchの利用方針](../development/conventions.md#neon-branchの利用方針)
