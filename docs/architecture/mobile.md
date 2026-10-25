# Mobile Architecture

この文書はExpo / React Nativeを使う `apps/mobile` のArchitecture方針を定めます。実装開始時はここに記載したVersionとNative依存の互換性を公式Documentationで再確認し、変更があれば同じPRで更新します。親Issue #521と基盤調査Issue #539に沿い、未実装の機能を現行Behaviorとして扱いません。

## 採用基盤

- **Expo / React Native**: 実装開始時点の最新Stable Expo SDKを採用し、Expo SDKが指定するReact Native / React Versionを使います。2026-10-25にExpo SDK 58 stableへ移行し、SDK 58.0.0、React Native 0.88.0、React 19.3.0、Expo Router 58.0.26を使用します。CanaryやBetaは採用せず、SDK更新時はMapLibreを含むNative依存の互換性も確認します。
- **Expo Router**: File-based routingを採用します。RouterはExpo SDKと互換性のあるStable版を使い、独立して最新版へ上げません。Routeの初期案はMap `/`、Pub詳細 `/pub/[id]` です。
- **Router Native依存**: `react-native-safe-area-context`、`react-native-screens`、`expo-linking`、`expo-constants`、`expo-status-bar`をMobile workspaceの直接依存として宣言し、Expo SDKに対応する版を使います。Native autolinkingとPrebuildがworkspaceの依存宣言に基づいて解決できるようにします。
- **MapLibre React Native**: `@maplibre/maplibre-react-native` 11.5.0 と公式Expo config pluginを使います。MapLibreはExpo Goに含まれず利用できないため、Expo GoをMobile開発環境にしません。Pluginを設定し、Nativeコードまたはapp configを変更した後はDevelopment Buildを作り直します。Android / iOSはOpenFreeMap Bright styleを読み込み、GeoJSONSourceと単一Circle layerでPub Markerを描画します。MapLibre標準のAttributionを有効にし、OpenFreeMapへの要求にはアプリ名・versionを含むUser-Agentを付けます。
- **OS下限**: SDK 58の公式表ではAndroid 7+、iOS 16.4+です。実装開始時のStable SDKとMapLibre Nativeの要件を照合し、より高い下限があればその値を採用します。Expo SDK、Apple、Googleの提出要件は変わるため、各Release前にも確認します。

## npm WorkspaceのVersion解決

現在のroot、`apps/web`、`apps/mobile`はいずれもReact 19.3.0を使います。`apps/mobile`は採用SDKが指定するReact Native Version（0.88.0）を明示し、Web側のReactを変更しません。Expo SDKが依存するReact Nativeはroot overrideで0.88.0に統一します。`apps/mobile/metro.config.js`はMobile workspaceから解決されるReactをbundleでも使うよう固定します。SDK 58へ更新後、Expo DoctorはReactの重複依存を報告しません。SDK 52以降ではExpoがMetroのworkspace設定を自動構成するため、独自設定はこのReact解決に限定します。

Expo SDK / RouterとNative依存を加えた後はrootで`npm ls react react-native`と`npx expo install --check`を実行し、Expo Development BuildでAndroid Emulatorまたは実機を起動して依存の重複・不整合を検証します。Reactのworkspace間重複はMetroのAndroid source mapでアプリbundleへの混入がないことも確認します。問題が見つかった場合はworkspace依存宣言、lockfile、Metroの解決結果を確認し、Web側Versionの変更は影響を評価してから決めます。

## 開発・Buildフロー

Development Buildを標準にし、Androidを主な実装・ローカル検証Platformとします。UbuntuではTypeScript・Lint・Typecheck・Unit / Component Testをローカルで実行し、**AndroidのNative BuildはEAS Build（クラウド）を標準**とします。USB接続したAndroid実機にAPKをインストールし、Metro / Fast Refreshで開発します。Android Emulator / ローカルGradle Buildは代替手段ですが、必須としません。Expo GoではMapLibreを検証できません。

`apps/mobile/app.json` の `owner` / `extra.eas.projectId` で `@yf-techs/irishpub-map` を識別し、`apps/mobile/eas.json` でBuild Profileを定義します。EAS CLIはMobileアプリのディレクトリから実行します。EAS BuildのNode.jsは24.21.0、`appVersionSource`は`remote`です。`development` はDevelopment Clientと内部配布APK、`preview` はMetro不要の内部検証、`production` はストア配布向けです。Native Build、APKインストール、Metro起動は独立した操作です。具体的な手順は[ローカル開発](../setup/development.md#mobile-android-開発)を参照してください。

SDK 58移行ではReact Native Strict TypeScript API、削除API、Routerの独自Navigator APIを利用していないことを確認しました。React Native 0.88の型に合わせ、空一覧Componentの値を`null`から`undefined`に変更しています。Expo Doctorの20項目中19項目が成功し、残る項目はroot `package.json` の`storybook` scriptと同名の`node_modules/.bin`項目が競合する既存警告です。RouterのWeb出力変更は本workspaceがAndroid / iOS専用でWebをBuild対象にしていないため適用範囲外です。2026-10-25、MapLibre React Native追加後のAndroid PrebuildとローカルGradle `assembleDebug` は成功し、Debug APKを生成しました。Android端末は未接続のため実機での地図描画・通信確認は未完了です。SDK 58のiOS Buildも未実施です。

JavaScript / TypeScriptのみの修正はMetroで反映でき、通常はAPKの再作成不要です。Native依存・Expo config plugin・Permission等のNative設定を変更したらEAS Development Buildを作り直します。EASアップロードへDB CredentialやServer Secretを含めず、Signing CredentialやExpo認証トークンをGitへコミットしません。

MapLibreなどNative依存を追加・更新した節目でiOS EAS Buildを行い、TestFlightまたは利用可能なiOS実機でSmoke Testします。Android MVP後にiOSをまとめて初めて確認する運用にはしません。iOS Native BuildはEASのmacOS環境を利用できるため、日常開発にMacを必須としません。

## 責務とデータ境界

| 領域 | 責務 |
| --- | --- |
| `apps/web` | Next.jsのWeb UI、Route Handler、認証、Server / Repository処理。React DOMやブラウザAPIに依存する画面処理をMobileから共有しない |
| `apps/mobile` | Expo / React Nativeの画面とNavigation、MapLibre Native、OS Permission、外部アプリ連携 |
| `packages/shared` | Pub / Locale等のPlatform非依存型、Validation、純粋ロジック。React Native、DOM、Node専用API、DB接続を持ち込まない |
| Public API | WebとMobileに公開データを提供するServer側境界。Mobileは合意済みのPublic APIを呼び出す |
| Neon | Server側の永続化先。Mobileから直接接続しない |

MobileからNeonへ直接接続せず、Database URL、DB credential、Server secretをアプリへ含めません。Client bundleに固定API KeyなどのSecretを含めません。Public Pub APIは全環境で固定Client Secret不要のRead-only APIとして公開し、公開Fieldの限定、locale Validation、Query allowlistを適用します。共有Cacheは明示locale `ja` / `en` の正規Queryだけに使い、locale省略時は既定の `ja` を返してCacheしません。分散Rate Limitは導入していません。

UI ComponentはWebとMobileで共有せず、共有するのは型や純粋ロジックを中心とします。Public API Clientの共有・配置はAPI Contract整理Issue #541で既存コード量とPlatform依存を見て決定します。

## Map Provider

WebとMobileはMapLibreからOpenFreeMap Bright styleを利用し、MapLibre標準の帰属表示を有効にします。Mobileはアプリ名とversionを含むUser-Agentを送ります。OpenFreeMapの現行Termsで固有User-Agentの条件が明記されているのはオフラインダウンロードですが、Mobile実装もクライアントを識別できるUser-Agentを設定します。可視範囲外の一括取得やオフラインダウンロードは行いません。Native Mapの外部送信と保持情報は[プライバシー・外部送信](../operations/privacy-and-external-transmission.md)と[地図プロバイダー方針](../operations/map-provider.md)に記載します。

## 参照

- [Expo SDK reference](https://docs.expo.dev/versions/latest/)
- [Expo Router introduction](https://docs.expo.dev/router/introduction/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo monorepos](https://docs.expo.dev/guides/monorepos/)
- [MapLibre React Native Expo setup](https://maplibre.org/maplibre-react-native/docs/setup/expo/)
- [MapLibre React Native requirements](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/)
- Repository内の実装・手順: [Mobile handoff](../development/mobile-handoff.md)、[System overview](system-overview.md)、[Map Provider policy](../operations/map-provider.md)

公式Documentationの確認日: 2026-10-25。
