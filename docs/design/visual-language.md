# Visual Language

Modern Irish Explorerは次の要素を組み合わせます。

```text
Warm Cream + Deep Irish Green + Brass / Warm Gold + Charcoal
+ Editorial Typography + Modern Map UI + Authentic Photography
```

実装値は[Design Tokens](tokens.md)、部品の使い分けは[Public UI Components](components.md)を正とします。

## ColorとSurface

- Deep Irish Greenはbrand、主要操作、選択と現在位置の文脈に使います。
- Brass / Warm Goldはeyebrow、罫線、featured contentなど限定的な強調に使います。Primary Actionの背景には使いません。
- Warm Creamをpage / primary surface、Whiteをraised surface、Charcoalを本文とinverse surfaceに使います。
- Success / Warning / Danger / Closed / Focusは専用のSemantic Tokenを使い、brand色で代用しません。
- 状態は文字、icon、border、shapeを併用し、色だけへ依存しません。

## Spacing、Radius、Elevation

4px gridのSpacing scaleを使います。44pxの`control`は操作領域の最低寸法であり、一般の余白には使いません。Radiusはsm / md / lg / pillを目的に合わせ、カードや操作ごとに新しい値を作りません。

Elevationは階層を伝える必要があるraised surface、floating control、選択状態へ限定します。すべてのカードを浮かせず、borderと余白で構造が伝わる場合は影を使いません。

## Motion

Motionは状態変化や空間のつながりを理解するために使います。fast / normal / slowとstandard easingを使い、装飾だけの連続Animationを追加しません。`prefers-reduced-motion`では移動や高さのtransitionを停止または即時化します。

## Iconography

共通`UiIcon`の20px iconを基本とし、線の太さと形を揃えます。装飾iconは読み上げ対象外にし、操作の意味はButtonのvisible labelまたはAccessible Nameで伝えます。iconだけで状態や専門用語を説明しません。

## Photography

写真は実在する場所・文化・人物を文脈どおりに表し、撮影者、出典、利用許諾を追跡できる場合だけ使います。意味のあるaltと寸法を設定し、16:9の表示でも主要被写体を失わない素材を選びます。権利や事実関係が不明な画像、生成画像、一般的なstock画像を文化紹介の事実画像として使いません。

## MapとMarker

Mapは探索画面の主要Contentです。営業店舗はGreen、選択時は濃いGreen・拡大・輪郭、非営業店舗は破線と異なるshape、現在地は青い円で区別します。通常MarkerにGoldは使いません。MapLibre controlはCream surface、Dark icon、radius-md、elevation-1、44px操作領域、visible focusを使います。

## Do / Don't

- **Do:** Semantic Tokenを役割で選び、同じ意味には同じ値を使う。
- **Do:** 情報構造を余白、見出し、Surfaceで表す。
- **Don't:** Greenを画面全体へ敷き、Irishらしさの代わりにする。
- **Don't:** Goldを主要Buttonや多数のカードへ反復する。
- **Don't:** 権利と文脈を確認できない写真を装飾として追加する。
