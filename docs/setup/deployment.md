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

## Quiz Data Migration（Issue #391）

Quiz DomainのSchema Migrationとは別に、`apps/web/data/ireland/quiz.json`をNeonへ投入します。Migration元はこの固定JSONだけで、任意の入力ファイルや強制上書きオプションはありません。`quiz.json`はPublic切替とテスト・Cleanupが完了するまで削除しません。

Productionへ適用する前に、必ずProduction相当のデータを複製しない検証用Neon Branchで、同じcommitとJSONを使って次の順序を実行します。`DATABASE_URL`は接続先のSecretとして実行環境へ設定し、値を文書・ログ・Issue・PRへ出力しません。

```bash
npm run migrate:quiz-data
npm run migrate:quiz-data -- --apply
npm run migrate:quiz-data
```

最初の実行はValidationとRelated Guide解決を含むDry Runで、DBへ書き込みません。`--apply`を付けた実行だけが、Quiz全テーブルをロックして空状態を同じtransaction内で確認したうえでINSERTします。確認後に別処理がQuiz行を追加した場合も、INSERT全体がrollbackされます。最後のDry Runで`already migrated`になり、件数・ID・翻訳・Choice順・正解・Source・Special Date・Related Contentが一致することを確認します。すでに完全一致する状態は変更せず、不完全・差分・余分なQuizがある状態では中止します。

Branchでの検証とQuiz Repositoryの取得確認が完了した後、同じcommit・同じJSONでProductionに対してDry Run、Apply、再度Dry Runを実行します。失敗時に`--force`や既存値の上書きで続行せず、原因を修正してから再実行します。

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
