# Modern Admin Design

管理画面はPublic UIのブランドTokenとアクセシビリティ方針を共有しながら、作業一覧性と入力密度を優先します。個別画面へ適用する際はこの規則を使い、API、認証、DB、画面固有のBehaviorをデザイン変更だけで変えません。

## Layout

- 画面全体は既存の`surface-page`（Warm Cream）。Desktopは240pxのDeep Irish Green Sidebarと、残り幅を使うMainの2列です。
- SidebarはViewport高さいっぱいで固定し、Navigation領域内をスクロールできます。Release InformationはNavigation後に置き、Sidebarの下端から到達できます。
- Mainは横幅を固定しません。既存の`.admin-wide`はMain幅全体を使います。Main直下の`.admin-panel.admin-wide`は外枠を取り除き、Loginや単独Formの`.admin-panel`は必要な作業面として560pxを上限にします。画面全体を巨大な共通Cardで囲みません。
- MainのDesktop余白は上下32px、左右は24〜48px。狭い画面では上下24px、左右16pxです。panel内余白はDesktop 24px、狭い画面18pxです。
- 保護LayoutのCSS変更は`.admin-*`へスコープし、Public用のBody、Token、ComponentのStyleを上書きしません。

## Navigation

- Desktop Sidebarは240px。リンクは44px以上の操作領域を持ち、通常時は透明背景、Active時だけ薄いWhiteの面と左端のGold markerを使います。全リンクを枠付きボタンとして並べません。
- Active linkには`aria-current="page"`を付け、色に加えて面とmarkerで位置を示します。Navigation landmarkに日英のAccessible Nameを設定します。
- 760px以下ではSidebarをページ上部へ移し、`aria-expanded`と`aria-controls`を持つ開閉ボタンでNavigationを切り替えます。ボタンは日英ラベルと44px以上の操作領域を持ちます。開いたMenuは2列で配置し、Sign outを末尾に表示します。
- Release InformationはMobile Menuの外に置き、閉じた状態でも閲覧可能にします。Navigation内リンク、Sign outとRelease InformationはどのViewportでもTab操作で到達できます。

## Page Header

`AdminPageHeader`は`sectionLabel`、`title`、任意の`description`、任意の`actions`を受け取ります。1ページに主見出しは1つとし、Admin内の`h1`はPublic HeroのDisplay Scaleではなく既存の`heading-lg`（32px）を使います。Section labelは小さなUI text、説明はbody-smです。

Desktopは見出し・説明を左、主要操作を右へ配置します。Mobileは見出しの下へ主要操作を移し、翻訳後の長い文字列を省略しません。Primary ActionはDeep Irish Greenとし、GoldはPrimaryに使いません。

## Table / List

- Data TableはMain幅を使い、情報を一つのWhite surfaceにまとめます。Muted SurfaceのHeader、読みやすい行間、意味のあるColumn Headerを使い、Cardを二重にしません。
- 主情報は本文より強くし、日英併記・補足情報はbody-smとsecondary textを使います。長いURL、英語、日付でPage全体が横へ溢れないようにします。
- Statusは既存の`StatusBadge`があれば再利用し、ラベルとSemantic色・形状を併用します。状態を色だけで表しません。
- 行内操作には名前付きLink / Buttonを使い、44px程度の操作領域とVisible Focusを確保します。クリック可能な`tr`だけを操作手段にしません。
- 760px以下では表の情報を無言で削らず、既存の`data-label`等を使う縦並び表示へ切り替えるか、対象画面の仕様に合うListへ変えます。未実装Filterや動かないControlを追加しません。

## Form

- 既存のForm、Button、入力Componentを優先します。Page単位のFormは目的ごとにFieldset / Sectionへまとめ、Label、補足、Errorを入力と関連付けます。
- 標準Controlは44px以上を確保します。長文Markdown、日英翻訳、日時、Mediaなど入力内容に合わせて幅を使い、全項目を狭い2列に押し込みません。
- Save / Publish / Deleteの役割と状態を分け、Danger操作をPrimary Actionに見せません。Loading、未保存、Success、Validation Error、API ErrorをテキストとSemantic表示で伝えます。
- 既存の値保持、二重送信防止、確認、公開条件判定を維持します。

## Status / Feedback / Empty

- Success、Warning、Danger、Draft、Publishedは専用Semantic Tokenを使い、ラベルや説明を併記します。
- Inline feedbackは関連する操作またはFieldの近くに置き、動的な通知は既存の`role="status"` / `role="alert"`の使い分けを維持します。エラーに生のSecretや不要なAPI応答を表示しません。
- Empty stateは対象データがないことと、許可されている次の操作を説明します。DB未設定・権限不足・通信失敗を通常のEmptyと混同しません。

## Responsive / Accessibility

- 761px以上は240px Sidebar、760px以下はCompact Navigationと単列Mainにします。360px幅で固定幅や二重余白を作らず、日英の長文と主要操作を折り返します。
- すべての操作はKeyboardで到達・実行でき、`:focus-visible`を残します。Dark Sidebarはbrand-accent-softをFocus ringに使います。
- Semantic heading、landmark、labelを使い、重要な状態は色以外でも伝えます。Public UIのGlobal tokenやStyleをAdmin専用値へ置き換えません。

## Shared API and ownership

共通Headerは`apps/web/app/components/admin-page-header.tsx`の`AdminPageHeader`を使います。一覧、Form、Status、Feedback、Emptyは既存Component / classを優先します。このIssueでは共通デザイン規則とShellの基盤を用意し、各画面への本格適用はCalendar（#602）、Pubs / Tags / Statuses（#603）、Content / Media / Quiz（#604）、Loginと統合確認（#605）が担当します。
