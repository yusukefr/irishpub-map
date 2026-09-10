# Design System 開発基盤（Phase 0）

## 目的と優先順位

Public UIは、次の優先順位で設計・実装・レビューします。外部Skillは補助的なレビュー基準であり、プロジェクト固有の方針を上書きしません。

1. Current Product Requirement
2. Current Design Documentation（[入口](README.md)と関連文書）
3. Existing Design Tokens
4. Existing Components
5. Existing Screen Patterns
6. Reference Screens
7. External Skills（`web-design-guidelines`、`frontend-design`など）

`frontend-design` は Modern Irish Explorer の視覚言語、既存トークン、レスポンシブ規則を守る範囲で用います。新しいUIパターンや色を自由に追加する根拠にはしません。

Reference Screenは現在の実装を視覚的に確認する資料です。上位のRequirement、Documentation、Token、Component、Patternと競合する場合は、実装を画像へ戻さずReference Screenを更新します。FrameworkやLibraryの技術仕様は使用中バージョンの公式Documentationを優先します。

## Design Token方針

Tailwind CSS 4の `@theme` をToken宣言の基盤とします。`apps/web/app/globals.css`の正式なToken名・値・使用方法は[Design Tokens](tokens.md)を参照してください。

Phase 1で定義したColor、Typography、Spacing、Radius、Elevation、Motionへ、既存のCSSカスタムプロパティ・個別値を段階的に移行します。新しいCSS Framework、MUI、Chakra UI、shadcn/uiの全面導入は行いません。

## Component確認

`npm run storybook` でStorybookを起動します。設定は `.storybook/` に置き、`apps/web/app/globals.css` を共有します。Storybook専用のStyle定義は追加しません。

最初の基準Storyは `AppHeader` です。日本語・英語の両方で公開ナビゲーションと言語切替のレイアウトを確認します。後続の共通UI Componentは、実装と同時に状態・locale・長文のStoryを追加します。

## Visual Regressionとアクセシビリティ

`e2e/visual-regression.spec.ts`は、公開MapのDesktop日本語・英語とMobile日本語、DiscoverのDesktop / Mobile日本語・英語をスクリーンショット比較します。Map Mobile英語はこのVisual Regressionの対象ではなく、`e2e/mobile-map.spec.ts`の挙動・画面比較で確認します。基準画像の更新は、意図したUI変更をレビューしたうえで`--update-snapshots`を明示して実行します。

`e2e/accessibility.spec.ts`は`@axe-core/playwright`で公開Map（`/`）とDiscover Top（`/discover`）、Calendar（`/discover/calendar`）、Quiz（`/discover/quiz`）、Guide（`/discover/guides/split-the-g`）のcritical / serious違反を検出します。axeだけでは保証できないため、キーボード操作、visible focus、44px程度の操作領域、色以外の状態表現、日英表示はブラウザ確認と既存E2Eで補完します。

## 実装フロー

```text
Design Tokens → Shared UI Component + Story → Screen実装
  → web-design-guidelines review → agent-browser確認
  → Playwright screenshot + axe → E2E
```

Visual Regressionの基準画像は、CIのE2E jobと同じPlaywright 1.62.1 Noble Docker imageで生成・比較します。image digestは`.github/workflows/ci.yml`へ固定し、基準画像更新時も同じimageを使用します。

`web-design-guidelines`の外部レビュー基準は、上流commit `e3d624baaf29dc1fc645aff3e38f03e564d2d6b1`からvendorしています。実行時に未固定の外部Instructionは取得しません。更新はvendorファイル・Skill metadata・`skills-lock.json`を同一のレビュー済み変更で更新します。
