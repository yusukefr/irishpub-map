# Desktop Map Pattern

Modern Irish ExplorerのDesktop探索画面は、[Design Tokens](tokens.md)と[Public UI Components](components.md)を組み合わせます。地図の操作領域を優先し、検索や位置情報のロジックを画面の配置へ結合しません。

## 配置と表示状態

- 981px以上: 左に`clamp(360px, 28vw, 400px)`の探索パネル、右に残り全幅の地図。地図の外周余白を除き、Headerは既存のコンパクトな高さを維持します。
- パネル内は検索、絞り込み操作、現在地操作、詳細条件、結果件数、店舗一覧の順。詳細条件は折りたたみ、初期状態では結果一覧を表示します。
- 詳細条件を開いてもDesktopでは結果を表示します。操作領域はパネル高の最大62%とし、検索・操作・結果件数を表示したまま詳細条件の内部だけをスクロールします。残りを一覧に割り当て、店舗一覧・店舗詳細も内部スクロールし、地図やページ全体をスクロールさせません。
- 980px以下は既存のOverlayと一覧・条件の排他的な開閉を維持します。Mobile Bottom Sheetの全面移行は別Phaseです。
- Desktopで条件と一覧を同時表示中に980px以下へ縮めた場合も、条件を優先して一覧を隠し、Overlayの重なりを防ぎます。
- 初回のDesktop判定は`matchMedia`の境界変更を購読します。明示した一覧の開閉はリサイズ後も尊重し、MapLibreインスタンスは作り直しません。SSRとhydrationの初期値を揃え、自動一覧表示でfocusを奪いません。

## 共通部品と操作

- Searchのclearは検索欄へfocusを戻します。FilterChipはcheckと`aria-pressed`、詳細条件は適用件数と`aria-expanded`で状態を伝えます。
- 都道府県の選択肢は表示言語の名称を保持し、市区町村コードの先頭2桁でJIS順に並べます。コードがない旧データは日本語マスタ順、不明な名称は末尾です。名称の一致で絞り込む既存仕様は変更しません。
- DesktopのPubCardは`density="compact"`を使用し、店舗名・地域・状態を主領域、タグと詳細操作を末尾の同じ行へ配置します。任意のmedia・metadata・distanceがある場合は全幅を確保します。
- CardとMarkerは同じ`selectedPubId`で同期します。閉じた一覧はDesktopでMarkerを選択すると再表示します。詳細から一覧へ戻る操作、閉じる操作、件数からの再表示を提供します。
- Escapeは展開中の条件パネルを優先して閉じ、条件ボタンへfocusを戻します。条件を閉じた状態のEscapeは結果を閉じ、件数ボタンへ戻します。非モーダルのため地図やHeaderの操作を遮断しません。
- 空結果の「条件をリセット」は検索語と詳細条件を両方解除し、検索欄へfocusを戻します。条件パネル内のリセットは従来どおり詳細条件だけを解除します。
- 位置情報は明示操作でのみ要求します。取得中・成功・近隣店舗なし・拒否・失敗・非対応の表示を維持し、位置情報や認証情報を保存・表示しません。
- HeaderのMapリンクはDesktopだけに追加し、`aria-current`と下線で現在ページを表現します。Explore Ireland・言語切替の遷移と保存動作は変えません。

## Mapと失敗時の表示

- Desktopの営業店舗MarkerはGreen、選択時は濃いGreen・拡大・輪郭を併用。非営業店舗は破線付きの異なる形状、現在地は円形の青い印として区別します。通常MarkerにGoldは使用しません。
- 既存MapにはClusterがないため、Design変更のためのクラスタリングは導入しません。
- MapLibre Controlsは共通部品と同じCream surface・Dark icon・radius-md・elevation-1・44px操作領域・visible focusを維持します。
- Loading / Error / WebGL fallbackはDesktopで地図の下端の補助表示にし、地図全体を覆いません。Reduced Motionでは既存の読み込みアニメーションを停止します。
- 初回地図読み込みのタイムアウト後は地図のみを再読み込みできます。親の検索語、詳細条件、選択店舗を保持し、旧Mapのイベント・Marker・タイマーを破棄してから再初期化します。
- 店舗取得の失敗は空結果と区別し、安全な日英文言と再読み込みを表示します。店舗なしの地図は引き続き操作可能です。再読み込みはページを再取得します。サーバーエラー本文や接続情報を公開UIへ渡しません。

## 検証

- Unit: Desktop初期表示とfocus、境界の切替、明示した開閉の維持、条件と一覧の共存、空結果の解除、Markerからの再表示、地図再試行、取得失敗、既存の検索・位置情報の回帰。
- Browser: `e2e/desktop-map.spec.ts`で日英1440×900・1280×800・768px境界の配置と実操作、Marker同期、詳細/戻る、キーボード、44px、axeを検証。`design-tokens.spec.ts`で390px / 360pxも確認します。
- Visual Regression: 固定fixtureと外部タイルを分離したStyleを使用。既存の`map-desktop-ja` / `map-desktop-en`、追加の店舗選択・条件展開を基準画像にします。実タイルの表示はブラウザで別途確認し、外部サービスの描画差分は基準へ含めません。
- Storybook: `DesktopPubCards` / `DesktopPubCardsEnglish`で長い名前、営業・休業・閉店・不明、選択、操作領域を確認できます。

配置・画面固有の調整は`desktop-map.module.css`、共通PubCardの情報密度は`ui.module.css`に置きます。DB・API・Map SDK・検索仕様の変更はありません。
