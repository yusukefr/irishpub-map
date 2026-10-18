# ローカル開発の開始

この文書は、Irish Pub Mapのローカル開発を開始するための最短手順です。Pub Import、Visual Regressionの基準画像更新、管理者初期設定などの低頻度な作業は[Runbooks](../README.md#documentation-router)を参照してください。

## 必要環境

- Node.js 24系（`.nvmrc`に従う）
- npm
- nvm（推奨）

```bash
nvm use
npm ci
```

`nvm`を利用しない環境では、`.nvmrc`と同じNode.js major versionを選択します。

ルートの `npm ci` でUnit Testと Mermaid parser の依存関係もインストールされます。ドキュメント全体の図を単独で検証する `npm run check:mermaid` は、docs-only CIと同じ独立環境を使うため、実行前に次のコマンドでツールをインストールします。

```bash
npm ci --prefix tools/docs-check --ignore-scripts
```

## ローカル環境変数

`.env.example`をコピーして`.env.local`を作成します。実値をGit、Issue、PR、スクリーンショットへ記録しません。

```bash
cp .env.example .env.local
```

| 変数                              | 必要な場面                          | 用途                                    |
| --------------------------------- | ----------------------------------- | --------------------------------------- |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Preview Protectionを使う場合        | Previewのサーバー側fetch用bypass secret |
| `DATABASE_URL`                    | 公開Guideまたは永続化を使う場合     | Neon Postgres接続文字列                 |
| `BLOB_READ_WRITE_TOKEN`           | ローカルでMedia uploadを使う場合    | Vercel Blob read/write token            |
| `BLOB_STORE_ID`                   | Vercel OIDCでMedia uploadを使う場合 | Blob store ID（OIDC tokenはVercel管理） |
| `ADMIN_USERNAME`                  | 管理画面を有効にする場合            | 管理者ID                                |
| `ADMIN_PASSWORD_HASH`             | 管理画面を有効にする場合            | scrypt password hash                    |
| `ADMIN_SESSION_SECRET`            | 管理画面を有効にする場合            | セッションCookie署名用のランダム値      |

`DATABASE_URL`未設定時は店舗と公開Guideを0件として扱います。3つの`ADMIN_*`変数がすべてそろうと管理画面のログインが有効になり、更新にはさらに`DATABASE_URL`が必要です。

## 起動

```bash
npm run dev
```

Next.jsアプリは`apps/web`で起動します。

## Mobile Android 開発

`apps/mobile` はExpo SDK 57 / React Native 0.86 / Expo Router 57を使います。AndroidのNative BuildはEAS Build（クラウド）、動作確認はUSB接続したAndroid実機、JavaScript開発はローカルMetroを標準とします。Android Emulator / ローカルGradle Buildは代替手段です。MapLibreなどのNative Moduleを使用するためExpo GoではなくDevelopment Buildを使用します。

Mobileは `EXPO_PUBLIC_API_BASE_URL` でPublic Pub APIのOriginを環境別に設定できます。未設定または空の場合はProduction Origin `https://irishpub-map-web.vercel.app` を使います。`EXPO_PUBLIC_*` の値はアプリBundleから利用者に見えるため、API Originなど公開値だけを設定し、Secretは入れないでください。

### EAS Buildの手動実行ポリシー

**EAS Buildは必要なタイミングでのみ手動実行します。** PR作成・更新、GitHub Actionsの通常CI、JavaScript / TypeScriptの修正を理由に、EASクラウドビルドを自動実行しません。現在のRepositoryにはEASを起動するGitHub Actions Workflowを設けていません。以下の`eas build`コマンドは手動実行の参考手順であり、Agentへの自動実行指示ではありません。

AI AgentがEAS Build / Submitを開始する場合は、**その都度、ユーザーから明示承認を得る必要があります**。提案時には実行理由、Android / iOSの別、Build Profile、無料枠を消費する可能性を説明してください。失敗時の再試行や別Profileでの実行も再承認が必要です。実装・PR作成・通常のCI検証依頼だけでは承認されたことになりません。詳しくはRepository rootの[AGENTS.md](../../AGENTS.md#eas-buildsubmitの実行制限)を参照してください。

通常の検証はLint、Typecheck、Unit Test、ローカルMetro / JavaScript Bundleで実施します。Native依存・Expo config plugin・Permissionなどの変更で新しいAPKが必要な場合も、Agentは理由を報告してユーザーの判断を待ちます。予期しないBuild実行を防ぐため、CIやAgentの実行環境へ不要なEAS認証情報を渡さない運用も推奨します。

### EAS Development Build（Android APK）

EASの設定はGit管理する `apps/mobile/app.json` と `apps/mobile/eas.json` にあり、Expoプロジェクト `@yf-techs/irishpub-map` に紐付いています。RepositoryのrootでNode.js 24系と依存を準備し、**EAS CLIは `apps/mobile` ディレクトリから実行**します。EAS Build側のNode.jsは`eas.json`で24.21.0に指定しています。

```bash
# Repository root
nvm use
npm ci
cd apps/mobile

npx eas-cli@latest login        # 未ログイン時のみ
npx eas-cli@latest project:info
npx eas-cli@latest build --platform android --profile development
```

`development`プロファイルは`developmentClient: true`、`distribution: internal`のため、実機にインストール可能なAPKを生成します。初回ビルドでAndroid署名鍵について確認された場合はEASで管理できます。ビルド完了後、EASのBuild詳細ページからAPKをダウンロードし、インストールはビルドとは別に行ってください。

```bash
adb devices
adb install -r /path/to/irishpub-map-development.apk
```

2026-10-18に、EASでのAndroid Development Build成功、実機へのAPKインストール、Expo Development Launcherの起動まで確認済みです。**アプリ本体の初期画面表示は、Metro接続後のSmoke Testが未完了**です。

### USB接続した実機からMetroに接続

USBデバッグを許可したAndroid実機を接続し、Repository rootから実行します。次のコマンドはMetroの標準ポート8081を想定しています。

```bash
# Repository root
adb reverse tcp:8081 tcp:8081
npm run start -w apps/mobile -- --localhost
```

スマートフォンでIrish Pub MapのDevelopment Buildを開き、表示された開発サーバーに接続します。必要ならMetro側の `a` キーで端末のアプリを開きます。初期画面で `Irish Pub Map` と `Supported locales: ja, en` が表示されること、React / Native Module関連の実行時エラーがないことを確認してください。

JavaScript / TypeScriptだけの変更は基本的にMetro / Fast Refreshで反映できます。Native依存・Expo config plugin・PermissionなどNative設定の変更時はEAS Development Buildを作り直します。`preview`はMetro不要の内部動作確認用、`production`はストア公開向けの別プロファイルです。

EAS BuildへアップロードするファイルにDB接続文字列、API秘密鍵などを含めないでください。Expo認証トークンやAndroid署名鍵もGit管理しません。EAS上のProject IDは公開識別子でありSecretではありません。

Mobileのlint・型検査・component testは `npm run lint -w apps/mobile`、`npm run typecheck -w apps/mobile`、`npm run test -w apps/mobile` で実行できます。rootの `npm run lint`、`npm run typecheck`、`npm test` とCIにも含まれます。

関連: [Expo monorepoとEAS Build](https://docs.expo.dev/build-reference/build-with-monorepos/)、[Android Development Build](https://docs.expo.dev/tutorial/eas/android-development-build/)、[内部配布](https://docs.expo.dev/build/internal-distribution/)。

## 基本検証

変更内容に応じて次を実行します。

```bash
npm test
npx vitest run tests/check-mermaid.test.ts
npm run check:mermaid
npm run format:check
npm run typecheck
npm run lint
npm run build
npm run check:sensitive-data
```

依存関係を変更した場合は、追加で`npm audit --omit=dev`を実行します。E2Eの通常実行は`npm run test:e2e`です。

## 詳細Runbook

- [Pubを一括Importする](../runbooks/import-pubs.md)
- [Visual Regressionを更新する](../runbooks/visual-regression.md)
- [ブラウザで画面を確認する](../runbooks/browser-check.md)
- [Neon migrationを適用する](../runbooks/neon-migrations.md)
- [管理者アクセスを初期設定する](../runbooks/admin-access.md)
- [リリース・CI運用を行う](../runbooks/release-operations.md)

## Mobile実装へ引き継ぐ現行仕様

このRepositoryはnpm workspacesでWebアプリと共有パッケージを管理します。Mobileのセットアップ、Framework、Native地図SDK、Simulator / 端末、CIの決定はMobile実装Issueの範囲です。既存Webの境界や運用前提を確認する場合は、以下を参照してください。

- [System overview](../architecture/system-overview.md): `apps/web`、`packages/shared`、Server / Browserの責務
- [Testing strategy](../development/testing.md):共有ロジックとPlatform固有テストの責務、および未決のNative Test環境
- [通常デプロイ](deployment.md)と[Release and CI](../runbooks/release-operations.md): Local / Preview / Production、環境変数、CI条件
- [Map provider policy](../operations/map-provider.md): OpenFreeMap、帰属、Web以外のクライアントで再確認する条件
- [Privacy and external transmission](../operations/privacy-and-external-transmission.md): 位置情報の取得、利用、非送信とタイル要求に伴う外部送信
- [Design System](../design/README.md): Web Componentではなく共有するDesign原則とSemantic Role

## 関連資料

- [コード規約・開発規約](../development/conventions.md)
- [API specification](../specs/api.md)
- [System overview](../architecture/system-overview.md)
