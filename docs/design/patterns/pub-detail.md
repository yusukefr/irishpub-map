# Pub Detail Pattern

Pub Detailは、結果一覧とMap上の位置関係を失わずに店舗情報と次の行動を示します。DBやAPIのfieldを増やさず、存在する情報を明確な順序で表示します。

## Information hierarchy

1. Pub name
2. Area / location
3. Status
4. Important metadata
5. Distance
6. Tags
7. Detail actionとExternal links

任意情報がない場合は空の見出しやplaceholderを追加しません。長い日本語名・英語名、多数のTag、写真なしでも主情報と操作が読める状態を保ちます。

## ResultsからDetailへ

PubCardまたはMarkerの選択はMapと一覧のselected stateを同期します。「詳細」は選択とは独立した明示操作です。DesktopではSide Panel内の一覧を詳細へ置き換え、MobileではBottom Sheetを`expanded`へ変更します。遷移時は詳細の「結果へ戻る」へfocusを移し、現在の検索語とFilterを保持します。

## DetailからResultsへ

「結果へ戻る」は直前の一覧状態と高さを復元します。「閉じる」はDesktopの結果Panel、またはMobileのBottom Sheetを閉じ、結果を再表示するtriggerへfocusを戻します。Browser historyを使う別Page遷移ではなく、現行Explorer内のview stateとして扱います。

## Mapとの関係

選択中の店舗をMarkerとCardの両方で表現し、詳細を閉じても位置関係を確認できます。Mobileのexpanded SheetでMapが狭くなる場合も、handleからmedium / collapsedへ戻せます。Markerだけを詳細への唯一の入口にしません。

## StatusとExternal link

StatusBadgeは翻訳済みTextとBorderを使い、closedは破線も併用します。外部リンクは目的と遷移先が分かるlabelを持ち、`target="_blank"`の場合は`rel="noreferrer"`を付けます。位置情報、内部ID、非公開データを表示用metadataへ流用しません。

## Responsive / accessibility

情報のDOM順はDesktop / Mobileで変えません。Button、Link、Sheet handleは44px以上で、Keyboardから一覧→詳細→一覧を往復できます。詳細の内容が長い場合は結果領域内をscrollし、Page全体やMap gestureと競合させません。
