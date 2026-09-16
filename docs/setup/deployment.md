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

## Quiz Data Migrationの履歴

Quiz Data MigrationはIssue #391で完了済みです。旧JSONからNeonへの一度限りの移行であり、通常のPreview / Production Deploymentで再実行する手順やRuntimeのImport処理はありません。現在のQuiz QuestionとChoiceのSource of TruthはNeon PostgreSQLです。

Issue #394では、SchemaやProductionデータを変更せず、Preview・Production双方に対するRead-only Dry Runで9 Questions / 36 Choicesの完全移行済みを確認したうえで、旧JSON、Migration Script、Migration専用Test、npm scriptを削除しました。今後QuizのSchema変更が必要な場合は、通常の[Neon migration Runbook](../runbooks/neon-migrations.md)で別途扱います。

## Calendar Data Migration（Issue #411）

Calendar Schema Migrationとは別に、`apps/web/data/ireland/calendar.json`をNeonへ投入します。Migration元はこの固定JSONだけで、通常実行はDry Run、`--apply`を付けた実行だけが書き込みを行います。`calendar.json`はPublic CalendarのDB切替と検証が完了するまで削除しません。

Productionへ適用する前に、同じcommitとJSONを使って検証用Neon Branchで次を順に実行します。接続文字列は実行環境のSecretとして扱い、文書・ログ・Issue・PRへ出力しません。

```bash
npm run migrate:calendar-data
npm run migrate:calendar-data -- --apply
npm run migrate:calendar-data
```

`--apply`時はCalendar両テーブルをロックし、空状態の再確認と全Event・TranslationのINSERTを同じtransactionで行います。競合やエラー時はINSERT全体がrollbackされます。最後のDry Runで25 Events / 50 Translationsの`already migrated`を確認し、ID、日英翻訳、Date Rule、aliases、source、JSON記載順、公開状態が一致することを確認します。完全一致済み状態は変更せず、Partial・Different・Extra Dataは自動修復せず中止します。

検証用BranchでSchema verify、Dry Run、Apply、再Dry Runを完了した後、同じ順序でProductionへ適用します。失敗時に`--force`や既存値の上書きで続行せず、原因を修正してから再実行します。

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
