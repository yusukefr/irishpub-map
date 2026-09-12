# Public UI Components

新しい公開画面は **既存Component → 既存Variant → 拡張 → 新規Component** の順で検討します。`apps/web/app/components/ui`の部品を直接importし、[Design Tokens](tokens.md)と組み合わせて使います。画面専用の色違いButtonやCardは追加しません。

## 部品カタログ

| 部品 / ファイル | APIと使い分け |
| --- | --- |
| Button / `button.tsx` | `variant="primary" / "secondary" / "ghost" / "destructive"`。同一操作領域のPrimaryは原則1つ。`loading`は連打を防ぎ、ラベルと幅を維持。`loadingLabel`は任意の翻訳済み読み上げ通知。 |
| IconButton / `button.tsx` | `label`必須。装飾アイコンは読み上げ対象外。`title`を省略するとlabelを補助表示するが、titleだけを名前にしない。 |
| Icon / `ui-icon.tsx` | search / close / location / plus / minus / menu / check。共通20px。意味は親のラベルで伝える。 |
| Input / `input.tsx` | `label`必須、`error`は入力の説明へ関連付ける。`hideLabel`でもラベルを保持。native属性・ref・既存aria-describedbyを引き継ぐ。 |
| Search / `search.tsx` | `value` / `onValueChange` / `label` / `clearLabel`を渡すcontrolled検索欄。clear後はinputへfocusを戻す。disabled / readOnly中はclearも無効。ロジック・通信・debounceは親の責務。 |
| FilterChip / `filter-chip.tsx` | `selected`を色・check・aria-pressedで表現。多数ある場合は`FilterChipGroup label`内で横スクロールさせる。 |
| StatusBadge / `status-badge.tsx` | `status`は共有PubStatus、`label`は翻訳済みの必須文字。操作ボタンではない。閉業は破線も併用。 |
| PubCard / `pub-card.tsx` | `pub` / `onSelect`が必須。`selected`は地図と親で同期する。`onShowDetails`は選択とは独立。任意の`media` / `metadata` / `distance`は表示専用で、DB形式を変えない。タグは2件と残り件数を表示。 |
| ContentCard / `content-card.tsx` | `titleId` / `title`が必須。`description` / `eyebrow` / `metadata` / `media` / `action` / childrenを組み合わせる。`default` / `image` / `text-only` / `feature` / `compact`。section内では`headingLevel={3}`で見出し階層を保てる。featureのみEditorial見出し・限定的なGold罫線。店舗選択カードとは分ける。 |
| MapControl / `map-control.tsx` | IconButtonを明るいsurface・radius-md・elevation-1で構成。`label`とアイコンを渡す。MapLibre生成DOMにもglobals.cssから同じ44px・focus・surfaceを適用する。 |
| BottomSheet / `bottom-sheet.tsx` | 非モーダルのcontrolled primitive。`state` / `onStateChange` / `title` / `resizeLabel` / `stateLabels` / childrenを渡す。詳細は下記。 |
| Header primitives / `header-primitives.tsx` | `BrandLink`、`NavigationLink current`、`HeaderAction`、`HeaderIconButton label`。暗いブランド背景用。Language Actionは既存`LanguageSwitcher`を使用し、Cookie保存やキーボードメニューを再実装しない。Menu ActionはHeaderIconButtonへIcon menuと操作を渡す。 |

ボタン・入力・chipは44px以上の操作領域とvisible focusを持ちます。disabledは破線・cursor・native属性を併用します。`className`は配置などの限定的な拡張用で、色や重要度の変更にはVariantを使います。CSS Modulesで画面固有CSSの意図しない上書きを避けます。

Input / Search / BottomSheetはstate・ID・focusを扱うClient Componentです。他の静的部品はServer Componentから利用でき、イベントを渡す場合は呼び出し側をclient境界内に置きます。`media`には適切なalt・寸法を持つ`next/image`などを渡してください。16:9の領域とobject-fitで画像の有無による崩れを防ぎます。Storybookの図はmedia slot確認用で実店舗の写真ではありません。

```tsx
<Search
  label="パブを探す"
  clearLabel="検索をクリア"
  placeholder="エリア・駅名・店名"
  value={query}
  onValueChange={setQuery}
/>

<PubCard pub={pub} selected={selectedId === pub.id} onSelect={setSelectedId} />
```

## Bottom Sheetの責務と操作

- `collapsed`は見出しとハンドルだけ、`medium`は50dvh、`expanded`は90dvh。safe-area-inset-bottomを下側へ確保します。これらの高さ、mediaの16:9、ドラッグ判定24pxは部品固有の値で、Global Tokenにはしません。
- ハンドルのクリック／タップは3段階を循環。上下ドラッグは1段階ずつ変更し、小さな手ぶれとキャンセルを無視します。合成clickによる二重更新を防ぎます。
- キーボードはArrowUp / ArrowDown、Home / End。Enter / Spaceはnative buttonのクリックとして利用します。
- 内容は内部スクロール。touch-action:noneはハンドルだけで、内容の通常スクロールを妨げません。内容内にfocusがあるままcollapsedへ変わった場合はハンドルへ戻します。
- 非モーダルなので背景をinertにせず、focus trapや自動的なfocus取得もしません。表示／非表示・画面上の配置・閉じた後のトリガーへのfocus復帰は親が管理します。
- reduced-motionでは高さのtransitionを停止。地図への配置とMap gesture調整はMap Explorerの親が管理します。

## 既存画面との接続

PubListのカード表示はPubCard、一覧と詳細の状態表示はStatusBadge、Map検索はSearch、タグ操作はFilterChip、現在地操作はButtonを使います。AppHeaderのリンクと言語トリガー、Discover内のカードも共通部品を使います。検索・DB・認証・言語保存の仕様は変更しません。Mapの配置・Panel・Markerは[Map Explorer Pattern](patterns/map-explorer.md)を参照してください。

PubCardの`density="compact"`はDesktop Resultsなど幅の限られた一覧向けです。店舗名・地域・状態の順を維持し、タグと詳細を同じ行に配置します。既定値`comfortable`は既存画面用です。`DesktopPubCards` / `DesktopPubCardsEnglish` Storyで長文と各状態を確認できます。

## Storybookと検証

Mobile Storyは追加addonなしで390px幅に制限した部品例です。実際のviewportとmedia queryの検証は下記Playwrightで行います。

`npm run storybook`で「Design System / Public UI」を開きます。Japanese / English / Mobileの全体例、ButtonStates / SearchStates / FilterChips / PubCards / ContentCards / BottomSheetStatesの部品別Storyがあります。locale controlで日英を切り替え、実ボタンでloading・選択・Sheetの各状態を確認できます。hover / focus / activeはpointerとキーボードで確認します。

- `npm test`: 共通部品のラベル、エラー、ref、検索クリア、選択、任意情報、Sheetの操作・キャンセル・focusと既存画面の回帰テスト。既存90%カバレッジ基準を維持。
- `npm run test:storybook`: 静的Storybookをビルド・配信し、Chromiumで日英 × 1440 / 1280 / 390 / 360px、横overflow、44px操作領域、focus、loading時の幅、axe critical/serious違反、Sheetのタッチ・内部スクロール・reduced-motionを検査。
- `npm run test:e2e`: 実アプリの検索・選択・言語・アクセシビリティとDesign Tokenの回帰確認。

ブラウザ検証はCIと同じPlaywright固定コンテナを使用します。画像は`test-results`、失敗時のtraceとHTML reportは既存CI artifactに保存します。Storybookはシステムフォントfallbackで、本番フォントはNext.jsのE2Eで確認します。自動axeは手動の見た目・操作確認を置き換えるものではありません。

Discover のページ構成、長文幅、関連導線、写真利用条件は[Discover Pattern](patterns/discover.md)を参照してください。

## Mobile Map

980px以下では共通BottomSheetを結果一覧・詳細の表示領域に使用します。初期はcollapsedで地図を優先し、件数ボタン・ハンドルからmediumへ、詳細操作からexpandedへ移ります。マーカー選択はcollapsedのときだけmediumへ開き、既に開いたSheetの高さとMap位置を保ちます。詳細の「戻る」は直前の一覧の高さを復元し、「閉じる」はcollapsedへ戻して検索・条件・選択店舗を維持します。

ハンドルのクリックは3段階を巡回し、上下ドラッグは1段階、矢印キー・Home / Endでも高さを変更できます。ドラッグ対象は44px以上のハンドルに限定し、結果一覧の内部スクロール・地図pan / pinch・条件行の横スクロールとは分離します。Sheetは非モーダルで、focus trapは設けません。共通BottomSheetの`className`で呼び出し側のMap領域に高さを収めます。

Map専用HeaderはモバイルのNavigationをネイティブdetailsのメニューへ集約し、ブランド・メニュー・言語切替を1行で表示します。検索と条件・現在地の操作行を上部へ、Sheetを下端へ配置します。Sheetの高さは100dvhの既存Map Shell内の利用可能領域を基準にし、下端safe areaを含みます。expandedと低い横向き画面では重なるzoom操作群を隠し、ハンドルから地図へ戻れます。現在地取得は従来どおり明示操作でのみ開始します。

`e2e/mobile-map.spec.ts`は固定fixtureで日本語・英語の390 / 360px、3段階、選択と詳細復帰、検索・条件、Map pan / pinch、ハンドルdrag、内部scroll、axe、低いviewportと横向きを検証します。OSソフトウェアキーボード、実機ブラウザバー、端末固有safe areaはviewportエミュレーションだけでは完全に再現できないため、実機確認と区別します。

## Component specification

各Componentは次の共通構造でレビューします。実装APIは`apps/web/app/components/ui`を正とし、追加・変更時はStoryとこの文書を同時に更新します。

### Button / Icon Button

- **Purpose:** 一つの明示操作を開始する。Icon Buttonは表示領域が限られる操作に使う。
- **Variants:** Primary / Secondary / Ghost / Destructive。Icon Buttonは同じ重要度のvariantとiconを組み合わせる。
- **States:** Default / Hover / Focus / Active / Disabled / Loading。
- **Usage:** 同一領域のPrimaryは原則1つ。NavigationにはLink、状態切替には適切なpressed属性を使う。
- **Accessibility:** 44px以上、visible focus、Icon Buttonの`label`必須。Loading中は`aria-busy`と連打防止を使い、幅を維持する。
- **Do:** 操作の重要度をvariantで選ぶ。**Don't:** GoldをPrimary背景にする、`div`へclickだけを付ける。
- **Example:** 保存はPrimary、キャンセルはSecondaryまたはGhost、削除はDestructive。

### Input / Search

- **Purpose:** 文字入力と店舗検索を提供する。
- **Variants:** 標準Input、Search。Searchはiconとclear actionを含むcontrolled component。
- **States:** Default / Focus / Disabled / Read only / Invalid、Searchは値あり / clear可能。
- **Usage:** `label`、必要に応じて`error`と既存`aria-describedby`を渡す。通信とdebounceは親で扱う。
- **Accessibility:** Hidden labelでもAccessible Nameを保持する。InvalidはborderとError textで伝え、clear後はInputへfocusを戻す。
- **Do:** native input属性を使う。**Don't:** placeholderだけをlabelにする、通信処理を共通Searchへ持たせる。

### Filter Chip / Status Badge

- **Purpose:** ChipはFilterの選択、Badgeは操作できない店舗状態を示す。
- **Variants:** Chipはselected / unselected、Badgeはopen / temporarily closed / closed / unknown。
- **States:** ChipはDefault / Hover / Focus / Active / Disabled。Badgeは操作stateを持たない。
- **Usage:** 多数のChipはlabel付きGroupへ置く。Badge labelはlocaleに合わせて必ず渡す。
- **Accessibility:** Chipは`aria-pressed`とcheck、BadgeはTextとBorderを使い、色だけに依存しない。
- **Do:** 状態の意味を文字で示す。**Don't:** Status BadgeをButtonに見せる、色だけで選択を示す。

### Pub Card

- **Purpose:** Mapと同期する店舗候補を比較し、選択と詳細操作を提供する。
- **Variants:** comfortable / compact、with photo / without photo、optional metadata / distanceあり・なし。
- **States:** Default / Hover / Focus / Selected / Closed。
- **Information hierarchy:** Pub name → Area / location → Status → metadata → distance → tags → action。
- **Usage:** `pub`と`onSelect`を必須とし、`selected`をMarkerと同期する。Tagは2件と残数を示す。長い日英名や欠損optional情報でも構造を保つ。
- **Accessibility:** Card全体を曖昧なclick targetにせず、選択Buttonと詳細Buttonを区別する。SelectedとClosedはborder、Surface、Textを併用する。
- **Do:** compactを幅の狭いDesktop railで使う。**Don't:** DB fieldを表示都合で増やす、Markerだけを選択手段にする。

### Content Card

- **Purpose:** DiscoverのFeature、Guide、Related Contentを構造化する。
- **Variants:** default / image / text-only / feature / compact。
- **States:** LinkやActionのHover / Focus / Active。Card自体に不要なclick stateを付けない。
- **Usage:** `titleId`と`title`を必須にし、Section内は`headingLevel={3}`で階層を保つ。FeatureとGold borderは主要導線だけに使う。
- **Accessibility:** `media`には追跡可能な画像、意味のあるalt、寸法を渡す。Actionは目的が分かるLink / Buttonにする。
- **Do:** Contentの役割に合うvariantを使う。**Don't:** 写真がないCardへ架空画像を追加する、すべてをFeatureにする。

### Map Control

- **Purpose:** Mapのzoomや現在地など、Mapに直接関係する操作を提供する。
- **Variants:** 共通Icon Button、MapLibre生成DOMへ同じvisual ruleを適用。
- **States:** Default / Hover / Focus / Active / Disabled。
- **Usage:** Cream surface、Dark icon、radius-md、elevation-1を使い、SheetやToolbarとの重なりを避ける。
- **Accessibility:** `label`必須、44px以上、Keyboard操作、visible focus。意味をiconだけへ依存させない。
- **Do:** Map上の位置をResponsiveに調整する。**Don't:** 操作領域をMap iconの見た目の大きさまで縮める。

### Bottom Sheet

- **Purpose:** Mobile Mapで結果一覧と詳細をMapとの関係を保って表示する。
- **Variants:** 非モーダルの`collapsed` / `medium` / `expanded`。
- **States:** 3段階の高さ、drag中、内部scroll、reduced motion。
- **Usage:** 結果はmedium、詳細はexpandedを基本とし、直前の一覧高さを保持する。Map gestureとhandle gestureを分離する。
- **Accessibility:** Handleは44px以上で、Arrow Up / Down、Home / End、Enter / Spaceを利用できる。State labelを読み上げ、非表示内容へfocusを残さない。
- **Do:** backgroundを操作可能な非モーダルとして扱う。**Don't:** focus trapや`inert`を付ける、内容全体をdrag領域にする。

### Navigation primitives

- **Purpose:** Brand、現在Page、Public navigation、Header actionを一貫して構成する。
- **Variants:** BrandLink / NavigationLink / HeaderAction / HeaderIconButton。Mobile menuは既存AppHeaderで構成する。
- **States:** Current / Hover / Focus / Active、Menu open / closed。
- **Usage:** Language SwitcherのCookie保存とKeyboard操作を再実装しない。Desktop / Mobileの詳細は[Navigation Pattern](patterns/navigation.md)を参照する。
- **Accessibility:** Currentは`aria-current`と下線、icon actionはlabel、`nav`はAccessible Nameを持つ。
- **Do:** Header primitivesを再利用する。**Don't:** Page固有Headerでlocaleやnavigation stateを複製する。
