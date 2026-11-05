# Prisma差分Migration・復旧シナリオの検証

## 対象と前提

この手順はPrisma 8 RC Migration Graphの操作を隔離DBで実証するためのものです。既存の`db/migrations/`を使うNeon migration runbookとは別の管理系統であり、PrismaへのMigration所有権切替が完了するまでは、ここで作るMigrationをProductionまたは固定Previewへ適用しません。

検証にはProductionの実データを含まない、今回の検証専用Neon Branchを使います。既存の署名済みSchema BranchとBaseline適用済み空Branchは用途が違うため、差分適用には専用Branchを用意します。Branch名、Branch ID、親Branch、状態をNeonから読み取り確認し、固定`main` / `preview` Branch、別Issue用Branch、Production由来の行データを含むBranchは使いません。専用Branchがない場合は作成・復元を行わず、環境準備を別途行うまでDB検証を保留します。

Prisma CLIとPostgreSQL packageはlockfileで固定した版を使います。Contractと生成物、各Migrationの`migration.json`・`ops.json`は同じ変更としてレビューし、生成物を直接編集しません。

## 標準の差分検証

ContractとMigration Graphを一時作業コピーで変更し、検証後に成果物を破棄します。既存Baselineや現在の作業中Contractに検証用DDLを混ぜません。

**現在、このRepositoryにはDB操作時にBranch IDを検証するPrisma Migration Runnerがありません。`prisma.config.ts`にもDB接続先はありません。そのため、以下の手順にあるNeon上の適用・verify・status・失敗系操作はRunnerが実装されるまで実行不可です。** DB URLを任意の環境変数や`--db`引数で直接Prisma CLIへ渡さず、Production・固定Preview・既存の別Issue Branchへ接続しません。オフラインのMigration計画・Graph検査だけを実行できます。

1. 事前条件として、Productionデータを含まない空の専用DB Branchに現在のBaselineが適用され、`db verify`と`migration status`が成功する状態を用意します。既存Schemaを持つ署名用Branchには適用しません。現状は専用Runnerがないため、この準備作業も実行しません。
2. 検証用の小さな変更を一度に一種類だけContractへ加えます。追加・変更・削除は別々に計画し、まずはnullable column、既存columnの型/制約変更、削除の順に影響を確認します。削除・型変更のSQLに既存行の消失や変換がないかをレビューします。
3. Contractをemitし、Migrationを計画します。

   ```bash
   npm run prisma:contract:emit
   npm exec --no -- prisma migration plan --name issue639_add_probe
   npm exec --no -- prisma migration check
   npm exec --no -- prisma migration show <migration-directory>
   ```

4. Migrationの`from` / `to`、生成操作、SQL preview、precheck / postcheck、およびデータ影響を確認します。承認できないDROP、truncate、暗黙変換、データ損失があれば適用せず、Contractを修正して再計画します。
5. 実DB検証はBranch IDを設定Project内で検証し、`ready`・固定Production/Preview以外・用途を確認した後にだけDirect endpointを子プロセス環境へ渡す専用Runnerで行う必要があります。Runnerが未実装の現状では`db migrate`、`db verify`、DBを読む`migration status` / `migration log`は実行しません。Runnerが実装された後は適用経路を先に確認し、Migration適用後にverify / statusで目標Contract stateとpendingの有無を確認します。

6. 追加・変更・削除の各シナリオで、期待したCatalog差分と行データへの影響を専用DB上で確認します。検証後に専用Branchを保持する場合は用途・有効期限を記録し、破棄が必要ならNeonの対象Branch名・IDを再確認してから別途行います。

既存`prisma.config.ts`にはDB接続先を設定していません。将来Runnerを追加する場合は利用中のCLI helpに合わせ、Target / Branch検証後にのみ接続先を子プロセス環境へ渡します。Production credentialを通常のPrisma CLIへ渡さず、固定Targetへ直接接続しません。

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

ここでの`migration status --from ... --to @contract`はofflineでGraph上の到達経路を確認します。DBに記録されたstateと適用経路を比較する確認は専用Runner実装まで保留します。行き止まりMigrationや到達不能stateが残る場合は必要な合流Migrationを計画します。Migrationは時刻順の一覧ではないため、ディレクトリ名だけで適用順を判断しません。

## Driftと不正Migrationの失敗確認

失敗系は、それぞれ独立した使い捨て検証Branchで実行するシナリオです。Runner実装前はDB接続・書込みを行わず、以下の結果を実証済みとして報告しません。

- **未適用Migration:** statusがpendingを示すことを確認します。専用Runnerで`db migrate --show`から対象・操作を確認してから適用し、再度statusで解消を確認します。
- **Managed Schema drift:** Contract管理対象のcolumnやconstraintの定義を変え、通常の`db verify`がschema不一致を返すことを確認します。失敗を覆い隠すために`db sign`を実行しません。
- **Extra objects:** Contractにないtable等の余剰objectは、通常の`db verify`ではなく`db verify --schema-only --strict`または独立したPostgres Catalog照合で検出します。`--strict`は他の余剰Schema要素も失敗扱いにするため、旧`schema_migrations`やPrisma管理objectが存在する署名済みBranchには適用せず、対象objectが限定された空の専用DBで使います。
- **不正な制約変更:** データが既存制約を満たさない状態を作り、制約追加Migrationのprecheck / 実行が失敗して不整合を残さないことを確認します。
- **非互換DDL:** 破壊的な変更を含むMigrationを`--delete`等の明示的なデータ損失指定なしで計画し、PrismaがMigration作成を拒否することを確認します。専用Branchで、想定した危険なOperationのpreview・precheckが表示され、実行時に失敗して不整合を残さないケースも確認します。`--delete`を使うケースは使い捨てBranchに限定し、実行前に影響する行数・列・データ変換を確認します。

専用Runnerで検証した際は、CLIの終了コード、診断種別、migration ledger、Contract marker、DB Catalogの確認結果を記録します。接続先、SQL実データ、credentialは出力・Issue・PRへ記録せず、ケース名、結果、影響件数だけを残します。

## Contractを以前の状態へ戻す

Contractを以前の形に戻すときも、適用済みMigrationを編集・削除しません。Migration Graphの現在stateから旧Contract stateを目標にする新しい逆向きMigrationをオフラインで計画・レビューします。DBへの適用は専用Runner実装まで行いません。

```bash
npm exec --no -- prisma migration plan \
  --from <current-state> \
  --to <earlier-contract-state> \
  --name issue639_restore_contract
npm exec --no -- prisma migration check
npm exec --no -- prisma migration show <restore-migration-directory>
```

これらはMigration Graphを作るoffline手順です。DBへの適用は専用Runner実装まで行いません。逆向きMigrationはSchemaを以前の形に近づける操作であり、削除済み・上書き済みの行データや過去時点の値を復元しません。DROP column、型変換、制約強化などでデータが失われた場合は、対象Branchの状態を固定してからNeonのRestore / Branch復旧でデータを戻す必要があります。Restoreは別の回復操作として扱い、戻す時刻・対象Branch・復旧後の分岐をNeon側で確認します。Prisma Migrationをデータ復元の代替に使いません。

## 完了記録

検証報告にはPrisma CLI / PostgreSQL packageの固定版、検証Branchの名前と用途（秘密情報を含まない識別情報）、Contract stateとMigration名、追加・変更・削除、Graph合流、各失敗系の結果、逆向きMigration結果を記録します。Neon Branch上で未実施のケースは成功扱いせず、未実施理由を明記します。本番Schema、行データ、旧`schema_migrations`は変更しません。

## 関連資料

- [Prisma tooling](prisma-tooling.md)
- [Prisma Baseline再構築ガイド](prisma-baseline.md)
- [Neon migration Runbook](../runbooks/neon-migrations.md)
- [Prisma ORM 8 Migration Graph](https://www.prisma.io/docs/orm/migrations/the-migration-graph)
- [Prisma ORM 8 Rollbacks and recovery](https://www.prisma.io/docs/orm/migrations/rollbacks-and-recovery)
