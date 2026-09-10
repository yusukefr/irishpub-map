# Navigation Pattern

NavigationはMap、Discover、Guide、Quiz、Calendarを一つのPublic Productとしてつなぎます。共通`AppHeader`とHeader primitivesを使い、locale保存や現在地表示をPageごとに再実装しません。

## Desktop

Brandを先頭に置き、MapとDiscoverへの主要Link、必要なContent navigation、Language Switcherを一行で表示します。現在Pageは`aria-current`と下線など色以外の表現で示します。Primary navigationとPage内CTAを同じ見た目にしません。

## Mobile

Brand、Menu、Language操作を一行に収め、Navigation Linkはnative `details`のMenuへまとめます。Menu triggerとLanguage triggerは44px以上、Accessible Name、visible focusを持ちます。Menuを開いてもPageの主要ContentやMap状態を初期化しません。

## BreadcrumbとBack

Discoverの下層PageはBreadcrumbで現在位置を示します。Explorer内の一覧・詳細の往復は[Pub Detail Pattern](pub-detail.md)のBack操作を使い、Site navigationやBrowser historyのBackと混同しないlabelにします。

## Labelsとlocale

Navigationの構造と順序は日本語・英語で共通にし、labelは翻訳済み辞書から取得します。言語切替は既存Cookie保存とKeyboard操作を維持します。長い英語labelでもHeaderからはみ出さず、MobileではMenu内で折り返します。

## Accessibility

`nav`には目的が分かるAccessible Nameを付け、LinkにはLink、Menu triggerにはButton / Summaryなど役割に合う要素を使います。現在位置を色だけで示さず、Focus順をDOM順と一致させます。外部Linkは視覚・Accessible Nameから目的を判断できるようにします。
