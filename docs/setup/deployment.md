# 通常デプロイ

Irish Pub MapはVercelへデプロイします。`main`がProduction Branchであり、`main`へmergeされた変更がProduction Deploymentになります。この文書は通常のPreview / Productionフローだけを扱います。障害対応や管理操作は[Runbooks](../README.md#documentation-router)を参照してください。

## Vercelプロジェクト設定

Next.jsアプリは`apps/web`にありますが、VercelのRoot Directoryはリポジトリroot（`.`）です。設定はrootの`vercel.json`と一致させます。

| 項目              | 値                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Framework Preset  | Next.js                                                                                         |
| Root Directory    | `.`                                                                                             |
| Install Command   | `npm ci`                                                                                        |
| Build Command     | `npm run validate:production-env && npm run update-app-version -- --date-only && npm run build` |
| Output Directory  | `apps/web/.next`                                                                                |
| Production Branch | `main`                                                                                          |
| Node.js Version   | 24.x                                                                                            |

Production URLとカスタムDomainはVercel Project Settingsで管理します。Preview URLを文書、Issue、PRへ記録しません。

## 環境変数

Production / Previewの対象を明示して、Vercel ProjectのEnvironment Variablesに登録します。値はリポジトリへコミットせず、表示・ログ出力もしません。

| 変数                              | Production | Preview          | 用途                         |
| --------------------------------- | ---------- | ---------------- | ---------------------------- |
| `IRISHPUB_MAP_API_KEY`            | 必須       | 任意             | `GET /api/pubs`のAPI key     |
| `DATABASE_URL`                    | 必要時     | 必要時           | Neon Postgres接続文字列      |
| `ADMIN_USERNAME`                  | 必要時     | 必要時           | 管理者ID                     |
| `ADMIN_PASSWORD_HASH`             | 必要時     | 必要時           | scrypt password hash         |
| `ADMIN_SESSION_SECRET`            | 必要時     | 必要時           | セッションCookie署名用秘密値 |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | 不要       | Protection使用時 | Previewのserver-side fetch用 |

Productionで`IRISHPUB_MAP_API_KEY`が未設定の場合、buildは失敗します。`DATABASE_URL`未設定時は店舗・公開Guideを0件として扱い、書き込みは行いません。Preview DBは[Neon Preview DB運用](../runbooks/neon-preview-branch.md)に従います。

## 通常フロー

1. 作業ブランチで必要な検証を実行し、Pull Requestを作成する。
2. VercelのPreview DeploymentとGitHub ActionsのCIを確認する。
3. review後にPRを`main`へmergeする。
4. VercelのProduction DeploymentがReadyになり、Production Domainへ反映されたことを確認する。
5. 必要に応じて主要画面と公開APIを確認する。Productionの秘密値、Preview URL、管理者情報を出力しない。

## デプロイ前後の基本確認

merge前に少なくとも次を実行します。

```bash
nvm use
npm ci
npm test
npm run format:check
npm run typecheck
npm run lint
npm run build
npm run check:sensitive-data
```

依存関係を変更した場合は、追加で`npm audit --omit=dev`を実行します。データ構造を変更する場合は、アプリをデプロイする前に[Neon migration Runbook](../runbooks/neon-migrations.md)で対象Branchのmigrationと検証を完了します。

## 詳細Runbook

- [Neon migrationを適用する](../runbooks/neon-migrations.md)
- [Neon Preview DBを運用する](../runbooks/neon-preview-branch.md)
- [Vercel Preview Protectionを設定・復旧する](../runbooks/vercel-preview-protection.md)
- [リリース・CI運用を行う](../runbooks/release-operations.md)
- [Repository設定を確認・復元する](../runbooks/repository-settings.md)

## 関連資料

- [Deployment](https://vercel.com/docs/deployments/overview)
- [Vercel project configuration](https://vercel.com/docs/project-configuration)
- [API specification](../specs/api.md)
- [System overview](../architecture/system-overview.md)
