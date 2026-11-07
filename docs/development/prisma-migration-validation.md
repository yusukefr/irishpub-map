# Prisma差分Migration・復旧シナリオの検証

## 対象と前提

この手順はPrisma 8 RC Migration Graphの操作を隔離DBで実証するためのものです。既存の`db/migrations/`を使うNeon migration runbookとは別の管理系統であり、PrismaへのMigration所有権切替が完了するまでは、ここで作るMigrationをProductionまたは固定Previewへ適用しません。

検証にはProductionの実データを含まない、今回の検証専用Neon Branchを使います。既存の署名済みSchema BranchとBaseline適用済み空Branchは用途が違うため、差分適用には専用Branchを用意します。Branch名、Branch ID、親Branch、状態をNeonから読み取り確認し、固定`main` / `preview` Branch、別Issue用Branch、Production由来の行データを含むBranchは使いません。専用Branchがない場合は作成・復元を行わず、環境準備を別途行うまでDB検証を保留します。

Prisma CLIとPostgreSQL packageはlockfileで固定した版を使います。Contractと生成物、各Migrationの`migration.json`・`ops.json`は同じ変更としてレビューし、生成物を直接編集しません。

## 標準の差分検証

ContractとMigration Graphを一時作業コピーで変更し、検証後に成果物を破棄します。既存Baselineや現在の作業中Contractに検証用DDLを混ぜません。

`prisma.config.ts`には既定DB接続先を設定していません。Neon上の実DB操作は専用の[Prisma validation runner](../../scripts/run-prisma-validation.mjs)を通します。Runnerは設定Project内の明示Branch ID、用途名、`ready`状態を照合し、Production・固定Preview・別用途Branchを拒否します。data-freeの確認は呼び出し側の明示確認として要求します。Runnerは接続先の行データがないことを判定しないため、NeonのBranch名・親Branch・DB内容を事前に確認し、Productionの業務データを含まない空Branchだけを指定してください。

接続文字列はNeon CLIから取得し、一時Prisma configの子プロセス環境へだけ渡します。URIをコマンド引数やログへ出しません。`--db`、`--config`や任意Prisma引数はRunnerで拒否されます。固定Production / Previewや既存の別Issue Branchを使わず、Branch名は`validation/issue-639/`で始まるものに限定します。

RunnerはPrisma CLIをJSONモードで起動します。`status`は`app` spaceのMigration状態、Contract hashの一致、applied/pending状態、envelopeとresult双方のdiagnosticを検証し、warning・pending・未知状態・不正JSONを非0終了にします。Prisma CLIのstdout / stderrはそのまま表示せず、成功時もBranchと安全な要約だけを出します。`preview`はMigration数だけを表示するため、適用前に必ずofflineの`prisma migration show <migration-directory>`でSQLと操作をレビューします。

1. Productionデータを含まない空の専用DB Branchに現在のBaselineを適用し、Runner経由で`verify`と`status`が成功する状態を用意します。既存Schemaを持つ署名用Branchには適用しません。
2. 検証用の小さな変更を一度に一種類だけContractへ加えます。追加・変更・削除は別々に計画し、まずはnullable column、既存columnの型/制約変更、削除の順に影響を確認します。削除・型変更のSQLに既存行の消失や変換がないかをレビューします。
3. Contractをemitし、Migrationを計画します。

   ```bash
   npm run prisma:contract:emit
   npm exec --no -- prisma migration plan --name issue639_add_probe
   npm exec --no -- prisma migration check
   npm exec --no -- prisma migration show <migration-directory>
   ```

4. Migrationの`from` / `to`、生成操作、SQL preview、precheck / postcheck、およびデータ影響を確認します。データを失う操作を`--delete`で計画する場合、これは失われる値を許容する明示的な承認です。実行時の安全判定ではなく、操作が失敗する保証もありません。たとえばPostgreSQLの`text`から`varchar(n)`への明示castは、長い値を`n`文字に切り詰めて成功することがあります。`--delete`なしで計画が拒否されるケース、実行時に失敗してrollbackするケース、明示承認後に成功して値が変わるケースを区別し、実行前にSQL、対象行数、変換後の値を検証用コピーで確認します。
5. 検証Branch IDをNeonで確認し、同じBranch IDをdata-free確認値として指定します。まず`preview`で適用経路をレビューし、承認後に`apply`を実行します。

   ```bash
   VALIDATION_BRANCH_ID="br-<branch-id>" # 専用Branchの実IDに置き換える
   npm run prisma:migration:validation -- --branch-id "$VALIDATION_BRANCH_ID" --confirm-data-free "$VALIDATION_BRANCH_ID" preview
   npm run prisma:migration:validation -- --branch-id "$VALIDATION_BRANCH_ID" --confirm-data-free "$VALIDATION_BRANCH_ID" apply
   ```

6. 同じBranchを指定して`verify`と`status`を実行します。statusが目標Contract stateでappliedとなり、pending migration・diagnosticがないことを確認します。終了コードだけで成功と判断しません。

   ```bash
   npm run prisma:migration:validation -- --branch-id "$VALIDATION_BRANCH_ID" --confirm-data-free "$VALIDATION_BRANCH_ID" verify
   npm run prisma:migration:validation -- --branch-id "$VALIDATION_BRANCH_ID" --confirm-data-free "$VALIDATION_BRANCH_ID" status
   ```

7. 追加・変更・削除の各シナリオで、期待したCatalog差分と行データへの影響を専用DB上で確認します。検証後に専用Branchを保持する場合は用途・有効期限を記録し、破棄が必要ならNeonの対象Branch名・IDを再確認してから別途行います。

既存`prisma.config.ts`にはDB接続先を設定していません。RunnerはTarget / Branch検証後にだけ接続先を一時configの子プロセス環境へ渡します。Production credentialを通常のPrisma CLIへ渡さず、固定Targetへ直接接続しません。

## Graph分岐・合流

同じBaseline stateから分かれた2つの変更を、別々の作業コピーで計画します。双方のMigrationがBaselineから各変更後のContract stateへ結ぶこと、生成済みファイルの整合性を`migration check`と`migration graph`で確認します。両方を統合したContractをemitした後、分岐Aの先端から統合Contractへ向かうMigrationと、分岐Bの先端から統合Contractへ向かうMigrationをそれぞれ計画します。共通祖先から統合Contractへ計画すると3本目の分岐になるため、合流にはなりません。

```bash
npm exec --no -- prisma migration plan --from <branch-A-tip> --name issue639_merge_from_A
npm exec --no -- prisma migration plan --from <branch-B-tip> --name issue639_merge_from_B
npm exec --no -- prisma migration check
npm exec --no -- prisma migration graph
npm exec --no -- prisma migration status --from <branch-A-tip> --to @contract
npm exec --no -- prisma migration status --from <branch-B-tip> --to @contract
```

ここでの`migration status --from ... --to @contract`はofflineでGraph上の到達経路を確認します。DBに記録されたstateと適用経路はRunnerの`status` / `preview`で照合します。行き止まりMigrationや到達不能stateが残る場合は必要な合流Migrationを計画します。Migrationは時刻順の一覧ではないため、ディレクトリ名だけで適用順を判断しません。

## Driftと不正Migrationの失敗確認

失敗系は、それぞれ独立した使い捨て検証Branchで実行します。正常ケース用Branchへ不正DDLを適用しません。

- **未適用Migration:** statusがpendingを示してRunnerが非0終了することを確認します。Runnerの`preview`から適用経路を確認し、offlineの`migration show`で操作をレビューしてから適用します。適用後に再度statusを実行し、合格へ変わることを確認します。
- **Managed Schema drift:** Contract管理対象のcolumnやconstraintの定義を変え、Runnerの`verify`がschema不一致を返すことを確認します。失敗を覆い隠すために`db sign`を実行しません。
- **Extra objects:** Contractにないtable等の余剰objectは、通常のverifyではなくRunnerの`verifyStrict`（`db verify --schema-only --strict`）または独立したPostgres Catalog照合で検出します。`--strict`は他の余剰Schema要素も失敗扱いにするため、旧`schema_migrations`やPrisma管理objectが存在する署名済みBranchには適用せず、対象objectが限定された空の専用DBで使います。

  ```bash
  npm run prisma:migration:validation -- --branch-id "$VALIDATION_BRANCH_ID" --confirm-data-free "$VALIDATION_BRANCH_ID" verifyStrict
  ```

- **不正な制約変更:** データが既存制約を満たさない状態を作り、制約追加Migrationのprecheck / 実行が失敗して不整合を残さないことを確認します。
- **CHECK式とPostgreSQLの正規化:** Prismaの`contract emit`が`PN_EXACT_NAME_BODY_COMPARISON`を出した場合、`map:`で指定したCHECK式がPostgreSQLの再表示する式と完全一致するか確認します。PostgreSQLが式を正規化し、手書きの式と異なるとMigration適用時のdestination schema verificationが`MIGRATION.SCHEMA_VERIFY_FAILED`となり、transactionがrollbackされる場合があります。この警告はすべての`map:`定義が誤りという意味ではありません。DBから取得した式・名前をそのまま保持する定義と手書き定義を区別し、Catalogの`pg_get_constraintdef`とdestination Contractを照合します。物理名を固定する必要がない手書きCHECKでは、`name:`を使ってPrismaに物理名を管理させる方法も検討します。
- **非互換DDL / データ損失:** `--delete`や`--rename`なしでは、計画時に`CLI.CONSENT_REQUIRED`で拒否されるケースがあります。明示した後の適用は、データが制約に違反していてtransaction rollbackすることも、変換が成功して値を失うこともあります。たとえば`text`から`varchar(120)`へのcastは、121文字値を120文字に切り詰めて成功しました。期待結果を決めた使い捨てBranchで、Runnerの`preview`とofflineの`migration show`を照合してから適用し、失敗時はCatalog・marker・ledger・行データがrollbackされていること、成功した場合は実際の変換結果を確認します。`--delete`を使うケースは使い捨てBranchに限定します。

Runnerの終了コード、診断種別、migration ledger、Contract marker、DB Catalogの確認結果を記録します。接続先、SQL実データ、credentialは出力・Issue・PRへ記録せず、ケース名、結果、影響件数だけを残します。

## Contractを以前の状態へ戻す

Contractを以前の形に戻すときも、適用済みMigrationを編集・削除しません。Migration Graphの現在stateから旧Contract stateを目標にする新しい逆向きMigrationをオフラインで計画・レビューし、Runnerの`preview`で対象DBへの経路と操作を確認してから`apply`します。

```bash
npm exec --no -- prisma migration plan \
  --from <current-state> \
  --to <earlier-contract-state> \
  --name issue639_restore_contract
npm exec --no -- prisma migration check
npm exec --no -- prisma migration show <restore-migration-directory>
```

逆向きMigrationはSchemaを以前の形に近づける操作であり、削除済み・上書き済みの行データや過去時点の値を復元しません。DROP column、型変換、制約強化などでデータが失われた場合は、対象Branchの状態を固定してからNeonのRestore / Branch復旧でデータを戻す必要があります。Restoreは別の回復操作として扱い、戻す時刻・対象Branch・復旧後の分岐をNeon側で確認します。Prisma Migrationをデータ復元の代替に使いません。

## 完了記録

検証報告にはPrisma CLI / PostgreSQL packageの固定版、検証Branchの名前と用途（秘密情報を含まない識別情報）、Contract stateとMigration名、追加・変更・削除、Graph合流、各失敗系の結果、逆向きMigration結果を記録します。Neon Branch上で未実施のケースは成功扱いせず、未実施理由を明記します。本番Schema、行データ、旧`schema_migrations`は変更しません。

## 関連資料

- [Prisma tooling](prisma-tooling.md)
- [Prisma Baseline再構築ガイド](prisma-baseline.md)
- [Neon migration Runbook](../runbooks/neon-migrations.md)
- [Prisma ORM 8 Migration Graph](https://www.prisma.io/docs/orm/migrations/the-migration-graph)
- [Prisma ORM 8 Rollbacks and recovery](https://www.prisma.io/docs/orm/migrations/rollbacks-and-recovery)
