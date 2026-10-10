# Neon migrationを適用する

## Purpose

`db/migrations/`にあるSQL migrationを対象Neon Branchへ安全に適用し、schemaとアプリケーションの互換性を確認します。migration履歴とSQLは`db/migrations/`がSource of Truthです。

## When to use

- PRがDB schema、constraint、index、参照データに影響する場合
- 新しいアプリケーションを、必要なmigrationが未適用のNeon Branchへデプロイする前

通常のアプリケーション変更や文書変更では実行しません。

## Prerequisites

- 対象が検証用Branch、Preview用固定Branch、Productionのどれかを明確にしている。
- Repositoryの固定バージョンNeon CLIはdevDependencyとして管理する。managed worktreeでは`npm ci`で導入し、Global installは不要。LocalではCLI Profile、AI / Remoteでは`NEON_API_KEY` Secret Injectionで認証する。Project-scoped Credentialを優先する。
- `config/neon-targets.json` にProject IDとPreview / Production Branch名が定義されている。Branch IDは保存せず、Resolverが実行時にNeonから取得する。
- migration SQLと対応する`*_verify.sql`を確認済みである。
- `.env.local` / `.env.development.local` はApplicationのローカル開発用であり、Migration / Schema操作では使用しない。
- Productionへ直接試行せず、先に通常Neon BranchまたはSchema-only Branchで検証している。

## Procedure

1. 変更対象Migrationまでの履歴と接続先を、書き込み前に読み取り専用Preflightで確認する。

```bash
npm run db:preflight -- --target preview --required-migration 024_add_pub_types
```

`--required-migration`には`db/migrations/`内の`*_up.sql`ファイル名から`_up.sql`を除いた値を指定します。PreflightはRepository内のMigration一覧と`schema_migrations`を比較し、対象より前に適用が必要なMigrationのうち未適用のものを列挙して停止します。対象Migration自身は適用前でも成功します。DBへは`BEGIN READ ONLY`のSELECTだけを行い、Branch作成・切替やSchema変更をしません。Preflightが成功しても対象SQLの内容確認とverify SQLの実行は必要です。

2. 共通ResolverがRepository設定からProject / Branch名を読み、Neon CLIで認証・Branch ID・ready状態・Direct / Unpooled接続先を解決・検証する。Preflightの結果で接続する正確なBranch名とIDを確認する。
3. Previewでup SQLとverify SQLを順に適用する。

```bash
npm run db:connection-check -- --target preview
npm run db:migrate -- --target preview db/migrations/<migration>_up.sql
npm run db:migrate -- --target preview db/migrations/<migration>_verify.sql
```

4. table、constraint、index、外部キー、必要な参照データ、`schema_migrations`をverify SQLで確認する。新規作成・更新するverify SQLは、結果行の目視確認に依存せず、不足や不整合があれば`RAISE EXCEPTION`で失敗する自己検証型にする。006 / 007のverify SQLをこの形式の例とする。Migration Runnerは結果行や機微なDBデータを出力しません。
5. 関連するアプリケーション、unit test、E2Eを検証する。
6. Preview検証に成功し、Production適用への明示承認がある場合だけ、Production Guard付きでup / verifyを実行する。PreviewとProductionではMigration履歴が異なる可能性があるため、それぞれのTargetで適用前にPreflightを実行する。Previewの成功をProductionの履歴確認の代わりにしない。

```bash
npm run db:preflight -- --target production --required-migration 024_add_pub_types
npm run db:connection-check -- --target production
npm run db:migrate -- --target production --confirm-production db/migrations/<migration>_up.sql
npm run db:migrate -- --target production --confirm-production db/migrations/<migration>_verify.sql
```

Production Migrationは`--target production`と`--confirm-production`の両方が必須です。

### 適用済み相当のスキーマとMigration履歴欠落を調査する

PreflightがMigration履歴の欠落を報告しても、対象Migrationの`*_up.sql`や`*_verify.sql`をそのまま再実行しません。旧スキーマを前提とする処理や`DROP COLUMN`を含むMigrationは、現在のSchemaに適用できず、データを破壊する可能性があります。

Migration 006 / 007の履歴欠落を調べる場合は、各Branchで以下の読み取り専用SQLを個別に実行します。

```text
db/operations/006_007_history_reconciliation_check.sql
```

SQLクライアントでは`BEGIN READ ONLY`から開始し、実行後に`ROLLBACK`します。接続Target、Branch名、Branch ID、状態を先に確認し、Production `main`、設定上の固定Preview `preview`、PR専用Previewを混同しないでください。このSQLは翻訳の網羅性、孤児行、`municipality_code`、006 / 007で導入・保持される関連制約とIndex、旧表示Columnの不在を検査します。各行の`passed`がtrueであることを確認します。006 / 007の`schema_migrations`有無は、他の検査結果と分けて表示されます。

履歴補正を試す場合は、次をすべて満たすときに限ります。

1. 同じTargetの最新状態を読み取り専用で確認し、006 / 007の履歴行チェック以外がすべてtrueで、006 / 007の履歴行だけが不足している。
2. 後続Migrationの状態やGitHub Issue / PR / Git履歴も確認し、Branch固有の差分を別途記録している。後続Versionがあることだけで、006 / 007の実行証拠とみなさない。
3. Production / Previewと異なる検証用Branchを明示し、そのBranchのProject、親Branch、Branch ID、状態を確認する。
4. 検証用Branchでも事前検査を再実行し、次のSQLで返る行が不足Versionだけであることを確認する。書き込みは当該履歴行だけに限定し、翻訳・店舗・参照データ・Schemaには触れない。

```sql
INSERT INTO schema_migrations (version)
VALUES ('006_localize_display_data'), ('007_finalize_localization')
ON CONFLICT (version) DO NOTHING
RETURNING version;
```

`RETURNING`が返すVersionを補正記録に残します。`applied_at`は補正時刻になるため、実際のMigration実行時刻として扱いません。

5. 運用記録に「Migrationの実行を確認した」ではなく「現在の実態検査に基づき履歴を後追いで整合させた」と明記する。日時、Project / Branch名とID、実行者、承認者、検査結果、補正前後のVersion一覧を残す。原因が分からない場合は未確定と記す。

検証用Branchで不整合、予期しない不足Version、接続先の曖昧さがあれば停止します。検証Branchで結果をレビューした後も、ProductionとPreviewへの書き込みはBranchごとの明示承認を取得するまで行いません。PRのマージ、CI、Preflightは履歴補正を実行しません。承認後は各Branchで直前に事前検査を再実行し、承認された対象だけを補正します。補正後は同SQLでデータとSchemaの状態を確認し、`db:preflight -- --required-migration 025_convert_automation_resource_ids_to_uuid`をTargetごとに実行します。別Versionの不足が見つかったら作業を拡張せず、別Issueとして扱います。

補正を誤った可能性がある場合は、Productionで履歴行を即時削除したり、旧Migrationを逆実行したりしません。対象Branchと監査記録を再確認し、専用の回復手順と承認を決めます。

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

接続診断の主なエラーと次の手順:

| Error | 次の手順 |
| --- | --- |
| `NEON_CLI_NOT_INSTALLED` | Repository rootで`npm ci`を実行し、再試行する。 |
| `NEON_AUTH_UNAVAILABLE` | `NEON_API_KEY` Secret Injectionを確認する。対話可能な端末では`neon auth`で認証してから再試行する。 |
| `NEON_PROJECT_ACCESS_DENIED` | Project IDを確認し、Neon Credentialに対象Projectへのアクセス権があることを確認する。 |
| `NEON_BRANCH_NOT_FOUND` | Targetと`config/neon-targets.json`のBranch名、Project IDを確認する。 |
| `NEON_BRANCH_NOT_READY` | 表示されたBranch状態をMCPまたはNeon Consoleで確認し、readyになるまで停止する。 |
| `NEON_CONNECTION_FAILED` | Direct endpoint、接続権限、ネットワークを確認する。CLI stderrや接続URIは共有しない。 |
| `MIGRATION_PREREQUISITE_MISSING` | 表示された不足Migrationを対象Branchに順番に適用・検証してから再度Preflightする。 |

## Local Application Development

`.env.development.local`（Preview）と`.env.local`（Production）は、Applicationのローカル実行に引き続き利用できます。このenvファイル運用はMigration / Schema操作には適用しません。

## AI / Remote

- managed worktreeへGit管理外envが継承されない場合があります。正式なTarget解決はworktree内envに依存しません。
- `NEON_API_KEY`を実行環境のSecretとして注入し、可能な限りProject-scoped Credentialを利用します。
- Neon MCPがAgentに公開されている場合、CLI障害時の読み取り専用補助経路として使用できます。`config/neon-targets.json`の`projectId`を指定し、`list_branches(project_id)`でBranch名・ID・状態を確認します。Project一覧取得Toolの公開を前提にしません。Project IDはRepository設定を使い、MCPがProject-scopedであっても設定値と一致するか確認します。
- CLIとMCPの認証および公開Tool範囲は別です。CLIの認証がMCPを有効にするわけではなく、MCPの読み取りToolだけでRepository CLIのDB接続や書込みが可能になるわけでもありません。MCPが読み取り専用の場合、別の書込経路やProductionへ暗黙に切り替えません。
- `preview` Targetは`config/neon-targets.json`に固定されたBranch名を指します。PRごとの`preview/<branch>`と同一とは限らず、Resolverは設定Branchがない場合やreadyでない場合に停止します。PR Branchを調査するときはBranch名/IDを明示して読み取り確認し、Target設定を変更したり別Branchへ自動切替したりしません。
- 「接続できない」で終了する前に、順に確認します: (1) `npm ci`後のローカルCLI起動、(2) `NEON_API_KEY` Secretまたはローカルでの`neon auth`、(3) `config/neon-targets.json`のTarget / Project ID、(4) 正確なBranch名・IDと`ready`状態、(5) `db:preflight`のMigration履歴、(6) Neon MCPのTool公開状況とProject指定の読み取り代替可否。秘密値やCLI stderrはログに残さず、原因分類と次の対処を使います。
- Preflightの失敗を受けてBranchを作成・削除・復元したり、Migrationを適用したりしません。これらは独立した承認とRunbook手順が必要です。

## Related docs

- [通常デプロイ](../setup/deployment.md)
- [Database specification](../specs/database.md)
- [Generated database schema](../generated/database-schema.md)
- [Neon Branchの利用方針](../development/conventions.md#neon-branchの利用方針)
