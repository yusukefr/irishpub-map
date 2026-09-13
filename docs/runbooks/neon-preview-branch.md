# Neon Preview DBを運用する

## Purpose

Vercel Preview用に固定のNeon Branchを使い、Preview Deploymentごとの自動Branch作成によるbranch limit到達を防ぎます。Production BranchはPreviewと共有しません。

## When to use

- Preview Deploymentが`Provisioning integrations failed`または`Branch limit reached`で失敗するとき
- Preview用の固定Neon Branchを初回設定または更新するとき

通常のPreview Deploymentでは、このRunbookの操作は不要です。

## Prerequisites

- 対象Neon project、Production Branch、現在利用中のPreview Branchを区別できる。
- Preview用接続文字列を安全に取得でき、実値を文書、shell history、リポジトリへ残さない。
- Vercel Project SettingsのStorage integrationとEnvironment Variablesを変更する権限がある。

## Procedure

1. Neon Consoleで未使用の`preview/*` Branchを確認する。Production Branchと現在利用中のPreview Branchは削除しない。
2. 必要な場合だけ、専用Preview Branchを1つ作成し、接続文字列を安全に取得する。
3. Vercel ProjectのStorage integrationで、`Create database branch for deployment`のPreview設定を無効にする。
4. Vercel ProjectのEnvironment Variablesで、固定Preview Branchの接続文字列を`DATABASE_URL`のPreview環境へ登録または更新する。Production環境の`DATABASE_URL`は変更しない。
5. 失敗したDeploymentをRedeployするか、作業Branchへ新しいcommitをpushする。

CLIを使う場合も、秘密値をコマンドライン引数やshell historyへ残さない方法を優先します。例として標準入力で渡す場合は、対象がPreviewであることを再確認します。

```bash
printf "%s" "$NEON_PREVIEW_DATABASE_URL" | vercel env add DATABASE_URL preview
```

## Validation

- 次のPreview Deploymentが、Branch作成を伴うProvisioning integrationではなく通常のBuildへ進む。
- Preview環境だけが固定Preview Branchを指し、Productionの`DATABASE_URL`が変わっていない。
- Previewで必要なmigrationがある場合は、[Neon migration Runbook](neon-migrations.md)に従って適用・検証する。

## Rollback / Recovery

- 接続先を誤った場合は、対象Environmentを確認してから正しいPreview接続先へ戻す。Productionの接続先をPreview用に置き換えない。
- 自動Branch作成を再有効化する前に、branch limit、削除運用、料金・利用上限への影響を確認する。

## Security notes

- 接続文字列はSecretであり、Issue、PR、ログ、`.env`、Repositoryへ保存しない。
- Branch削除は破壊的操作である。対象が未使用でありProduction / 現行Previewではないことを確認してから実行する。

## Related docs

- [通常デプロイ](../setup/deployment.md)
- [Neon migrationを適用する](neon-migrations.md)
- [Neon Branchの利用方針](../development/conventions.md#neon-branchの利用方針)
