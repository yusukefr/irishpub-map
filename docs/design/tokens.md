# Design Tokens

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

`--spacing-control: 44px`はButton / IconButton / Input / Chip / MapControl / Header操作の最低寸法へ適用し、一般的な余白とは区別します。共通ComponentのAPIと検証手順は[Public UI Components](components.md)を参照してください。

`--background`、`--surface`、`--ink`、`--muted`、`--line`、`--accent`、`--accent-strong`、`--danger`、`--content-card-radius`は既存実装との互換マッピングとして維持します。Map／Bottom Sheetの位置計算、Marker形状、Admin固有値はGlobal Tokenの対象外です。

互換変数は先頭の`:root`へ一元化し、後半でliteralによる再定義をしません。`--gold` / `--gold-soft` / `--focus`もそれぞれ`brand-accent` / `brand-accent-soft` / `focus-ring`を参照します。`body`のフォントは`var(--font-sans)`だけで定義し、共通`:focus-visible`はwidth / offset / colorのTokenを利用します。管理ナビゲーションの暗い背景用focusなど、個別のアクセシビリティ調整は維持します。

`tests/web/design-tokens.test.ts`が重複した互換変数とbody fontの再定義を検出します。`e2e/design-tokens.spec.ts`は日本語・英語、1440 / 1280 / 390 / 360pxでMapとDiscoverのcomputed style、実フォントの読み込み、横overflow、JavaScriptエラーを検査します。さらにToken値を一時変更し、bodyとfocusへ反映されることを検証します。

## Token reference

この表は`apps/web/app/globals.css`の`@theme static`と`:root`に対応します。CSSを変更した場合は同じPRでこの表を更新します。

### Brand / Surface / Text / Border / Semantic colors

| Token               | Role                          | Value     | Usage                                  |
| ------------------- | ----------------------------- | --------- | -------------------------------------- |
| `brand-primary`     | Brandと主要操作               | `#0B553E` | Primary Button、brand text、選択の強調 |
| `brand-interactive` | Interactive accent            | `#0F7B54` | linkや既存interactive表現              |
| `brand-soft`        | 選択の淡いSurface             | `#DDEBE4` | selected Chip / Card、open status      |
| `brand-accent`      | Brass Gold                    | `#C79B3B` | feature border、限定的な編集上の強調   |
| `brand-accent-soft` | Goldの淡いSurface             | `#F1E5C7` | warning / featured background          |
| `surface-page`      | Page background               | `#F7F3EA` | Public page全体                        |
| `surface-primary`   | Cream surface                 | `#FFFDF8` | Panel、Secondary Button                |
| `surface-raised`    | Raised surface                | `#FFFFFF` | Card、Input                            |
| `surface-muted`     | Muted surface                 | `#F2F5F2` | disabled、tag、closed card             |
| `surface-inverse`   | Dark surface                  | `#16231C` | inverse Header / footer                |
| `text-primary`      | Main text                     | `#18211D` | Heading、Body、Input                   |
| `text-secondary`    | Supporting text               | `#5A6B61` | metadata、caption、placeholder         |
| `text-inverse`      | Inverse text                  | `#FFFDF8` | Deep Green / Charcoal上の文字          |
| `text-brand`        | Brand heading / action        | `#0B553E` | Heading、secondary action              |
| `border-default`    | Structural border             | `#CFDBD1` | Card、Panel、Control                   |
| `border-strong`     | Strong neutral border         | `#9DB4A6` | unselected Chipなど                    |
| `border-brand`      | Selected / interactive border | `#0B553E` | Button、selected state                 |
| `success`           | Success / open                | `#075235` | 営業状態、成功通知                     |
| `warning`           | Warning / temporary state     | `#745300` | 一時休業、注意                         |
| `danger`            | Error / destructive           | `#B42318` | error、Destructive Button              |
| `status-closed`     | Closed / unavailable          | `#4D5A55` | 閉店状態。破線やTextを併用             |
| `focus-ring`        | Keyboard focus                | `#175CD3` | 全Public interactive element           |

**Do:** 役割に対応するTokenを選び、状態にはText / icon / borderも使います。**Don't:** literal colorを同じ役割へ追加する、GoldをPrimary Actionにする、brand色をerrorやfocusへ流用することは避けます。

### Spacing / control

| Token      | Value  | Usage                         |
| ---------- | ------ | ----------------------------- |
| `space-1`  | `4px`  | 細いgap、selected border      |
| `space-2`  | `8px`  | Component内の標準gap          |
| `space-3`  | `12px` | compact padding / gap         |
| `space-4`  | `16px` | 標準Component padding         |
| `space-5`  | `20px` | icon size、補助余白           |
| `space-6`  | `24px` | Card / section padding        |
| `space-8`  | `32px` | section gap                   |
| `space-10` | `40px` | 広い余白、Search icon inset   |
| `space-12` | `48px` | section / Search action inset |
| `space-16` | `64px` | 大きなsection separation      |
| `control`  | `44px` | Pointer操作領域の最低寸法     |

**Do:** 4px gridから、情報のまとまりに合う段階を選びます。**Don't:** `control`を一般余白として使う、`17px`のような一箇所だけの値をGlobal Tokenへ追加することは避けます。Map座標やBottom Sheet高さなど計算上の値はComponent固有値として理由を記録します。

### Radius / elevation

| Token         | Value                             | Usage                              |
| ------------- | --------------------------------- | ---------------------------------- |
| `radius-sm`   | `8px`                             | 内部Button、small control          |
| `radius-md`   | `12px`                            | Input、Button、Map Control         |
| `radius-lg`   | `18px`                            | Pub Card、Content Card             |
| `radius-pill` | `9999px`                          | Filter Chip、Status Badge          |
| `elevation-1` | `0 4px 12px rgb(22 35 28 / 8%)`   | Search、Map Control、selected Card |
| `elevation-2` | `0 12px 30px rgb(22 35 28 / 14%)` | Floating panel / Sheet             |
| `elevation-3` | `0 18px 42px rgb(22 35 28 / 20%)` | 最上位の一時的Surface              |

**Do:** BorderとSurfaceだけで階層が分かりにくい場合にElevationを使います。**Don't:** Cardの種類ごとにshadow番号を増やす、すべてのContentを浮かせることは避けます。

### Motion / focus

| Token                    | Value                        | Usage                       |
| ------------------------ | ---------------------------- | --------------------------- |
| `motion-duration-fast`   | `120ms`                      | hover、press、small state   |
| `motion-duration-normal` | `180ms`                      | 標準transition              |
| `motion-duration-slow`   | `280ms`                      | Sheetなど空間変化           |
| `ease-standard`          | `cubic-bezier(0.2, 0, 0, 1)` | Public UIの標準easing       |
| `focus-ring-width`       | `3px`                        | `:focus-visible` outline    |
| `focus-ring-offset`      | `3px`                        | Surfaceからのoutline offset |

Reduced Motionではtransitionを停止または即時化します。Focus ringは背景色に関係なく視認できる専用色を使い、独自の`outline: none`で消しません。

## Token追加ルール

次のすべてを確認します。

1. 複数箇所で再利用されるか。
2. 色名や画面名ではなくSemantic Roleがあるか。
3. Componentの計算や固有形状にだけ必要な値ではないか。
4. 既存TokenやComponent variantで代替できないか。
5. CSS、Documentation、関係するStory / Visual Regressionを同じ変更で更新したか。

`green-3`、`card-shadow-2`、`radius-17`、`special-padding`のような名前は追加しません。
