# Neon migrationを適用する

## Purpose

`db/migrations/`にあるSQL migrationを対象Neon Branchへ安全に適用し、schemaとアプリケーションの互換性を確認します。migration履歴とSQLは`db/migrations/`がSource of Truthです。

## When to use

- PRがDB schema、constraint、index、参照データに影響する場合
- 新しいアプリケーションを、必要なmigrationが未適用のNeon Branchへデプロイする前

通常のアプリケーション変更や文書変更では実行しません。

## Prerequisites

- 対象が検証用Branch、Preview用固定Branch、Productionのどれかを明確にしている。
- migration SQLと対応する`*_verify.sql`を確認済みである。
- `MIGRATION_DATABASE_URL`にはPooledではなくDirect / Unpooled Connection Stringを安全な一時環境変数として設定する。
- Productionへ直接試行せず、先に通常Neon BranchまたはSchema-only Branchで検証している。

## Procedure

1. 対象Branchと適用済みmigrationを読み取り専用で確認する。
2. 検証用Branchにup SQLとverify SQLを順に適用する。

```bash
node scripts/run-neon-migration.mjs db/migrations/<migration>_up.sql
node scripts/run-neon-migration.mjs db/migrations/<migration>_verify.sql
```

3. table、constraint、index、外部キー、必要な参照データ、`schema_migrations`をverify SQLで確認する。
4. 関連するアプリケーション、unit test、E2Eを検証する。
5. 検証成功後に限り、同じ順序で対象のPreviewまたはProduction Branchへの適用を判断する。

Vercelは`db/migrations/`を自動適用しません。アプリをデプロイする前に、対象Branchへの適用と検証を完了します。

## Validation

- verify SQLが期待する結果を返す。
- 接続先が意図したNeon Branchである。
- 必要なアプリケーション検証が成功する。
- schema documentationを更新する必要がある場合は、現行Neon schemaから再生成し、差分を確認する。

## Rollback / Recovery

- Productionで失敗を試行してrollbackする運用は行わない。検証Branchで手順と影響を確認する。
- アプリケーションだけをrollbackする場合、公開状態や下書きを失わないよう、追加済みcolumnやconstraintを安易に削除しない。
- 失敗時は対象Branch、適用済みSQL、verify結果を確認し、必要に応じて専用Issueで回復策を決める。

## Security notes

- `MIGRATION_DATABASE_URL`、接続文字列、query結果に含まれる機微情報を文書、ログ、Issue、PRへ残さない。
- Production / Preview / 検証用Branchを取り違えない。削除や破壊的SQLの前に対象resourceを再確認する。

## Related docs

- [通常デプロイ](../setup/deployment.md)
- [Database specification](../specs/database.md)
- [Generated database schema](../generated/database-schema.md)
- [Neon Branchの利用方針](../development/conventions.md#neon-branchの利用方針)
