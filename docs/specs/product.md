# プロダクト仕様

## 概要

日本国内の Irish Pub を地図と店舗一覧から探せる Web アプリです。公開画面では検索・絞り込み・店舗詳細を提供し、設定済みの管理者は管理画面から店舗データを管理できます。

## 方針

- Web 版を優先し、店舗データと検索体験を継続的に改善する
- 店舗型とタグのロジックを `packages/shared` に集約し、将来のモバイルアプリでも共有できるようにする
- 地図を利用できない環境でも店舗一覧から情報に到達できるようにする
- Neonを店舗データの正とし、管理画面またはインポート手順からデータを永続化する

## 現在できること

### 公開画面

- 店舗を地図のピンと一覧で表示する
- 公開状態の店舗だけを地図と一覧へ表示する
- 店舗名、都道府県、市区町村で検索する
- 都道府県（JISコード順）、複数タグ（すべて一致するAND条件）で絞り込み、初期状態は営業中のみ表示し、必要に応じて閉業店舗を含める
- 検索語をクリアし、都道府県・タグ・閉業店舗表示などの絞り込み条件を個別にリセットする
- 店舗カードと地図ピンを相互に選択して、対応する店舗を強調表示する
- 地図ピンのhoverまたはtapで店舗名・住所・登録済みの公式サイト、Google Maps、InstagramリンクをPopup表示する
- 利用目的を説明した「現在地から探す」の明示操作後に位置情報の利用を求め、許可された場合は最寄りの掲載都道府県を選択して地図へ反映する
- 店舗の住所、営業状況、タグ、公式サイト、Google Maps、Instagram を詳細表示する
- WebGL を利用できない場合、地図の代わりに案内を表示して店舗一覧を利用できるようにする

- トップページはHeader / Map / compact Footerで構成するMap専用のViewport Shellとし、`100dvh`を基準に地図領域を確保します。Search / Filter / 現在地操作 / 結果件数はMap上のオーバーレイ、店舗一覧はDesktopではMap横のPanel、狭いViewportではMap内のBottom Sheetで表示します。
- `/privacy` と管理画面は通常のDocument Flowを維持し、Map専用のViewport制約を適用しません。

### 管理画面

- `/admin/login` で管理者がログインする
- `/admin` から `/admin/pubs` へ移動し、共通ナビゲーションでパブ・タグ・ステータスを切り替える
- 現在の管理機能をナビゲーション上のアクティブ表示で確認する
- `/admin/pubs` で公開・非公開を含む店舗一覧を確認し、店舗名、都道府県、市区町村、営業ステータス、タグ、公開状態を組み合わせて絞り込む。条件はURLに保持し、一覧は50件ずつ表示する
- 一覧で公開状態を確認・変更する。非公開化前は一般サイトから見えなくなることを確認し、公開時はサーバー側の公開条件を満たさない項目を一覧表示する
- Neon が設定されている場合は一覧の「新規登録」または各店舗の「編集」から `/admin/pubs/new`・`/admin/pubs/:id/edit` を開き、基本情報・所在地・日英翻訳・外部リンク・登録済みタグをセクションごとに追加・編集・下書き保存・削除する
- 管理APIでは公開・非公開の両方を取得し、新規店舗は非公開で作成する
- 管理者認証または `DATABASE_URL` が未設定の場合、書き込みを拒否して閲覧・設定案内に限定する
- 管理マスタAPIから都道府県、市区町村、タグ、営業ステータスを参照し、市区町村とタグは画面内検索、都道府県変更時は市区町村をリセットする。公開Validationの不足項目、フィールド別入力エラー、保存・削除中の状態をフォームへ表示する
- 編集フォームの入力内容が未保存の場合、ブラウザ離脱または管理画面内の別画面への移動前に確認する。保存・削除後は警告を解除し、一覧から編集画面へ移動した場合は一覧の検索条件を戻り先へ引き継ぐ。

### 管理画面改修で採用する運用

Issue #273で公開状態のDB保持、公開APIの絞り込み、管理取得への状態追加、新規店舗を非公開にする既定値を実装しました。Issue #277で管理一覧の絞り込み、公開状態の可視化、安全な公開切替UIとAPIを実装しました。Issue #279で店舗登録・編集を専用ルートへ分離し、所在地・座標・営業ステータス・英語翻訳・タグ・外部リンクを段階的に追加できるフォームを実装しました。一般公開には、日本語店舗名・日本語住所・都道府県・市区町村・緯度・経度・営業ステータスを必須とします。保存条件、型、API、セキュリティの確定内容は[管理店舗の下書き・公開設計](admin-pub-lifecycle.md)を参照してください。

## データと公開 API

- 公開画面は `GET /api/pubs` から検証済みの店舗データを取得します。
- `DATABASE_URL` がない環境では公開APIと管理画面は店舗0件を返します。Neonを設定した環境では、Neonの店舗データを読み書きします。
- API と管理画面の詳細は[API 方針](api.md)、データ項目は[店舗データ仕様](data.md)を参照してください。

## 表示言語

- 公開画面の主要な文言は日本語と英語を切り替えられます。選択はファーストパーティCookie `irishpub-map-locale` に30日間保存され、ページ遷移後も維持されます。未選択時はブラウザの言語設定が英語なら英語、それ以外は日本語で表示します。
- 翻訳対象の文言は `apps/web/app/lib/i18n` のlocale別JSONで管理します。新しい言語を追加する場合は、`packages/shared/src/locale.ts` の共通locale一覧、同じキー構造のJSON、言語メニューの表示情報を更新します。辞書の登録漏れはTypeScriptで検出します。
- 検索フォームと店舗詳細の一部ラベル、外部リンクの補助文言は現状日本語固定です。
- 店舗名、住所、都道府県などの登録データは翻訳せず、そのまま表示します。
- 地図の国名、都道府県相当の行政区名、主要都市名、市区町村・地域名は、同じ言語設定に連動し、`name:ja` または `name:en` を優先して、未登録時は既定の `name` を表示します。
- スペイン語はJSON構成で追加可能ですが、翻訳品質の確認が必要なため本対応には含めません。
- Cookieと外部送信の扱いは[外部送信・プライバシー実態整理](../operations/privacy-and-external-transmission.md)を参照してください。

## 今後の検討事項

- 店舗データの網羅性と更新フローの改善
- 店舗詳細で提供する情報の拡充
- 現在地からの距離順検索
- モバイルアプリの追加

## モバイル展開

将来的にモバイルアプリを追加する場合は、`apps/mobile` を追加し、`packages/shared` の型とデータ取得方針を共有します。候補技術は Expo / React Native と MapLibre 系または地図用途に適したライブラリです。

## Content拡張基盤

公開画面はRoot Layoutを共通のApplication責務として維持し、Mapは`app/(map)/layout.tsx`のViewport Shell、Story / Guide / Quizは`app/(content)/layout.tsx`の通常Document Flowへ配置するNested Layout構成を採用します。Route GroupはURLへ含まれず、既存の`/`、`/privacy`、`/admin`、`/api`のURLと責務は維持します。MapとContentの両Headerから`/discover`へ移動でき、ブランドLinkからMapへ戻れます。

Content記事はRepository内のTrusted MDXを対象とし、`apps/web/app/lib/content/`の明示的RegistryとRepository APIからのみ取得します。記事は`story` / `guide`のkind、独立したcategory、Locale非依存のStable Tag ID、日英両方のLoaderを持つ共通Metadataモデルで扱います。未登録slugはRepositoryが`null`を返すため、Route側で`notFound()`へ接続できます。

Explore Ireland Hubは`/discover`でStories placeholder、Registry由来のGuide一覧、Quiz導線、Irish Calendar導線を表示します。Guideは`/discover/guides/[slug]`でLocale別MDXを読み込み、未登録slugは404とします。`/discover/quiz`は後続のQuiz機能向けplaceholderであり、Question、Choice、Answer、Scoreは持ちません。

Irish Calendarは`/discover/calendar`で、Asia/Tokyo基準の当日と選択月に該当するアイルランド共和国の祝日・文化イベントを日英表示します。月別一覧は`?year=<年>&month=<月>`で当月の前後12か月を移動でき、範囲端ではそれ以上の移動を無効にします。不正または範囲外の年月は当月へ戻し、「今日のアイルランド」は選択月にかかわらず実際の当日を表示します。イベント内容は`apps/web/data/ireland/calendar.json`を唯一のデータソースとし、Calendar domain layerが起動時検証、暦日計算、当日・月別検索を担当します。開催日が年ごとに公式発表されるイベントは通常月の月別一覧に未確定と明示し、具体日を推測しません。Content Registry、API、DBには接続しません。

MDXのRaw HTML、Remote Compile、ユーザー投稿、Frontmatter Parserは導入しません。Sample Guideは`apps/web/content/discover/guides/sample/{ja,en}.mdx`で管理します。本番Guideも同じContent Registry / Trusted MDXの仕組みで追加し、`split-the-g`を最初の本番Guideとして提供します。本番Story、Quiz機能、関連記事、CMS、Content管理画面は後続Issueで追加します。
