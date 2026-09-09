# Design Tokens（Phase 1）

Public UIは`apps/web/app/globals.css`の意味ベースTokenを優先します。色名や任意値をコンポーネントへ追加せず、必要性を検討してからGlobal Tokenを増やします。

## Color

`brand-primary` #0B553E、`brand-interactive` #0F7B54、`brand-soft` #DDEBE4、`brand-accent` #C79B3B、`brand-accent-soft` #F1E5C7をブランド色とします。Surfaceは`surface-page` #F7F3EA、`surface-primary` #FFFDF8、`surface-raised` #FFFFFF、`surface-muted` #F2F5F2、`surface-inverse` #16231Cです。Text、Border、Success、Warning、Danger、Closed、Focusも意味ベースのTokenとして定義します。Goldはprimary actionに使いません。

主要なText/Surface、Focus ring/SurfaceはWCAG AAを基準に確認します。状態は色だけで表現せず、文字・icon・borderを併用します。

## TypographyとScale

UI／本文は`next/font`のNoto Sans JP、editorial contentはLoraを使用します。`display-lg`、`display-md`、`heading-lg`、`heading-md`、`heading-sm`、`body-lg`、`body-md`、`body-sm`、`label`、`caption`を用途別に使用します。

| Token        | font-size（root 16px時） | line-height | font-weight | 主な用途         |
| ------------ | ------------------------ | ----------- | ----------- | ---------------- |
| `display-lg` | 3rem（48px）             | 1.1         | 700         | 広い画面のHero   |
| `display-md` | 2.25rem（36px）          | 1.15        | 700         | 狭い画面のHero   |
| `heading-lg` | 2rem（32px）             | 1.25        | 700         | ページ見出し     |
| `heading-md` | 1.5rem（24px）           | 1.3         | 700         | セクション見出し |
| `heading-sm` | 1.25rem（20px）          | 1.4         | 600         | カード見出し     |
| `body-lg`    | 1.125rem（18px）         | 1.7         | 400         | 導入文           |
| `body-md`    | 1rem（16px）             | 1.6         | 400         | 本文             |
| `body-sm`    | 0.875rem（14px）         | 1.5         | 400         | 補助本文         |
| `label`      | 0.875rem（14px）         | 1.4         | 600         | 操作ラベル       |
| `caption`    | 0.75rem（12px）          | 1.4         | 500         | 注記             |

letter-spacingは全段階で通常の字間（`normal`）を基本とします。Tailwindでは`text-heading-md`だけでsize / line-height / weightが適用されます。狭い画面では`text-display-md md:text-display-lg`のように段階を選びます。通常CSSでは`font-size: var(--text-heading-md)`、`line-height: var(--text-heading-md--line-height)`、`font-weight: var(--text-heading-md--font-weight)`の3つを指定します。

Font Familyは別のCSS変数を参照するため`@theme inline static`で定義します。`font-sans`がUI、`font-display`がEditorialです。Loraに日本語グリフはないため、日本語Editorialは`Yu Mincho` / serifへfallbackします。`next/font`変数がないStorybookではシステムフォントへfallbackします。Storybookのフォント見た目は本番との一致を保証せず、実フォントの確認はNext.jsのE2Eで行います。

`static`は利用クラスの有無によらずTokenをCSSへ出力し、後続Componentや通常CSSから参照できるようにするための指定です。

StorybookのVite設定は`apps/web/postcss.config.mjs`を参照します。Webと同じTailwind処理を通すことで、未処理の`@theme`によりTokenが未定義になることを防ぎます。

参考: [Tailwind Theme Variableの参照とstatic](https://tailwindcss.com/docs/theme#referencing-other-variables)、[Typographyの関連値](https://tailwindcss.com/docs/font-size#customizing-your-theme)。

## Spacing、Radius、Elevation、Motion、Focus

Spacingは4px gridで4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64px、Radiusは8 / 12 / 18pxとpill、Elevationは3段階、Motionは120 / 180 / 280msです。`:focus-visible`は3pxのfocus ringと3pxのoffsetで統一し、`prefers-reduced-motion`時は既存CSSの動作停止を維持します。

## 既存CSSの移行方針

Phase 2の共通操作寸法として`--spacing-control: 44px`を追加します。Button / IconButton / Input / Chip / MapControl / Header操作の最低寸法へ適用し、一般的な余白とは区別します。共通ComponentのAPIと検証手順は[Public UI Components](components.md)を参照してください。

Phase 1では`--background`、`--surface`、`--ink`、`--muted`、`--line`、`--accent`、`--accent-strong`、`--danger`、`--content-card-radius`を削除せず、新しいSemantic Tokenへの互換マッピングとして維持します。後続Phaseで共通Componentから段階的に移行します。Map／Bottom Sheetの位置計算、Marker形状、Admin固有値は対象外です。

互換変数は先頭の`:root`へ一元化し、後半でliteralによる再定義をしません。`--gold` / `--gold-soft` / `--focus`もそれぞれ`brand-accent` / `brand-accent-soft` / `focus-ring`を参照します。`body`のフォントは`var(--font-sans)`だけで定義し、共通`:focus-visible`はwidth / offset / colorのTokenを利用します。管理ナビゲーションの暗い背景用focusなど、個別のアクセシビリティ調整は維持します。

`tests/web/design-tokens.test.ts`が重複した互換変数とbody fontの再定義を検出します。`e2e/design-tokens.spec.ts`は日本語・英語、1440 / 1280 / 390 / 360pxでMapとDiscoverのcomputed style、実フォントの読み込み、横overflow、JavaScriptエラーを検査します。さらにToken値を一時変更し、bodyとfocusへ反映されることを検証します。
