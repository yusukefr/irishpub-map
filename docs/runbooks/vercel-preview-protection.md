# Vercel Preview Protectionを設定・復旧する

## Purpose

Vercel Preview Deployment Protectionを使うPreview環境で、server-side fetch、Preview Toolbar、Preview Commentsに関する設定・障害対応を行います。

## When to use

- Preview環境の`/api/pubs`へのserver-side fetchがVercel SSOへredirectされるとき
- Production Deploymentが`IMMUTABLE_STATIC_PATCH_PREVIEW_COMMENTS`で失敗するとき
- Preview ProtectionまたはVercel Toolbarの設定を見直すとき

通常のPreview / Productionデプロイでは、このRunbookの操作は不要です。

## Prerequisites

- 操作対象がPreviewかProductionかを確認している。
- Vercel Project Settingsを変更する権限がある。
- Protection Bypass secretを安全に管理できる。値を表示、commit、Issue / PR貼り付け、コマンドライン引数へ渡さない。

## Procedure

### Previewのserver-side fetch

1. Preview Deployment Protectionが有効で、同一Preview URLへのserver-side fetchがSSO redirectされることを確認する。
2. VercelのProtection Bypass for Automation secretを、Preview環境の`VERCEL_AUTOMATION_BYPASS_SECRET`へ安全に登録する。
3. 再デプロイ後、公開API fetchと画面表示を確認する。

未設定時も、アプリは静的データを複製せず店舗0件として扱い、ページ全体のserver errorを避けます。

### ProductionのPreview Comments障害

1. Production Deploymentの`Deploying outputs...`で`IMMUTABLE_STATIC_PATCH_PREVIEW_COMMENTS`が出たことを確認する。
2. Vercel ProjectのSettings → General → Vercel Toolbarで、ProductionのFeedback / Preview CommentsをOFFにする。
3. Preview環境の設定は必要な運用に合わせて保持または見直す。
4. Production Deploymentを再実行する。

Vercel Toolbar設定は`vercel.json`では管理しません。

## Validation

- ProductionのFeedbackがOFFであり、Production DeploymentがReadyになっている。
- Preview Protection使用時は、Previewだけに必要なsecretが設定されている。
- Productionの環境変数、Domain、管理者情報をPreviewの設定変更で変えていない。

## Rollback / Recovery

- 意図しない環境にProtection設定やsecretを追加した場合は、対象Environmentを確認してからその設定だけを戻す。
- 一時的なworkaroundを恒久手順として残さず、現行のVercel設定と再現条件を確認する。

## Security notes

- `VERCEL_AUTOMATION_BYPASS_SECRET`はSecretであり、値を出力しない。
- Preview URL、SSO redirect URL、account情報を文書・Issue・PRへ記録しない。

## Related docs

- [通常デプロイ](../setup/deployment.md)
- [Vercel deployment protection](https://vercel.com/docs/deployment-protection)
- [外部送信・プライバシー実態整理](../operations/privacy-and-external-transmission.md)
