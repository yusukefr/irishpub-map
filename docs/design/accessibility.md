# Accessibility

公開画面はWCAG AAを基本とし、視覚表現と実装を同時に設計します。日常的なCoding Conventionは[UI とアクセシビリティ](../development/conventions.md#ui-とアクセシビリティ)、部品固有の要件は[Public UI Components](components.md)も参照してください。

## 基本要件

- Semantic HTMLと論理的な見出し階層を使う。
- すべての操作をKeyboardで実行でき、`:focus-visible`の共通Focus ringを表示する。
- Pointer操作の領域は原則44px以上にする。
- iconだけの操作、Map control、Inputには目的が分かるAccessible Nameを付ける。
- TextとSurface、Focus ringと背景はWCAG AA相当のcontrastを保つ。
- 選択、休業、正誤、errorを色だけで表さず、文字、icon、border、shapeを併用する。
- `prefers-reduced-motion`で不要なMotionを停止する。
- 結果件数など重要な動的変化は、必要に応じて`aria-live`で通知する。
- 日本語・英語でAccessible Name、読み順、状態通知が成立するようにする。

## Focusと非モーダルUI

Bottom SheetとDesktop panelは非モーダルです。背景を`inert`にせず、focus trapを設けません。開閉トリガー、閉じる操作、一覧から詳細、詳細から一覧の復帰先を明確にします。非表示の内容へfocusが残る場合は、対応するhandleやtriggerへ戻します。Escapeの作用対象は現在展開している領域を優先します。

## Map固有要件

- WebGLやMap tileが利用できなくても、店舗一覧と詳細から情報へアクセスできる状態を保つ。
- Markerだけを店舗情報への唯一の入口にせず、一覧と同じ選択状態を共有する。
- MarkerとMap controlはButtonとして操作でき、Accessible Nameと44px以上の領域を持つ。
- 営業、選択、非営業、現在地は色に加えてshape、border、textで区別する。
- 現在地取得は説明を読んだ後の明示操作でのみ開始し、要求中、成功、近隣なし、拒否、失敗、非対応を日英で伝える。
- Loading、Error、WebGL fallbackが店舗一覧の利用を妨げないようにする。

## Verification

axeのcritical / serious違反がないことを自動確認し、Keyboard順序、Focusの視認性、44px操作領域、色以外の状態表現、Screen Reader向けの動的通知を手動または挙動テストで補完します。DesktopとMobile、日本語と英語で確認し、axeだけを完了条件にしません。
