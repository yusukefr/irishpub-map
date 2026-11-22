# Prisma 8 RC tooling

## 目的と境界

Prisma ORM 8 RCはSchema ContractとMigration Graphを扱う開発・運用ツールです。現行のNeon SQL Repository、`@neondatabase/serverless`によるApplication接続、CRUD経路は変更しません。新しいSchema変更の唯一の作成・適用元はPrisma Migration Graphです。Prisma ClientをApplicationから使う作業は対象外です。

Prisma 8 RCは互換性を保証する正式版ではありません。2026-10-13時点で確認したCLI `prisma@8.0.0-rc.22` とPostgreSQL package `@prisma/orm-postgres@8.0.0-rc.17` は別々に版が進むため、`package.json`とlockfileの両方で個別に完全固定します。CLIのNode.js要件は`>=22.18.0`で、このRepositoryが固定するNode.js 24系を満たします。正式版への更新は別タスクとし、設定API、Contract構文、CLI command、生成物、Neon接続を改めて検証します。

## 配置

- `prisma.config.ts`: Prisma 8設定。Contractと出力先を定義します。意図的に既定DB接続先を設定しません。
- `config/prisma-baseline-verify.config.ts`: 隔離Baseline検証コマンド専用設定。`parent: false`で既定設定を継承せず、ContractとMigration directoryを明示し、環境変数からDirect endpointを読み取ります。
- `db/prisma/contract.prisma`: Prisma 8形式のContract。Productionの現行Schemaとの照合は[Contract audit](prisma-contract-audit.md)に記録しています。
- `generated/prisma8/`: `contract emit`が生成するContract artifactと型の出力先。

Contractと `generated/prisma8/contract.json` / `contract.d.ts` はGit管理し、`npm run prisma:contract:emit`で再生成・整形してContract変更と同じPRで差分レビューします。現行Productionとの照合と表現差分は[Prisma Contract schema照合記録](prisma-contract-audit.md)を参照してください。

## コマンド

```bash
npm run prisma:version
npm run prisma:help
npm run prisma:contract:emit
npm run prisma:migration:check
```

`prisma:migration:check`はContractを再emitし、`migration plan`を作業ツリー内で実行して未commitのMigration生成を検出し、最後に`migration check --space app`でGraph integrityを確認します。すべてDB接続なしです。CIはNeon credentialを持たず、生成物をcommitせず、planが新規Migrationを作った場合は失敗します。Contract変更とMigration authoringは同じPRで行い、生成SQL / TypeScript、`ops.json`、snapshotをレビューします。引数や動作はlockfileで固定したCLIのhelpと実行結果を正とします。

## Neon接続

この設定では`db.connection`を設定しません。DBを使うPrisma CLIコマンドは直接実行せず、`npm run prisma:migration:run`を通します。Runnerは`config/neon-targets.json`と共通Neon Target Resolverで固定TargetのProject / Branch / ready状態を解決し、Direct endpointを一時configの子プロセス環境だけに渡します。接続文字列をCLI引数、ログ、Git管理ファイルへ出しません。通常PR CIにはNeon credentialもDB接続権限もありません。

`npm run prisma:migration:run -- --target preview preview|apply|verify|status|log`のうち`preview`, `verify`, `status`, `log`は状態確認、`apply`はMigration適用です。Productionの`apply`は`--confirm-production <configured-branch-name>`を追加し、**対象Branchの状態確認、Previewでの適用と検証、main向けPR review / mergeの後に、その適用ごとに明示して実行**します。RunnerはConfirmation値を設定済みProduction Branch名と照合します。CIからProduction operationは呼び出しません。

`prisma db sign`はこのRunnerのallowlistにありません。Production Signが別途必要になった場合は、read-only state照合・専用PR review / merge・Branch再照合・個別の明示承認を先に完了する専用手順を用意します。一般のPR CIやRelease WorkflowからSign / Migrationを起動しません。

`npm run prisma:baseline:verify`は例外的なread-only検証経路です。設定Project内のBranch IDをNeon CLIで解決し、固定Preview / Productionを拒否してDirect endpointを選びます。操作は`db verify`と`migration status`に限定されます。

差分Migration、Graph合流、drift・失敗系、Contractを戻すMigrationの検証シナリオは[差分Migration・復旧シナリオ](prisma-migration-validation.md)に従います。Issue #639専用の`prisma:migration:validation`は明示Branch ID・用途名・ready状態・data-free確認を満たす検証Branch用です。通常のPreview / Production運用には`prisma:migration:run`を使います。
