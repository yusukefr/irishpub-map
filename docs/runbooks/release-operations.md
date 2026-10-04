# リリース・CI運用を行う

## Purpose

GitHub ActionsのCI、Git Tagを正とするProduction Release、Vercel Analytics / Speed Insights、API key生成など、通常デプロイ以外のリリース運用を確認します。

## When to use

- CI通知、Production Release、Required Status Checkを確認するとき
- API keyを生成またはローテーションするとき
- Vercel Analytics / Speed Insightsを有効化・再開するとき

## Prerequisites

- 対象がGitHub Actions、Vercel Preview、Vercel Productionのどれかを明確にしている。
- Secret、Webhook URL、API keyの実値を安全に保管できる。

## GitHub Actions

CIは`main`へのpush、`main`向けPull Requestの更新、`workflow_dispatch`で実行されます。Feature branchへのpushでは起動しません。変更ファイルは`scripts/classify-ci-changes.mjs`で分類し、比較元を取得できない場合は全検証を実行します。`Lint, Test, Build`というジョブ名は変更内容にかかわらず維持します。

| 変更内容 | `Lint, Test, Build`で実行する処理 | `main` push後のE2E / Storybook browser tests |
| --- | --- | --- |
| Code変更（workflowを含む） | Sensitive data check、LLM security check、npm ci、Format、OpenAPI lint、Lint、Unit Test、Next.js Build、Storybook Build | 実行 |
| `docs/specs/openapi/**`のみ（通常文書との混在を含む） | Sensitive data check、LLM security check、npm ci、OpenAPI lint | 省略 |
| docs-only | 通常はSensitive data check、LLM security checkのみ。`main` push時に未Releaseのアプリ変更があればCode変更と同じFull CI | 未Releaseのアプリ変更があれば実行。それ以外は省略 |
| `workflow_dispatch` | Code変更と同じFull CI | 実行 |

docs-onlyは`docs/**`（OpenAPIを除く）、rootの`README.md` / `AGENTS.md` / `LICENSE`、`.agents/**`、`.codex/**`に限定します。アプリ配下のMarkdownを含む、それ以外のパスはCode変更として扱います。PR中にE2Eを確認する必要があれば、対象branchで`workflow_dispatch`を実行します。

LLM security checkはGit管理対象のAgent向け文書を動的に列挙し、禁止Unicode文字、NFC、instruction fileの配置を検査します。pre-commitではstage済みの内容だけを、CIでは管理対象全件を確認します。検出時は自動修正せず、表示されたファイル・位置と内容をレビューします。

独立した`GitHub Actions Workflow Lint` Workflowは毎回起動しますが、`.github/workflows/**`に変更がある場合、または手動実行時のみGoをセットアップし、`rhysd/actionlint`の固定バージョンでWorkflowを静的検査します。Workflowの変更時には、`ci.yml`自体の構文エラーも別Workflowから検出できます。このWorkflowは書き込み権限や通知用Secretを持ちません。

同じPRで新しいrunが始まると、進行中の古いrunはキャンセルされます。`main`のrunはProduction Releaseまで続くため、後続pushではキャンセルしません。PR更新後は最新HEADの通常CIを確認し、`main`へのmerge後は通常CIとE2Eの両方を確認します。E2E失敗時のPlaywright artifactは引き続き保存します。

PR作成・更新後は`scripts/verify-pr-ci.sh --pr <番号>`で最新HEADの`Lint, Test, Build`を確認します。checkが未作成なら最大90秒待ち、`queued`や`in_progress`なら既存checkの完了を待ちます。待機中にPRのHEADが変わった場合は中止するため、コマンドを再実行します。成功は正常終了、失敗・キャンセル・待機のタイムアウトはエラーになります。check未作成時のfallbackも必要なら`--dispatch`を付けます。この場合も90秒待ってcheckが作成されないときだけ`workflow_dispatch`で手動CIを起動し、対象PRのHEAD SHAと一致するrunを待ちます。通常CIの失敗時は原因を確認し、fallbackを自動起動しません。

Slack通知を有効にする場合は、GitHub RepositoryのSettings → Secrets and variables → Actionsで次を設定します。

| 種別     | 名前                     | 用途                       |
| -------- | ------------------------ | -------------------------- |
| Variable | `SLACK_CICD_CHANNEL`     | 任意の通知先channel        |
| Secret   | `SLACK_CICD_WEBHOOK_URL` | Slack Incoming Webhook URL |

`Lint, Test, Build`ジョブは従来どおり成功・失敗時にSlackへ通知します。E2Eジョブは失敗時に限り、同じWebhookと、設定されている場合は同じChannelへ通知します。E2E成功時の追加通知はありません。通知にはRepository名、Branch名、GitHub Actions Run URLを含めます。失敗時はRun URLから実行結果を開き、保存されたPlaywright artifactを確認します。

## Production Release

PRや`main`へVersion更新専用commitは作りません。`main`へのpushで、最新のannotated Production SemVer Tagから現在のHEADまでにProduction成果物へ影響する未Release変更があり、Full CIとE2Eが成功した場合だけ、CIから`Production Release` reusable workflowを呼びます。この累積差分で`release_relevant`を決めるため、直前のpushがdocs-onlyでも未Releaseのアプリ変更が残っていればFull CI、E2E、Releaseを実行します。PRの分類は従来のPR差分を使います。対象は`apps/**`（`apps/web/AGENTS.md`を除く）、`packages/**`、rootの`package.json` / `package-lock.json` / `vercel.json` / `.nvmrc` / `.npmrc`、Production環境検証scriptです。累積差分がdocs-only、OpenAPI、workflow、test、E2EのみならProductionへdeployせず、VersionとTagも進めません。比較元が取得できない場合は全検証を行い、baseline Tagがないなど累積Release判定ができない場合はCIを失敗させます。`production-release` concurrencyで直列化し、実行時点の`origin/main`とCI対象SHAが異なる場合は古いReleaseをskipします。Release Workflow開始時にも最新Tagから対象SHAまでを再判定し、先行Releaseで対象変更が既に含まれた場合はdeployせず終了します。rootの`package.json`と`package-lock.json`のVersionはnpm metadataとして扱い、Releaseのたびに書き換えません。

Release Workflowは新規Releaseの開始前に、Vercel ProjectのProduction aliasが指す現行Deploymentを取得し、その`releaseVersion` / `releaseDate` / `releaseGitSha`を最新のannotated SemVer Tag（`vX.Y.Z`）のVersion / Tag message日時 / 対象full SHAと照合します。Production aliasが特定できない、複数のDeploymentを指す、metadataが欠ける、APIが失敗する、値が一致しない場合はdeploy前に停止します。照合後に最新Tagから次のpatch Versionを決め、Deployment開始前に`YYYY-MM-DD HH:mm JST`、full SHAとともに候補metadataをartifactへ保存します。このSHAをcheckoutしたソースへ、候補の`APP_RELEASE_VERSION`、`APP_RELEASE_DATE`（`YYYY-MM-DDTHH:mm:00+09:00`）、`APP_RELEASE_GIT_SHA`をbuild/runtime変数として渡します。Vercel Production Deploymentの成功を確認して成功markerを保存した後、初めて同じSHAのannotated Tagを作成・pushします。Tag messageには`Release vX.Y.Z`と候補日時を記録します。Public FooterにはVersionと日時のみ、認証済みAdminには短縮SHAも表示します。Deploymentが失敗した場合はTagを作らず、再実行では保存済みの候補metadataを再利用します。Tag pushが失敗した場合も、再実行は成功markerを確認して現行Productionと保存済み候補を照合し、Deploymentを省略して同じTagを再試行します。Tagが異なるSHAを指す場合や、より新しいReleaseが存在する場合は停止します。

### Production成功後にTag pushだけ失敗した場合

次のReleaseを進める前に、このReleaseのTagを復旧します。復旧までは次のProduction Releaseを停止し、Versionを採番し直して回避しません。現行Production aliasが指すDeploymentの`releaseVersion` / `releaseDate` / `releaseGitSha`、CI runの`release-metadata`と`release-deployed` artifact内のVersion / `releasedAt` / full `gitSha`、最新TagのVersion / message日時 / 対象SHAを比較します。両artifactは同じ候補で、現行Productionの３項目とも一致し、候補が最新Tagの次patch Versionである必要があります。同じrunを再実行できる場合はReleaseジョブを再実行します。成功markerがあるため再deployせず、保存済み候補からTag pushを再試行します。

手動復旧が必要な場合は、artifactを作業用の安全な一時ディレクトリへ展開し、対象SHAをcheckoutした作業ツリーで以下を実行します。`RELEASE_METADATA_FILE`は`release-metadata.json`、`RELEASE_DEPLOYED_FILE`は`release-deployed.json`を指定します。両ファイルが失われた場合は、VercelのProduction Deploymentに紐づくVersion、JST日時、full SHAを確認し、両ファイルへ同じJSONを復元してから実行します。

```bash
git fetch origin --tags
git rev-parse HEAD
RELEASE_SHA="$PRODUCTION_SHA" \
  RELEASE_METADATA_FILE="$RELEASE_METADATA_FILE" \
  RELEASE_DEPLOYED_FILE="$RELEASE_DEPLOYED_FILE" \
  node scripts/finalize-release.mjs
git ls-remote --tags origin "refs/tags/$RELEASE_VERSION^{}"
```

Tagが既に異なるSHAや日時を指す場合、または後続Tagがある場合は上書きせず停止します。復旧時に新しいVersionや日時を採番しません。

### 移行前の設定

この方式を含むPRをmergeする前に、GitHub Actions Secret `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`を設定します。値はVercelの対象Projectに限定し、Repositoryやログへ記録しません。`vercel.json`は`main`のGit自動Deploymentだけを無効化し、PR Previewは維持します。Release Workflowは[Vercel CLIのsource deployment](https://vercel.com/docs/cli/deploy)を使うため、Tag対象SHAのcheckout済みソースとRelease metadataを一緒にbuildします。

初回Release前に、現在のProduction Deploymentのcommit SHA、表示Version、Deployment時刻をVercel側で確認し、そのcommitへannotated baseline Tagを作成します。既存のProduction Deploymentに３つの`--meta`値がない場合、このPRのRelease事前照合は失敗します。merge前に、確認済みProductionのVersion / JST日時 / full SHAをmetadataとして持つProduction Deploymentを用意し、現行Production aliasの指すDeploymentでその３項目を確認してから、同じ値のbaseline Tagを作成します。Productionへの変更手順と結果は別途レビューし、値の推測やTagだけの先行作成はしません。Git管理の旧Versionや`main`の最新SHAをProductionの代用にしません。Tag messageは`Release vX.Y.Z`と`YYYY-MM-DD HH:mm JST`の2行です。以下の変数には確認済みの値を設定してから実行します。

```bash
git fetch origin --tags
git cat-file -e "${PRODUCTION_SHA}^{commit}"
git tag -a "$BASELINE_TAG" "$PRODUCTION_SHA" -m "Release $BASELINE_TAG"$'\n'"$PRODUCTION_RELEASED_AT"
git push origin "refs/tags/$BASELINE_TAG"
git rev-parse "${BASELINE_TAG}^{commit}"
```

`BASELINE_TAG`は実際のProduction表示Version（例: `v0.1.64`）、`PRODUCTION_RELEASED_AT`は確認したDeployment時刻をJSTの分単位で指定します。既存Tagの有無と対象SHAを事前に確認し、異なるcommitを指すTagは上書きしません。baseline Tag、現行Productionの３つのmetadata、3つのSecret、Previewの動作を確認できるまでmergeしません。

### Release後の確認

`main`のCIとE2E、Release Workflow、Tagの対象SHA、VercelのProduction DeploymentがReadyであることを確認します。ProductionのPublic FooterのVersion・JST日時がTag messageと一致し、AdminのSHAがTag対象commitと一致することを確認します。Localはmetadata未設定時にDevelopmentを表示し、Previewはmetadataの有無にかかわらずPreviewを表示します。Local/PreviewはRelease Tagを作りません。Version更新専用のGitHub App、Actions Secret、Dependabot Secretは不要です。

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
