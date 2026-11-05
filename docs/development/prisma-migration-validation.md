# Prisma差分Migration・復旧シナリオの検証

## 対象と前提

この手順はPrisma 8 RC Migration Graphの操作を隔離DBで実証するためのものです。既存の`db/migrations/`を使うNeon migration runbookとは別の管理系統であり、PrismaへのMigration所有権切替が完了するまでは、ここで作るMigrationをProductionまたは固定Previewへ適用しません。

検証にはProductionの実データを含まない、今回の検証専用Neon Branchを使います。既存の署名済みSchema BranchとBaseline適用済み空Branchは用途が違うため、差分適用には専用Branchを用意します。Branch名、Branch ID、親Branch、状態をNeonから読み取り確認し、固定`main` / `preview` Branch、別Issue用Branch、Production由来の行データを含むBranchは使いません。専用Branchがない場合は作成・復元を行わず、環境準備を別途行うまでDB検証を保留します。

Prisma CLIとPostgreSQL packageはlockfileで固定した版を使います。Contractと生成物、各Migrationの`migration.json`・`ops.json`は同じ変更としてレビューし、生成物を直接編集しません。

## 標準の差分検証

ContractとMigration Graphを一時作業コピーで変更し、検証後に成果物を破棄します。既存Baselineや現在の作業中Contractに検証用DDLを混ぜません。検証用接続先は専用の[Prisma validation config](../../config/prisma-validation.config.ts)が`PRISMA_VALIDATION_DATABASE_URL`環境変数から読み取ります。このconfigはNeonのDirect endpointだけを受け付け、URIをCLI引数へ渡しません。Config自身はBranch名を検証しないため、Neon CLIまたはMCPで専用Branchの名前・ID・親・状態を確認してからURLを注入します。

1. 空の専用DB Branchへ現在のBaselineを適用し、`db verify`と`migration status`が成功する状態を用意します。既存Schemaを持つ署名用Branchには適用しません。
2. 検証用の小さな変更を一度に一種類だけContractへ加えます。追加・変更・削除は別々に計画し、まずはnullable column、既存columnの型/制約変更、削除の順に影響を確認します。削除・型変更のSQLに既存行の消失や変換がないかをレビューします。
3. Contractをemitし、Migrationを計画します。

   ```bash
   npm run prisma:contract:emit
   npm exec --no -- prisma migration plan --name issue639_add_probe
   npm exec --no -- prisma migration check
   npm exec --no -- prisma migration show <migration-directory>
   ```

4. Migrationの`from` / `to`、生成操作、SQL preview、precheck / postcheck、およびデータ影響を確認します。承認できないDROP、truncate、暗黙変換、データ損失があれば適用せず、Contractを修正して再計画します。
5. 検証専用BranchのDirect URLをNeon CLIで解決し、`PRISMA_VALIDATION_DATABASE_URL`へSecret Injectionします。configを指定し、`db migrate --show`で適用経路を確認してから`db migrate --advance-ref db`を実行します。接続文字列をCLI引数、shell history、ログへ書きません。

   ```bash
   npm exec --no -- prisma db migrate --show --config config/prisma-validation.config.ts
   npm exec --no -- prisma db migrate --advance-ref db --config config/prisma-validation.config.ts
   ```

6. `db verify`、`migration status`、必要に応じて`migration log`を同じconfigで実行します。statusが目標Contractのapplied状態であり、pending migration・diagnosticがないことを確認します。終了コードだけで成功と判断しません。

   ```bash
   npm exec --no -- prisma db verify --config config/prisma-validation.config.ts
   npm exec --no -- prisma migration status --config config/prisma-validation.config.ts
   ```

7. 追加・変更・削除の各シナリオで、期待したCatalog差分と行データへの影響を専用DB上で確認します。検証後に専用Branchを保持する場合は用途・有効期限を記録し、破棄が必要ならNeonの対象Branch名・IDを再確認してから別途行います。

Prisma 8の実際の接続設定は利用中のCLI helpと専用configを正とします。既存`prisma.config.ts`にはDB接続先を設定していません。Production credentialを通常のPrisma CLIへ渡さず、固定Targetへ直接接続しません。

## Graph分岐・合流

同じBaseline stateから分かれた2つの変更を、別々の作業コピーで計画します。双方のMigrationがBaselineから各変更後のContract stateへ結ぶこと、生成済みファイルの整合性を`migration check`と`migration graph`で確認します。両方を統合したContractを作ったら、共通の先行stateを明示して合流Migrationを新規計画し、各変更を含む最終Contractへの到達経路を確認します。

```bash
npm exec -- prisma migration plan --from <common-state> --name issue639_merge
npm exec -- prisma migration check
npm exec -- prisma migration graph
npm exec -- prisma migration status
```

Graphに分岐がある場合、どのDB stateからどのMigrationを通るかをstatus / `db migrate --show`で適用前に確認します。行き止まりMigrationや到達不能stateが残る場合は適用せず、必要な合流Migrationを計画します。Migrationは時刻順の一覧ではないため、ディレクトリ名だけで適用順を判断しません。

## Driftと不正Migrationの失敗確認

失敗系はそれぞれ複製した使い捨て検証Branchで独立して実行します。正常ケース用Branchへ不正DDLを適用しません。

- **未適用Migration:** statusがpendingを示すことを確認します。`db migrate --show`で対象・操作を確認してから適用し、再度statusで解消を確認します。
- **Drift:** Contract外のobjectまたはContractと異なる定義を専用DBへ加え、`db verify`が差分で失敗することを確認します。失敗を覆い隠すために`db sign`を実行しません。
- **不正な制約変更:** データが既存制約を満たさない状態を作り、制約追加Migrationのprecheck / 実行が失敗して不整合を残さないことを確認します。
- **非互換DDL:** 破壊的な変更を含むMigrationを`--delete`等の明示的なデータ損失指定なしで計画し、PrismaがMigration作成を拒否することを確認します。専用Branchで、想定した危険なOperationのpreview・precheckが表示され、実行時に失敗して不整合を残さないケースも確認します。`--delete`を使うケースは使い捨てBranchに限定し、実行前に影響する行数・列・データ変換を確認します。

CLIの終了コード、診断種別、migration ledger、Contract marker、DB Catalogの確認結果を記録します。接続先、SQL実データ、credentialは出力・Issue・PRへ記録せず、ケース名、結果、影響件数だけを残します。

## Contractを以前の状態へ戻す

Contractを以前の形に戻すときも、適用済みMigrationを編集・削除しません。Migration Graphの現在stateから旧Contract stateを目標にする新しい逆向きMigrationを計画し、レビュー後に専用Branchへ適用します。

```bash
npm exec --no -- prisma migration plan \
  --from <current-state> \
  --to <earlier-contract-state> \
  --name issue639_restore_contract
npm exec --no -- prisma migration check
npm exec --no -- prisma migration show <restore-migration-directory>
```

逆向きMigrationはSchemaを以前の形に近づける操作です。削除済み・上書き済みの行データや過去時点の値を復元しません。DROP column、型変換、制約強化などでデータが失われた場合は、対象Branchの状態を固定してからNeonのRestore / Branch復旧でデータを戻す必要があります。Restoreは別の回復操作として扱い、戻す時刻・対象Branch・復旧後の分岐をNeon側で確認します。Prisma Migrationをデータ復元の代替に使いません。

## 完了記録

検証報告にはPrisma CLI / PostgreSQL packageの固定版、検証Branchの名前と用途（秘密情報を含まない識別情報）、Contract stateとMigration名、追加・変更・削除、Graph合流、各失敗系の結果、逆向きMigration結果を記録します。Neon Branch上で未実施のケースは成功扱いせず、未実施理由を明記します。本番Schema、行データ、旧`schema_migrations`は変更しません。

## 関連資料

- [Prisma tooling](prisma-tooling.md)
- [Prisma Baseline再構築ガイド](prisma-baseline.md)
- [Neon migration Runbook](../runbooks/neon-migrations.md)
- [Prisma ORM 8 Migration Graph](https://www.prisma.io/docs/orm/migrations/the-migration-graph)
- [Prisma ORM 8 Rollbacks and recovery](https://www.prisma.io/docs/orm/migrations/rollbacks-and-recovery)
