# Discover Editorial Pattern

Discover は Irish Pub Map の文化・旅・物語を扱う編集コンテンツ領域です。Map と同じ意味的 Design Token と Header を使い、Warm Cream のページ、Deep Irish Green の見出し、Brass Gold の限定的な強調で同じブランドとして見せます。

## 情報構造

Discover トップは導入と Map CTA、Calendar / Quiz、Guides、Stories の順に配置します。Calendar は年間の文化をたどる主要導線、Quiz は短時間で参加できる導線です。Guide は記事ごとの ContentCard に分け、タイトル、概要、公開日、操作を一覧で比較できます。Stories は公開コンテンツがない間だけ compact な準備中表示にします。

Calendar、Quiz、Guide は現在位置を示すパンくずを持ちます。本文の後には3件の関連コンテンツを置き、閲覧中のページを除いた Discover コンテンツと Map へ移動できるようにします。

## Typography とレイアウト

ページ、セクション、記事、特集カードの見出しには `font-display` を使います。本文、日付、分類、操作には `font-sans` を使います。長文本文は最大720pxとし、見出し階層を `h1`、`h2`、必要な場合は `h3` の順で保ちます。

デスクトップでは最大1120pxの編集キャンバスを使い、トップの主要導線は Calendar を広くした非対称グリッドにします。Calendar は日付レールと本文の2列で表示し、項目ごとの影や浮遊カードを使いません。760px以下では全パターンを1列にし、DOM順を読み順として維持します。

## ContentCard

Discover では共通 ContentCard の `default`、`feature`、`compact` を使います。セクション内のカードは `headingLevel={3}` を指定し、セクション見出しとの階層を保ちます。`feature` の Gold 罫線は主要導線だけに使います。写真のないカードへ装飾画像や架空のサムネイルを追加しません。

写真を追加する場合は、次をすべて満たす素材だけを `media` slot に渡します。

- 撮影者、出典、利用許諾を追跡できる
- 実在する場所、文化、人物を文脈どおりに表す
- 過度な彩度や演出で Irish Pub Map の実用性を損なわない
- 意味を伝える代替テキストと適切な画像寸法を持つ
- 16:9 へ切り抜いても主要被写体や情報が欠けない

権利や事実関係が確認できない素材、生成画像、一般的なストック画像を文化紹介の事実画像として使いません。

## 状態とアクセシビリティ

Quiz は正解に `✓` と文言、不正解の選択に `×` と文言を表示し、色だけに依存しません。Calendar の featured event は Gold の罫線と surface を組み合わせます。リンクとボタンは44px以上の操作領域と共通 focus ring を使います。

ブラウザ確認では Discover トップを日本語・英語それぞれ 1440 / 1280 / 390 / 360px で確認します。Calendar、Quiz、Guide もデスクトップとモバイルで見出し階層、横 overflow、主要リンク、Quiz の回答状態、console error、axe の critical / serious 違反を確認します。
