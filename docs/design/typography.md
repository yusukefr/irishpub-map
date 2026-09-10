# Typography

Irish Pub Mapは **Editorial Heading + Modern UI / Body** の組み合わせを使います。ページ全体をSerifにせず、情報の役割をFont Familyとscaleで区別します。具体的なsize / line-height / weightは[Design Tokens](tokens.md)を参照してください。

## UI / Body

`font-sans`はNoto Sans JPを第一候補とし、Search、Button、Filter、Pub Card、Navigation、Form、Map Control、日付、metadata、本文に使います。日本語と英語を同じUI構造で読みやすく表示し、OSやStorybookでは定義済みのsystem sans-serifへfallbackします。

## Editorial

`font-display`はLoraを第一候補とし、Discover Hero、Guide Heading、Feature Heading、文化コンテンツの見出しに限定します。Loraに日本語glyphがないため、日本語は`Yu Mincho` / serifへfallbackします。本文、操作、短いUI labelには使いません。

## Scaleの選び方

- `display-lg` / `display-md`: Hero。Viewportに応じて段階を切り替える。
- `heading-lg`: ページ見出し。
- `heading-md`: セクション見出し、Content Card見出し。
- `heading-sm`: Pub Card、compact cardなどの小見出し。
- `body-lg`: lead、導入文。
- `body-md`: 標準本文と入力値。
- `body-sm`: 補助説明、metadata、error。
- `label`: Button、Filter、field label、eyebrow。
- `caption`: 注記や補助情報。

## 日本語・英語

DOMと見出し階層はlocaleで変えません。英語の長い単語、日本語の長い店名、翻訳後のButton labelが収まるよう、固定幅や一行省略を既定にしません。英語の大文字化は短いeyebrowなど明確な役割へ限定し、日本語にletter-spacingや大文字化の見た目を機械的に適用しません。

## Do / Don't

- **Do:** `font-display`を文化的・編集的な見出しへ限定する。
- **Do:** `text-*` Tokenを意味に合わせ、見出し階層はSemantic HTMLで決める。
- **Don't:** 見た目の大きさだけを理由に`h1`〜`h3`を選ぶ。
- **Don't:** ページ全体、Form、Map ControlをSerifにする。
- **Don't:** 長い翻訳を省略して操作の意味を失わせる。
