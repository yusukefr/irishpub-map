# Mobile Architecture

この文書はExpo / React Nativeを使う `apps/mobile` のArchitecture方針を定めます。実装開始時はここに記載したVersionとNative依存の互換性を公式Documentationで再確認し、変更があれば同じPRで更新します。親Issue #521と基盤調査Issue #539に沿い、未実装の機能を現行Behaviorとして扱いません。

## 採用基盤

- **Expo / React Native**: 実装開始時点の最新Stable Expo SDKを採用し、Expo SDKが指定するReact Native / React Versionを使います。2026-10-13の実装時点ではnpmの`latest`がExpo SDK 57.0.28で、SDK 58は`next`でした。SDK 57はReact Native 0.86、React 19.2.3を対象とするため、Mobileではその組み合わせを使います。Expo installの互換性確認後はExpo 57.0.30 / Expo Router 57.0.28を使います。CanaryやBetaは採用せず、SDK更新時はMapLibreを含むNative依存の互換性も確認します。
- **Expo Router**: File-based routingを採用します。RouterはExpo SDKと互換性のあるStable版を使い、独立して最新版へ上げません。Routeの初期案はMap `/`、Pub詳細 `/pub/[id]` です。
- **Router Native依存**: `react-native-safe-area-context`、`react-native-screens`、`expo-linking`、`expo-constants`、`expo-status-bar`をMobile workspaceの直接依存として宣言し、Expo SDKに対応する版を使います。Native autolinkingとPrebuildがworkspaceの依存宣言に基づいて解決できるようにします。
- **MapLibre React Native**: `@maplibre/maplibre-react-native` と公式Expo config pluginを使います。MapLibreはExpo Goに含まれず利用できないため、Expo GoをMobile開発環境にしません。Pluginを設定し、Nativeコードまたはapp configを変更した後はDevelopment Buildを作り直します。
- **OS下限**: SDK 57の公式表ではAndroid 7+、iOS 16.4+です。実装開始時のStable SDKとMapLibre Nativeの要件を照合し、より高い下限があればその値を採用します。Expo SDK、Apple、Googleの提出要件は変わるため、各Release前にも確認します。

## npm WorkspaceのVersion解決

現在のrootおよび`apps/web`はReact 19.3.0を使っています。`apps/mobile`は採用SDKが指定するReact Version（SDK 57では19.2.3）とReact Native Version（0.86.3）を明示し、WebのReact VersionをMobileに合わせる目的で一括変更しません。Expo SDKが依存するReact Nativeはroot overrideで0.86.3に統一します。Reactはworkspace間で異なる版が物理配置されるため、`apps/mobile/metro.config.js`でMobile側のReactへ解決を固定し、Android source mapでbundle内にReactが1版だけ含まれることを確認します。Expo Doctorはweb/mobile間の物理配置を重複として報告しますが、Mobile bundleの解決先はこの確認を優先します。SDK 52以降ではExpoがMetroのworkspace設定を自動構成するため、独自設定はこのReact version境界に限定します。

Expo SDK / RouterとNative依存を加えた後はrootで`npm ls react react-native`と`npx expo install --check`を実行し、Expo Development BuildでAndroid Emulatorまたは実機を起動して依存の重複・不整合を検証します。Reactのworkspace間重複はMetroのAndroid source mapでアプリbundleへの混入がないことも確認します。問題が見つかった場合はworkspace依存宣言、lockfile、Metroの解決結果を確認し、Web側Versionの変更は影響を評価してから決めます。

## 開発・Buildフロー

Development Buildを標準にし、Androidを主な実装・ローカル検証Platformとします。UbuntuではAndroid Emulatorを使い、TypeScript、Lint、Typecheck、Unit / Component Testも実行します。Expo GoではMapLibreを検証できません。

MapLibreなどNative依存を追加・更新した節目でiOS EAS Buildを行い、TestFlightまたは利用可能なiOS実機でSmoke Testします。Android MVP後にiOSをまとめて初めて確認する運用にはしません。iOS Native BuildはEASのmacOS環境を利用できるため、日常開発にMacを必須としません。JavaScript / TypeScriptだけの変更は既存Development Buildを使い、Native依存またはapp configの変更時に再Buildします。

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

現行WebはMapLibre GL JSからOpenFreeMapのBright styleを利用し、地図上に帰属を表示します。MobileのTile Provider、Native利用条件、User-Agent、帰属UIはこのWeb設定だけから確定しません。MapLibre Nativeでの利用を実装するIssue #544でOpenFreeMapの現行Terms / Privacyを再確認し、必要なProvider変更とプライバシー文書の更新を行います。オフライン取得や可視範囲外の一括取得は導入しません。

## 参照

- [Expo SDK reference](https://docs.expo.dev/versions/latest/)
- [Expo Router introduction](https://docs.expo.dev/router/introduction/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo monorepos](https://docs.expo.dev/guides/monorepos/)
- [MapLibre React Native Expo setup](https://maplibre.org/maplibre-react-native/docs/setup/expo/)
- [MapLibre React Native requirements](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/)
- Repository内の実装・手順: [Mobile handoff](../development/mobile-handoff.md)、[System overview](system-overview.md)、[Map Provider policy](../operations/map-provider.md)

公式Documentationの確認日: 2026-10-11。
