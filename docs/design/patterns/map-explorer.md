# Map Explorer Pattern

Map Explorerは店舗を場所から探すための画面Patternです。[Design Principles](../principles.md)の **Map is the hero** を、DesktopとMobileで異なる構成へ実装します。

## Information hierarchy

1. Headerでブランド、現在位置、Discover、言語切替を示す。
2. Searchと主要FilterをMapの近くに置く。
3. Mapと結果件数を常に理解できる状態にする。
4. 一覧、店舗選択、詳細を同じ検索状態の中で切り替える。
5. Loading / Empty / Error / WebGL fallbackから次の操作を提示する。

## Desktop

```text
Header
+-------------------------------------------+
| Search / Results side panel | Map         |
| Filters / List / Detail     | Controls    |
+-------------------------------------------+
```

981px以上では左に`clamp(360px, 28vw, 400px)`のSide Panel、右に残り全幅のMapを置きます。Panel内はSearch、主要操作、詳細条件、結果件数、一覧または詳細の順です。Panelだけを内部scrollさせ、Mapとページ全体の高さを保ちます。詳細条件を開いても結果を表示し、詳細条件の内部だけをscrollします。

Desktopで条件と一覧を同時表示中に980px以下へ縮めた場合は、条件を優先して一覧を隠します。初回のDesktop判定は`matchMedia`の境界変更を購読し、明示した一覧の開閉はリサイズ後も尊重します。MapLibreインスタンスは作り直さず、自動表示でfocusを奪いません。

Desktop Resultsでは`PubCard density="compact"`を使い、店舗名・地域・状態を主領域、タグと詳細操作を末尾に配置します。MarkerとCardは同じ選択IDで同期し、閉じた一覧はMarker選択または件数操作で再表示します。詳細から一覧への戻る、一覧を閉じる操作を提供します。

## Mobile

```text
Header
Compact Search / Filter actions
Map
Bottom Sheet: collapsed / medium / expanded
```

980px以下ではMapを背景の主要領域にし、結果と詳細を非モーダルBottom Sheetに置きます。初期状態は`collapsed`、結果表示は`medium`、詳細は`expanded`です。単純なDesktop縮小や常時表示のSide Panelを使いません。Sheetの内容scroll、handle drag、Mapのpan / pinchを分離し、safe areaと低いviewportを考慮します。

## Selectionと状態遷移

MarkerとPubCardは同じ選択IDを共有します。Marker選択は対応Cardを選択し、閉じた結果領域を必要な高さまで開きます。一覧から詳細へ進んだときは直前の一覧状態を保持し、「戻る」で一覧へ、「閉じる」でSheetをcollapsedへ戻します。検索語、Filter、選択状態は不要に初期化しません。

Escapeは展開中の条件パネルを優先して閉じ、条件ボタンへfocusを戻します。条件が閉じているときは結果を閉じ、件数ボタンへfocusを戻します。空結果の「条件をリセット」は検索語と詳細条件を解除して検索欄へfocusを戻します。条件パネル内のリセットは詳細条件だけを解除します。

## Map visibilityとControl

Map controlとMarkerは44px以上の操作領域、Accessible Name、visible focusを持ちます。SheetやToolbarがControlへ重なる場合は、利用可能領域に合わせてControlを移動または非表示にします。現在地は利用者の明示操作でのみ取得し、位置情報を保存しません。

## Loading / Empty / Error

- 店舗0件でもMap操作とFilter resetを利用できる。
- 店舗取得失敗は0件と区別し、安全な日英文言と再読み込みを示す。
- Map loading / errorは一覧を覆わず、再試行時も検索と選択状態を保つ。
- WebGLが利用できない場合はfallbackを示し、一覧と詳細へのアクセスを維持する。
- Server error本文、接続情報、環境情報を公開画面へ表示しない。

位置情報は明示操作でのみ要求し、取得中・成功・近隣店舗なし・拒否・失敗・非対応を表示します。初回地図読み込みの再試行では、検索語、詳細条件、選択店舗を保持し、旧Mapのイベント・Marker・タイマーを破棄してから再初期化します。

## Responsive verification

Desktopは1440×900と1280×800、境界は981 / 980px付近、Mobileは390×844と360×800を基準にします。横overflow、Panel / Sheet / Map controlの重なり、長い日英文言、Keyboard、Map gesture、低いviewport、reduced motionを確認します。
