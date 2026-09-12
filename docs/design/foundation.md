# Design System 開発・検証基盤

この文書は、Public UIの実装をStorybook、Visual Regression、アクセシビリティ検査で確認するためのプロジェクト固有の基盤を定義します。Designの判断順序と参照先は[Design Documentation Router](README.md)、Tokenの定義は[Design Tokens](tokens.md)を参照してください。

## Storybook

`npm run storybook` でStorybookを起動します。設定は `.storybook/` に置き、`apps/web/app/globals.css` を共有します。Storybook専用のStyle定義は追加しません。

最初の基準Storyは `AppHeader` です。日本語・英語の両方で公開ナビゲーションと言語切替のレイアウトを確認します。後続の共通UI Componentは、実装と同時に状態・locale・長文のStoryを追加します。

## Visual Regressionとアクセシビリティ

`e2e/visual-regression.spec.ts`は、公開MapのDesktop日本語・英語とMobile日本語、DiscoverのDesktop / Mobile日本語・英語をスクリーンショット比較します。Map Mobile英語はこのVisual Regressionの対象ではなく、`e2e/mobile-map.spec.ts`の挙動・画面比較で確認します。基準画像の更新は、意図したUI変更をレビューしたうえで`--update-snapshots`を明示して実行します。

`e2e/accessibility.spec.ts`は`@axe-core/playwright`で公開Map（`/`）とDiscover Top（`/discover`）、Calendar（`/discover/calendar`）、Quiz（`/discover/quiz`）、Guide（`/discover/guides/split-the-g`）のcritical / serious違反を検出します。axeだけでは保証できないため、キーボード操作、visible focus、44px程度の操作領域、色以外の状態表現、日英表示はブラウザ確認と既存E2Eで補完します。

## 実装フロー

```text
Design Tokens → Shared UI Component + Story → Screen実装
  → implementation review → browser確認
  → Playwright screenshot + axe → E2E
```

Visual Regressionの基準画像は、CIのE2E jobと同じPlaywright 1.62.1 Noble Docker imageで生成・比較します。image digestは`.github/workflows/ci.yml`へ固定し、基準画像更新時も同じimageを使用します。
