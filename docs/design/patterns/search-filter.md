# Search / Filter Pattern

Searchは店舗探索の最優先操作です。検索語、主要Filter、詳細Filter、結果件数、resetを一つの状態として扱い、Mapと一覧へ同じ結果を反映します。

## Priority

1. 店名・エリアなどを入力するSearch。
2. 頻繁に使う条件と現在地操作。
3. 詳細Filterを開く操作と適用件数。
4. 結果件数と結果表示の操作。
5. 条件全体または詳細条件だけのreset。

Searchは共通`Search`を使い、clear後はInputへfocusを戻します。通信やdebounceは親の責務です。

## Filter ChipとActive state

Filter Chipは`aria-pressed`、check、Surface、Borderを併用して選択を伝えます。複数のChipはlabel付きGroupにまとめ、Mobileでは横scrollできます。適用件数は詳細Filterのtriggerへ表示し、展開状態は`aria-expanded`で伝えます。

都道府県などの選択肢は表示言語を維持し、現行のデータ順・絞り込み仕様を変えません。位置情報の応答が遅れても、利用者が明示的に選んだ都道府県を上書きしません。

## Expanded / collapsed

Desktopでは詳細Filterと結果一覧を同時に表示でき、詳細領域だけを内部scrollさせます。Mobileでは詳細Filterを開く間、結果Sheetをcollapsedにして操作の重なりを避けます。Escapeは展開中のFilterを閉じてtriggerへfocusを戻し、その後に結果領域を閉じます。

## EmptyとReset

空結果では、条件に一致しないこととreset操作を結果領域内に示します。空結果のresetは検索語と全Filterを解除してSearchへfocusを戻します。詳細Filter内のresetは詳細条件だけを解除し、検索語の意味を保ちます。取得Error時のretryを空結果のresetと混同しません。

## Responsive / accessibility

Search、Chip、Select、Buttonは44px以上、visible labelまたはAccessible Name、共通Focusを持ちます。結果数の変化は必要に応じて`aria-live`で通知します。390px / 360pxではToolbarとChip Groupの横overflowを意図したGroup内だけに限定し、Page全体を横scrollさせません。
