# Map Explorer Pattern

Map Explorerは店舗を場所から探すための画面Patternです。[Design Principles](../principles.md)の **Map is the hero** を、DesktopとMobileで異なる構成へ実装します。Phase 3の具体的な実装記録は[Desktop Map Pattern](../desktop-map.md)も参照してください。

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

981px以上では左に`clamp(360px, 28vw, 400px)`のSide Panel、右に残り全幅のMapを置きます。Panel内はSearch、主要操作、詳細条件、結果件数、一覧または詳細の順です。Panelだけを内部scrollさせ、Mapとページ全体の高さを保ちます。

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

## Map visibilityとControl

Map controlとMarkerは44px以上の操作領域、Accessible Name、visible focusを持ちます。SheetやToolbarがControlへ重なる場合は、利用可能領域に合わせてControlを移動または非表示にします。現在地は利用者の明示操作でのみ取得し、位置情報を保存しません。

## Loading / Empty / Error

- 店舗0件でもMap操作とFilter resetを利用できる。
- 店舗取得失敗は0件と区別し、安全な日英文言と再読み込みを示す。
- Map loading / errorは一覧を覆わず、再試行時も検索と選択状態を保つ。
- WebGLが利用できない場合はfallbackを示し、一覧と詳細へのアクセスを維持する。
- Server error本文、接続情報、環境情報を公開画面へ表示しない。

## Responsive verification

Desktopは1440×900と1280×800、境界は981 / 980px付近、Mobileは390×844と360×800を基準にします。横overflow、Panel / Sheet / Map controlの重なり、長い日英文言、Keyboard、Map gesture、低いviewport、reduced motionを確認します。
