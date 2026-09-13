# リリース・CI運用を行う

## Purpose

GitHub ActionsのCI、PR用app version更新、Vercel Analytics / Speed Insights、API key生成など、通常デプロイ以外のリリース運用を確認します。

## When to use

- CI通知、PR version更新、Required Status Checkを確認するとき
- API keyを生成またはローテーションするとき
- Vercel Analytics / Speed Insightsを有効化・再開するとき

## Prerequisites

- 対象がGitHub Actions、Vercel Preview、Vercel Productionのどれかを明確にしている。
- Secret、Webhook URL、API keyの実値を安全に保管できる。

## GitHub Actions

CIはbranch push、Pull Request更新、`workflow_dispatch`で実行されます。`Lint, Test, Build`とE2Eを確認し、PR更新後は最新HEADを対象にCIを確認します。

Slack通知を有効にする場合は、GitHub RepositoryのSettings → Secrets and variables → Actionsで次を設定します。

| 種別     | 名前                     | 用途                       |
| -------- | ------------------------ | -------------------------- |
| Variable | `SLACK_CICD_CHANNEL`     | 任意の通知先channel        |
| Secret   | `SLACK_CICD_WEBHOOK_URL` | Slack Incoming Webhook URL |

PR用version更新workflowは、必要時に`app-version.json`、rootの`package.json`、`package-lock.json`を同期します。`APP_VERSION_BUMP`が未設定または`patch`ならpatch、`minor`ならminorを更新し、majorは自動更新しません。Vercel buildではrelease dateだけをJST当日に更新します。

## API key生成

`IRISHPUB_MAP_API_KEY`を新規作成する場合は、秘密値を標準出力へ表示しないscriptを使います。

```bash
node scripts/generate-api-keys.mjs 1 /secure/path/api-keys.txt
```

生成ファイルは所有者だけが読める権限で保存されます。必要な値だけを対象Environmentへ登録し、完了後は安全な保管・破棄方針に従います。

## Analytics / Speed Insights

有効化または再開前に、[外部送信・プライバシー実態整理](../operations/privacy-and-external-transmission.md)を確認します。送信情報、送信先、目的、保持期間、停止方法、利用プラン、同意要否を確認し、PRでレビューします。

## Validation

- CIとRequired Status Checkが最新HEADに対して成功している。
- 生成したAPI key、Slack webhook、Vercelのsecret値がログやRepositoryへ露出していない。
- Analytics / Speed Insightsを変更した場合は、ブラウザ通信とプライバシー文書を確認している。

## Security notes

- API key、Webhook URL、token、secretをIssue、PR、CI log、Repositoryへ記録しない。
- ProductionとPreviewの設定対象を必ず分ける。

## Related docs

- [通常デプロイ](../setup/deployment.md)
- [Repository設定を確認・復元する](repository-settings.md)
- [外部送信・プライバシー実態整理](../operations/privacy-and-external-transmission.md)
