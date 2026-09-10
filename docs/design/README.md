# Irish Pub Map Design System

このディレクトリは、公開画面における **Modern Irish Explorer** の Source of Truth です。日本のアイリッシュパブを探す体験を小さな旅として楽しめるように、Mapの実用性、旅のガイドの温かさ、Irishらしさを一貫した判断へ落とし込みます。

## 最初に読む順序

Public UIを変更するときは、次の順で確認します。

1. Issueや仕様書にある現在のProduct Requirement
2. このREADMEと、変更に関係するDesign Documentation
3. [Design Tokens](tokens.md)と[Public UI Components](components.md)
4. 関係する[Screen Pattern](#documentation-map)
5. [Reference Screens](reference/README.md)
6. 現行実装とStorybook
7. Framework / Libraryの公式Documentation
8. `frontend-design`、`web-design-guidelines`などの外部Skill

Requirementと古いReference Screenが異なる場合はRequirementを優先し、Reference Screenを更新します。技術仕様は使用中バージョンの公式Documentationを優先します。現行の画面BehaviorをDesign変更だけで暗黙に変えません。

## Documentation map

| 目的                                    | 読む文書                                               |
| --------------------------------------- | ------------------------------------------------------ |
| ブランドと判断原則                      | [Design Principles](principles.md)                     |
| 色、余白、形、影、Motion、写真、Map表現 | [Visual Language](visual-language.md)                  |
| 実装値と追加基準                        | [Design Tokens](tokens.md)                             |
| 日本語・英語のFont roleとscale          | [Typography](typography.md)                            |
| Button、Card、Bottom Sheetなど          | [Public UI Components](components.md)                  |
| Semantic HTML、Keyboard、Map固有要件    | [Accessibility](accessibility.md)                      |
| Desktop / MobileのMap探索               | [Map Explorer](patterns/map-explorer.md)               |
| 検索と絞り込み                          | [Search / Filter](patterns/search-filter.md)           |
| 店舗詳細と一覧への復帰                  | [Pub Detail](patterns/pub-detail.md)                   |
| Discover / Guideなど                    | [Content Page](patterns/content-page.md)               |
| Map / Discover間の移動                  | [Navigation](patterns/navigation.md)                   |
| 実装済み画面の視覚基準                  | [Reference Screens](reference/README.md)               |
| Storybook、Visual Regression、axeの基盤 | [Design System開発基盤](foundation.md)                 |
| Phase 3 / Phase 5の実装記録             | [Desktop Map](desktop-map.md)、[Discover](discover.md) |

## AI Agent workflow

### Before implementation

1. このREADMEと関係するPattern、Component仕様を読む。
2. 既存Token、既存Component、Storyを検索する。
3. 関係するReference Screenを確認する。
4. Issue Requirement、現行Behavior、日英両方の表示条件を照合する。
5. Design Systemへの影響をTokens / Components / Patterns / Reference Screens / Documentationに分けて設計コメントへ記載する。

### During implementation

- 既存TokenとComponentを優先する。
- 意味のないarbitrary valueを増やさない。
- DOM順、見出し階層、Keyboard操作、Accessible Nameを保つ。
- DesktopとMobile、日本語と英語、長いラベルを同時に考慮する。
- 既存Behaviorを変える場合は、明示されたRequirementと対応テストを用意する。

判断順序は次のとおりです。

```text
Existing Requirement
  → Existing Design Token
  → Existing Component
  → Existing Pattern
  → Existing Reference Screen
  → Component Extension
  → New Token / Component
```

### After implementation

変更に関係する項目をStorybook、ブラウザ、Playwright、Visual Regression、axeで確認します。Desktopは原則1440pxまたは1280px、Mobileは390pxと360pxを使い、日本語・英語、横overflow、fixed / floating UIの重なり、Keyboard focusを確認します。実行できない項目はPR本文に理由を記載します。

## 新しいTokenとComponent

新しいTokenは、複数箇所で再利用する明確なSemantic Roleがあり、既存Tokenでは表現できない場合だけ追加します。`green-3`、`card-shadow-2`、`radius-17`、`special-padding`のような見た目や一箇所の都合による名前は使いません。CSS定義と[tokens.md](tokens.md)を同じ変更で更新します。

新しいComponentは **既存Component → 既存Variant → 拡張 → 新規Component** の順で検討します。新設時はPurpose、Variants、States、Accessibility、Storybook Storyを原則として用意し、[components.md](components.md)も更新します。

## UI Definition of Done

Design Systemへの準拠を、PRの影響範囲に応じて確認します。

### Design

- [ ] Requirement、関係するPattern、Reference Screenを確認した
- [ ] 既存ComponentとDesign Tokenを優先した
- [ ] 不要なarbitrary styleを追加していない
- [ ] Tokens / Components / Patterns / Reference Screens / Documentationへの影響をPR本文に記載した

### Responsive / i18n

- [ ] Desktopと390px程度のMobileを確認した
- [ ] 横overflow、fixed / floating UIの重なりがない
- [ ] 日本語・英語、長いlabel / headingで成立する

### Accessibility

- [ ] Keyboard操作とvisible focusを確認した
- [ ] 操作領域は原則44px以上でAccessible Nameがある
- [ ] 状態を色だけで表現していない
- [ ] axeのcritical / serious違反がない

### Verification

- [ ] 関係するStorybook Storyを確認した
- [ ] Browser visual checkを実施した
- [ ] 関係するVisual RegressionとE2Eを確認した
- [ ] `npm test`、`npm run typecheck`、`npm run lint`を実行した

## Design review checklist

- [ ] Map探索ではMapが主役になっている
- [ ] 目的、操作、結果の情報階層が明確である
- [ ] Shamrock、全面Green、Celtic Fontなどの固定観念に依存していない
- [ ] GoldをPrimary Actionとして使っていない
- [ ] 既存ComponentとTokenを使っている
- [ ] 日本語・英語、390pxで成立する
- [ ] Keyboard focusが見え、色以外でも状態が分かる
- [ ] Mapが利用できなくても店舗情報へ到達できる

## Maintenance

Public UIを変更するPRでは次を本文へ記載します。変更不要な項目も「変更なし」と明記します。

```text
Design System impact:

- Tokens:
- Components:
- Patterns:
- Reference Screens:
- Documentation:
```

実装変更のたびに、Design DocumentationとReference Screenの更新要否を確認します。Reference Screenが古い場合は、実装を画像へ戻さず[更新手順](reference/README.md)に従って画像を更新します。

Webと将来のNative Appで共有する対象はBrand Concept、Semantic Design Tokens、Typography Role、Spacing / Radius scale、IconとInteractionの原則です。Web Component自体の共有は前提にせず、Mobile App実装が具体化した時点でdesign token packageへの切り出しを再検討します。
