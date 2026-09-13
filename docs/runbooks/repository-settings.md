# Repository設定を確認・復元する

## Purpose

GitHub Repositoryの基本設定、Actions権限、`main` branch protection、rulesetsを安全に確認し、設定変更後の手順を保守します。

## When to use

- Required Status Check、ruleset、branch protection、Actions権限を確認するとき
- GitHub側のRepository設定を変更した後に、現在の設定を確認するとき

通常の開発・PR作成では実行しません。

## Prerequisites

- Node.jsと認証済みの`gh` CLIを用意する。
- 出力先として、Repository外の安全な一時pathを明示する。
- Secrets、Variables、tokenは取得対象に含めない。出力にはGitHub account情報やURLが含まれる可能性があるため、共有・commitしない。

## Procedure

リポジトリrootで出力先を指定して実行します。

```bash
scripts/export-repository-settings.sh --output /tmp/repository-settings.json
```

現在のGit remote以外を確認する必要がある場合だけ、対象Repositoryを明示します。

```bash
GH_REPO=owner/repository scripts/export-repository-settings.sh --output /tmp/repository-settings.json
```

## Validation

- 出力にRepository基本設定、Actions権限、`main` branch protection、rulesetsが含まれることを確認する。
- `main`のRequired Status CheckとCI workflowのjob名が一致することを確認する。
- GitHub側の設定を変更した場合は、再取得した結果を安全な場所で比較し、このRunbookの手順を更新する必要がないか確認する。

## Rollback / Recovery

- 設定変更前に現行設定を取得して、復元時の比較対象とする。
- rulesetやbranch protectionの緩和・削除は、対象Repositoryと影響範囲を確認してから実行する。

## Security notes

- このscriptはSecrets、Variables、tokenを取得対象に含めない。
- 出力にはGitHub account情報やURLが含まれる可能性があるため、Repositoryへcommit・共有せず、安全な場所に保管する。

## Related docs

- [通常デプロイ](../setup/deployment.md)
- [GitHub Actions設定](release-operations.md#github-actions)
