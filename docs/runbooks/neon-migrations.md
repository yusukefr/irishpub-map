# Neon migrationを適用する

## Purpose

新しいSchema変更はPrisma 8 Contract / Migration Graphを対象Neon Branchへ適用し、SchemaとApplicationの互換性を確認します。`migrations/`が新規Schema変更のSource of Truthです。`db/migrations/`と`schema_migrations`は旧SQL方式の001〜025を保持する履歴資産であり、新しいSQL Migrationを追加・適用しません。

## When to use

- PRがDB schema、constraint、index、参照データに影響する場合
- 新しいアプリケーションを、必要なmigrationが未適用のNeon Branchへデプロイする前

通常のアプリケーション変更や文書変更では実行しません。

## Prerequisites

- 対象が検証用Branch、Preview用固定Branch、Productionのどれかを明確にしている。
- Repositoryの固定バージョンNeon CLIはdevDependencyとして管理する。managed worktreeでは`npm ci`で導入し、Global installは不要。LocalではCLI Profile、AI / Remoteでは`NEON_API_KEY` Secret Injectionで認証する。Project-scoped Credentialを優先する。
- `config/neon-targets.json` にProject IDとPreview / Production Branch名が定義されている。Branch IDは保存せず、Resolverが実行時にNeonから取得する。
- Contractと生成されたMigration packageをPRでレビューしている。
- `.env.local` / `.env.development.local` はApplicationのローカル開発用であり、Migration / Schema操作では使用しない。
- Productionへ直接試行せず、先に通常Neon BranchまたはSchema-only Branchで検証している。

## Procedure

1. Contractを変更し、Artifactをemitし、Migrationをローカルで計画します。CLIはDBへ接続しません。

```bash
npm run prisma:contract:emit
npm exec --no -- prisma migration plan --name <migration-name>
npm exec --no -- prisma migration show <migration-directory>
npm exec --no -- prisma migration check --space app
```

2. Migration packageをレビューします。`migration plan`が新しいpackageを作ったら、操作・DDL・data transform・precheck・postcheckを同じPRへ含めて再度checkします。通常PR CIはContract artifact再生成、offline plan、Migration Graph checkを実行し、Neon credentialやDB接続権限を持ちません。
3. Preview TargetのBranch名・ID・ready状態を確認し、`status`と`preview`を実行して適用前状態と計画を記録します。

```bash
npm run prisma:migration:run -- --target preview status
npm run prisma:migration:run -- --target preview preview
```

4. Previewへ適用し、Migration statusとContract verifyを確認します。

```bash
npm run prisma:migration:run -- --target preview apply
npm run prisma:migration:run -- --target preview status
npm run prisma:migration:run -- --target preview verify
```

5. Application test/buildと必要なPreview smoke checkを完了し、適用前後の状態・Migration・verify結果をPRへ記録します。
6. Productionでは、対象Branchの現在stateとMigration planを改めて確認し、Preview適用成功・PRレビュー・mainへのmerge後に個別の適用承認を得ます。状態確認後に別の変更が入った場合は、差分とplanを再確認してから明示承認します。適用コマンドのconfirmationはその1回だけ有効です。

```bash
npm run prisma:migration:run -- --target production status
npm run prisma:migration:run -- --target production preview
# state確認、PR review / merge、個別の明示承認後に実行
npm run prisma:migration:run -- --target production --confirm-production <configured-production-branch-name> apply
npm run prisma:migration:run -- --target production status
npm run prisma:migration:run -- --target production verify
```

Production対象のapplyは`--confirm-production`が要求され、設定済みProduction Branch名と一致しない場合は拒否します。PR CI、Release workflow、VercelからMigrationを自動実行しません。確認したBranch state・review済みPR・適用対象migration・個別承認を作業記録に含めます。

`prisma db sign`は通常Runnerに含まれず、このIssueの作業中にもProductionで実行しません。将来Productionで既存SchemaのSignが必要な場合は、read-only Schema / marker状態の照合結果を保存し、専用PRで操作対象と影響をレビューし、merge後に対象Branchを再照合してから個別の明示承認を得ます。SignはPrisma marker / ledger / refを書き込むため、Migration applyと同じ本番ゲートを通し、承認後にその1回だけ実行します。状態がレビュー時から変わった場合は再レビュー・再承認します。

Schema文書を更新するときはProductionをSource of Truthとして生成します。

```bash
npm run db:schema -- --target production
npm run check:database-schema
```

VercelはPrisma Migrationを自動適用しません。アプリをdeployする前に、対象Branchへの適用と検証を手動運用で完了します。

## Validation

- `migration check --space app`は正常終了する。
- Prisma migrationのprecheck、operations、postcheckが意図したSchemaとData Contractを保つ。
- 適用後の`status`がpending / diagnosticなしを示し、`verify`がContract一致を確認する。
- 接続先が意図したNeon Branchである。
- 必要なアプリケーション検証が成功する。
- schema documentationを更新する必要がある場合は、現行Neon schemaから再生成し、差分を確認する。

## Rollback / Recovery

- Productionで失敗を試行してrollbackする運用は行わない。検証Branchで手順と影響を確認する。
- アプリケーションだけをrollbackする場合、公開状態や下書きを失わないよう、追加済みcolumnやconstraintを安易に削除しない。
- 失敗時は対象Branch、適用済みSQL、verify結果を確認し、必要に応じて専用Issueで回復策を決める。

`db:migrate`は旧`db/migrations/001`〜`025`内の既存SQLだけを実行でき、新しい番号・任意SQL pathは拒否します。`db:preflight`は旧`schema_migrations`履歴の確認専用です。既存SQL方式とPrisma方式を同じSchema変更へ二重適用しません。PrismaのContractを以前の形へ戻す方法と、Neon Restoreによる行データ復旧の分担は[差分Migration・復旧シナリオ](../development/prisma-migration-validation.md)を参照します。

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
