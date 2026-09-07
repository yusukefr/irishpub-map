# Design Tokens（Phase 1）

Public UIは`apps/web/app/globals.css`の意味ベースTokenを優先します。色名や任意値をコンポーネントへ追加せず、必要性を検討してからGlobal Tokenを増やします。

## Color

`brand-primary` #0B553E、`brand-interactive` #0F7B54、`brand-soft` #DDEBE4、`brand-accent` #C79B3B、`brand-accent-soft` #F1E5C7をブランド色とします。Surfaceは`surface-page` #F7F3EA、`surface-primary` #FFFDF8、`surface-raised` #FFFFFF、`surface-muted` #F2F5F2、`surface-inverse` #16231Cです。Text、Border、Success、Warning、Danger、Closed、Focusも意味ベースのTokenとして定義します。Goldはprimary actionに使いません。

主要なText/Surface、Focus ring/SurfaceはWCAG AAを基準に確認します。状態は色だけで表現せず、文字・icon・borderを併用します。

## TypographyとScale

UI／本文は`next/font`のNoto Sans JP、editorial contentはLoraを使用します。`display-lg`、`display-md`、`heading-lg`、`heading-md`、`heading-sm`、`body-lg`、`body-md`、`body-sm`、`label`、`caption`を用途別に使用します。

## Spacing、Radius、Elevation、Motion、Focus

Spacingは4px gridで4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64px、Radiusは8 / 12 / 18pxとpill、Elevationは3段階、Motionは120 / 180 / 280msです。`:focus-visible`は3pxのfocus ringと3pxのoffsetで統一し、`prefers-reduced-motion`時は既存CSSの動作停止を維持します。

## 既存CSSの移行方針

Phase 1では`--background`、`--surface`、`--ink`、`--muted`、`--line`、`--accent`、`--accent-strong`、`--danger`、`--content-card-radius`を削除せず、新しいSemantic Tokenへの互換マッピングとして維持します。後続Phaseで共通Componentから段階的に移行します。Map／Bottom Sheetの位置計算、Marker形状、Admin固有値は対象外です。
