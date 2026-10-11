# シーケンス図

## 公開画面で店舗を表示する

```mermaid
sequenceDiagram
  actor Visitor as 利用者
  participant Page as Next.js 公開ページ
  participant API as GET /api/pubs
  participant Repository as pub-repository
  participant Neon as Neon Postgres
  participant Explorer as PubExplorer / MapLibre
  participant MapProvider as OpenFreeMap

  Visitor->>Page: GET /
  Page->>API: サーバー側 fetch（必要時は API key を付与）
  API->>Repository: getPublishedPubs()
  alt DATABASE_URL が設定済み
    Repository->>Neon: pubs を読み出す
    Neon-->>Repository: 店舗データ
  else DATABASE_URL が未設定
    Repository-->>API: 空の店舗データ
  end
  Repository-->>API: 検証済み店舗データ
  API-->>Page: { pubs }
  Page-->>Visitor: HTML と店舗データ
  Explorer->>MapProvider: 初期表示範囲のスタイル・タイルを取得
  Note over Explorer,MapProvider: 現在地の許可前にも通常の地図表示で外部リクエストが発生
  Visitor->>Explorer: 検索・都道府県・タグ・閉業店舗表示を操作
  opt 利用者が「現在地から探す」を選択
    Explorer->>Visitor: ブラウザの位置情報利用を要求
    alt 対応し、利用者が許可して位置を取得
      Visitor-->>Explorer: 座標
      Explorer->>Explorer: メモリ上で最寄りの掲載都道府県を選択し、地図へ反映
      Explorer->>MapProvider: 表示範囲が変わった場合、新しい範囲のタイルを取得
    else 拒否・取得失敗・API非対応
      Visitor-->>Explorer: エラーまたは新しい位置情報なし
      Explorer-->>Visitor: 状態を通知。取得済み座標がなければ座標なし
    end
  end
  Explorer-->>Visitor: 地図と店舗一覧を更新
```

初期地図は位置情報の許可に関係なくスタイルと表示範囲のタイルをOpenFreeMapから取得します。位置情報は初回表示時に要求しません。取得した座標はReactのメモリ上で利用し、アプリのAPI、Neon、Cookie、Local Storageへ送信・保存しません。再取得が失敗しても既存の座標を消去しないため、以前取得した座標があればページ内に残り続けます。ページ終了または再読み込みで破棄します。現在地への地図移動後は新しい表示範囲のタイル要求が発生する場合があり、要求URLからおおよその閲覧地域を推測できる可能性があります。ブラウザ/OSが位置を特定するために行う処理はアプリから確認できません。詳細は[外部送信・プライバシー実態整理](../operations/privacy-and-external-transmission.md)と[地図プロバイダー利用方針](../operations/map-provider.md)を参照してください。

VercelのPreview Deployment Protectionが公開APIのサーバー側fetchをSSOへリダイレクトした場合、公開ページは静的データを複製せず店舗0件で表示します。実データを表示するにはSSO回避用の設定とDATABASE_URLを構成します。WebGLを初期化できないブラウザでは、地図の代わりに店舗一覧を案内します。

## 公開Guideを表示する

```mermaid
sequenceDiagram
  actor Visitor as 利用者
  participant Page as /discover/guides/[slug]
  participant Repository as content-repository
  participant Neon as Neon Postgres
  participant Renderer as 固定Renderer Allow List / Safe Markdown

  Visitor->>Page: Guide URLとlocaleを指定
  Page->>Repository: getPublishedContentBySlug(guide, slug, locale)
  alt Published GuideとTranslationが存在
    Repository->>Neon: kind・slug・localeをパラメータ化して取得
    Neon-->>Repository: Editorial Content
    Repository-->>Page: 検証済みPublished Content
    Page->>Renderer: kindに固定対応したRendererへMarkdownを渡す
    Renderer-->>Visitor: 許可要素と安全なURLだけを表示
  else 未登録・Draft・取得不能
    Repository-->>Page: nullまたは取得エラー
    Page-->>Visitor: 404または既存Error Boundary
  end
```

公開Guide / StoryはNeon Postgresを唯一のSource of Truthとし、許可要素・安全なURLに限定したMarkdown Rendererで表示します。Repository内の静的コンテンツへfallbackしません。Renderer選択はApplication側の固定Allow Listを使用し、DB値からComponent名やmodule pathを解決しません。

## 管理者が店舗を追加・更新・削除する

```mermaid
sequenceDiagram
  actor Admin as 管理者
  participant AdminPage as /admin/pubs
  participant Login as POST /api/admin/login
  participant Auth as admin-auth
  participant AdminAPI as /api/admin/pubs
  participant Repository as pub-repository
  participant Neon as Neon Postgres

  Admin->>AdminPage: GET /admin または /admin/pubs（セッション Cookie）
  AdminPage->>Auth: セッションを検証
  alt 有効なセッションがない
    Auth-->>AdminPage: 未認証
    AdminPage-->>Admin: /admin/login へリダイレクト
    Admin->>Login: ID とパスワードを送信
    Login->>Auth: 環境変数と資格情報を検証
    Auth-->>Login: 検証結果
    Login-->>Admin: Set-Cookie または 401 / 503
  else 有効なセッションがある
    Auth-->>AdminPage: 管理者情報
  end

  Admin->>AdminPage: 管理画面を表示
  AdminPage->>Repository: 現在の店舗を取得
  alt DATABASE_URL が設定済み
    Repository->>Neon: pubs を読み出す
    Neon-->>Repository: 店舗データ
  else DATABASE_URL が未設定
    Repository-->>AdminPage: 空の店舗一覧
  end
  Repository-->>AdminPage: 検証済み店舗データ
  AdminPage-->>Admin: 店舗管理フォーム

  Admin->>AdminAPI: POST / PUT / DELETE（Cookie 付き）
  AdminAPI->>Auth: セッションを検証
  Auth-->>AdminAPI: 認証済み
  alt DATABASE_URL が設定済み
    AdminAPI->>Repository: 店舗を作成・更新・削除
    Repository->>Neon: 変更を保存
    Neon-->>Repository: 結果
    Repository-->>AdminAPI: 店舗データまたは成功
    AdminAPI-->>Admin: 201 / 200
  else DATABASE_URL が未設定
    AdminAPI-->>Admin: 503（閲覧のみ）
  end
```

管理 API のリクエストとレスポンス、HTTP ステータスの詳細は[API 方針](../specs/api.md)を参照してください。

## 管理画面が参照マスタを取得する

```mermaid
sequenceDiagram
  actor Admin as 管理者
  participant MasterAPI as /api/admin/master/*
  participant Auth as admin-api / admin-auth
  participant Repository as master-repository
  participant Neon as Neon Postgres

  Admin->>MasterAPI: GET（セッション Cookie、必要時はprefectureCode）
  MasterAPI->>Auth: 管理者設定・署名・有効期限を検証
  alt 未認証または管理者設定不足
    Auth-->>MasterAPI: 拒否
    MasterAPI-->>Admin: 401
  else 認証済み
    Auth-->>MasterAPI: 許可
    MasterAPI->>Repository: 管理用DTOを取得
    Repository->>Neon: パラメータ化した参照クエリ
    Neon-->>Repository: マスタ行
    Repository-->>MasterAPI: 必要最小限のDTO
    MasterAPI-->>Admin: 200
  end
```
