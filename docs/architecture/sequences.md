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
  Visitor->>Explorer: 検索・都道府県・タグ・閉業店舗表示を操作
  opt 「現在地から探す」を選択
    Explorer->>Visitor: ブラウザの位置情報利用を要求
    Visitor->>Explorer: 位置情報利用を許可
    Explorer->>Explorer: 最寄りの掲載都道府県を選択し、地図へ反映
  end
  Explorer-->>Visitor: 地図と店舗一覧を更新
```

VercelのPreview Deployment Protectionが公開APIのサーバー側fetchをSSOへリダイレクトした場合、公開ページは静的データを複製せず店舗0件で表示します。実データを表示するにはSSO回避用の設定とDATABASE_URLを構成します。WebGLを初期化できないブラウザでは、地図の代わりに店舗一覧を案内します。

## 管理者が店舗を追加・更新・削除する

```mermaid
sequenceDiagram
  actor Admin as 管理者
  participant AdminPage as /admin
  participant Login as POST /api/admin/login
  participant Auth as admin-auth
  participant AdminAPI as /api/admin/pubs
  participant Repository as pub-repository
  participant Neon as Neon Postgres

  Admin->>AdminPage: GET /admin（セッション Cookie）
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
