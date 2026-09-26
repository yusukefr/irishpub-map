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

CIは`main`へのpush、`main`向けPull Requestの更新、`workflow_dispatch`で実行されます。Feature branchへのpushでは起動せず、PR更新時は`Lint, Test, Build`（Storybook Buildを含む）のみ実行します。E2EとStorybook browser testsは`main`へのpush後、または手動実行時に実行します。PR中にE2Eを確認する必要があれば、対象branchで`workflow_dispatch`を実行します。

同じPRまたはbranchで新しいrunが始まると、進行中の古いrunはキャンセルされます。PR更新後は最新HEADの通常CIを確認し、`main`へのmerge後は通常CIとE2Eの両方を確認します。E2E失敗時のPlaywright artifactは引き続き保存します。

PR作成・更新後は`scripts/verify-pr-ci.sh --pr <番号>`で最新HEADの`Lint, Test, Build`を確認します。checkが未作成なら最大90秒待ち、`queued`や`in_progress`なら既存checkの完了を待ちます。待機中にPRのHEADが変わった場合は中止するため、コマンドを再実行します。成功は正常終了、失敗・キャンセル・待機のタイムアウトはエラーになります。check未作成時のfallbackも必要なら`--dispatch`を付けます。この場合も90秒待ってcheckが作成されないときだけ`workflow_dispatch`で手動CIを起動し、対象PRのHEAD SHAと一致するrunを待ちます。通常CIの失敗時は原因を確認し、fallbackを自動起動しません。

Slack通知を有効にする場合は、GitHub RepositoryのSettings → Secrets and variables → Actionsで次を設定します。

| 種別     | 名前                     | 用途                       |
| -------- | ------------------------ | -------------------------- |
| Variable | `SLACK_CICD_CHANNEL`     | 任意の通知先channel        |
| Secret   | `SLACK_CICD_WEBHOOK_URL` | Slack Incoming Webhook URL |

`Lint, Test, Build`ジョブは従来どおり成功・失敗時にSlackへ通知します。E2Eジョブは失敗時に限り、同じWebhookと、設定されている場合は同じChannelへ通知します。E2E成功時の追加通知はありません。通知にはRepository名、Branch名、GitHub Actions Run URLを含めます。失敗時はRun URLから実行結果を開き、保存されたPlaywright artifactを確認します。

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
