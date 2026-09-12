# Content Page Pattern

Content PageはDiscover、Guide、Calendar、Quizなど、Irish PubとIrelandの文化・旅・物語を扱う編集領域です。Phase 5の具体的な画面構成は[Discover Editorial Pattern](../discover.md)を参照してください。

## Structure

```text
Header / Navigation
Eyebrow
Editorial Heading
Lead / Hero action
Main content
Related content
Map CTA
```

Top Pageは導入とMap CTA、主要Feature、Guide / Storyの順にします。下層Pageは現在位置を示すBreadcrumb、本文、閲覧中を除いたRelated Contentを持ちます。見出し階層は`h1`、`h2`、必要な場合の`h3`の順を保ちます。

## Hero、Heading、Content width

Heroはページの目的を最初に伝え、短いeyebrow、`font-display`のHeading、`font-sans`のleadを組み合わせます。長文本文は最大720px、編集キャンバスは最大1120pxを基準にします。760px以下では視覚順とDOM順を一致させて1列にします。

## CardとRelated Content

共通ContentCardの`default` / `feature` / `compact`を使います。FeatureとGold罫線は主要導線へ限定します。Related Contentは現在のPageを除外し、同じDiscover内の次の内容とMapへ戻る導線を示します。すべてを同じ強さのCardにしません。

## ImageとLong-form body

画像は[Visual Language](../visual-language.md#photography)の出典・許諾・alt要件を満たす場合だけ追加します。Markdown画像は本文幅を超えない720 × 405の16:9表示寸法を持ち、縦横比を維持して遅延読み込みします。写真がないContentに架空のthumbnailを置きません。長文では段落、List、Heading、Linkの間隔をTokenで揃え、過度なCard分割や装飾で読書を中断しません。

## Interactive content

Quizなどの状態は正誤の文言と記号を表示し、色だけへ依存しません。Calendarのfeatured itemはGold borderとSurfaceの組み合わせで示します。Actionは現在の段階と結果を日英で伝え、KeyboardとScreen Readerから利用できるようにします。

## Responsive verification

Discover Topと関係する下層PageをDesktop / Mobile、日本語 / 英語で確認します。長いHeading、本文幅、Breadcrumb、Related Content、CTA、Quiz状態、横overflow、Focus、axe、Console errorを確認します。
