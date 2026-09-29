# Automation API の接続と運用

外部 Agent / Connector は [OpenAPI 3.1 定義](../specs/openapi/openapi.yaml) の `/api/automation/v1` を利用します。API の現行動作とエラーは [API 仕様](../specs/api.md#automation-apiの認証認可) および Route Handler を参照してください。この Runbook は権限設定、Secret、操作手順を扱います。

## 認証と環境設定

`Authorization: Bearer <token>` を送ります。管理画面の Session Cookie と Automation Bearer Token は別の認証経路です。Cookie で Automation API は利用できず、Bearer Token で管理 API は利用できません。Automation API へのアクセスにはアプリの HTTP API を使い、DB へ直接接続しません。

1. ローカルの対話端末で `node scripts/generate-automation-token.mjs` を実行する。Script は 32 byte の乱数から Raw Token と、その SHA-256 hash を一度だけ端末に表示する。標準出力の転送、画面共有、端末の自動記録を避ける。
2. Raw Token を Connector / Agent の Secret Store に登録する。Server に設定するのは hash のみ。Raw Token と hash を Repository、Issue、PR、ログへ記録しない。`NEXT_PUBLIC_*` に設定しない。
3. Vercel Project Settings → Environment Variables で `AUTOMATION_API_TOKEN_SHA256` に hash、`AUTOMATION_API_SCOPES` に許可 Scope のカンマ区切り一覧を設定する。対象 Environment を Production / Preview から選び、それぞれ別の Token と Scope を使う。設定変更後は対象環境へ再 Deployment する。
4. Local Development では Repository にコミットされない `apps/web/.env.local` に hash と Scope を設定する。Raw Token はこのファイルに置かず、ローカルの安全な Secret Store で管理する。`DATABASE_URL` がない場合、Create / Update / Publish は利用できない。

Preview Deployment Protection が有効な環境では、外部 Client が Protection を通過する設定も必要です。Protection 用 Secret と Automation Bearer Token は別に管理します。環境固有 URL や Secret は文書・Issue・PRへ残しません。

### Scope の選び方

`AUTOMATION_API_SCOPES` は以下から必要なものだけ指定します。未知の値は認可されず、Scope 間の権限継承もありません。OpenAPI の `x-required-scope` は Server 側 allow list の必要値であり、OAuth Scope ではありません。

| 操作 | 必要 Scope |
| --- | --- |
| 都道府県・市区町村・タグ・営業ステータス参照 | `master:read` |
| タグ新規作成 | `tag:create` |
| Content 一覧・詳細 / 作成 / 全体更新 / 公開状態変更 | `content:read` / `content:create` / `content:update` / `content:publish` |
| Quiz 一覧・詳細 / 作成 / 全体更新 / 公開状態変更 | `quiz:read` / `quiz:create` / `quiz:update` / `quiz:publish` |
| Pub 検索・詳細 / 作成 / 全体更新 / 公開状態変更 | `pubs:read` / `pubs:create` / `pubs:update` / `pubs:publish` |

参照だけの Connector には `master:read,content:read,quiz:read,pubs:read` など、必要な参照 Scope だけを付けます。作成・公開が必要な Connector にも、対象 Resource の Scope だけを付けます。`tag:create` はタグ作成を判断する運用だけに付けます。

## Token Rotation と緊急失効

単一 Token 方式です。Server に複数の hash を同時設定できないため、切替時には短時間の停止や再試行が必要になる可能性があります。

1. 対話端末で新しい Token / hash を生成し、保管先と対象環境を確認する。
2. 外部 Connector / Agent の Credential を新 Raw Token に更新する。必要に応じて操作を一時停止する。
3. 同じ環境の `AUTOMATION_API_TOKEN_SHA256` を新 hash へ更新し、Deployment を完了させる。
4. 新 Token で [read-only 疎通確認](#read-only-疎通確認) を実施する。
5. 旧 Token が `401 unauthorized` になることを確認し、旧 Credential を Secret Store から削除する。

漏洩時は対象環境の hash を直ちに削除するか、新しい hash に置き換えて再 Deployment します。その後、旧 Token が `401 unauthorized` になることを確認し、監査記録を確認します。hash を削除すると Automation API の認証はすべて拒否されます。

## Read-only 疎通確認

Token をコマンド行へ直接書かないでください。次の例では端末から非表示で読み取り、`curl` の標準入力へ Header を渡します。Shell history、プロセス引数、ファイルへ Token を置きません。`BASE_URL` は確認対象環境の Origin を手元で設定します。実 URL を文書や PR へ貼りません。

```bash
read -r -s -p 'Automation token: ' AUTOMATION_TOKEN
printf '\n'
BASE_URL='https://<your-domain>'
printf 'header = "Authorization: Bearer %s"\n' "$AUTOMATION_TOKEN" |
  curl --config - --silent --show-error --include --url "$BASE_URL/api/automation/v1/master/tags"
unset AUTOMATION_TOKEN
```

同じ手順で `/master/prefectures`、`/master/municipalities?prefectureCode=13`、`/master/statuses`、`/content`、`/quiz`、`/pubs?page=1` を読み取ります。付与した Scope の成功を確認します。Token を省略または誤った値にした場合は `401 unauthorized` と `WWW-Authenticate: Bearer`、必要 Scope がない有効な Token では `403 forbidden` です。Scope 不足の確認は Preview などで権限を絞った Token 設定を使います。Production では read-only の確認に留め、データを変更しません。Quiz 一覧は DB 未設定時 `503 database_unavailable`、その他の Master / Content / Pub 一覧は空配列を返します。

## Create、確認、公開

Content / Quiz / Pub は Create が常に Draft / unpublished です。Create と Publish は一度の Request で実行できません。

```text
既存データと Master を読む → 重複を調べる → POST で Draft 作成
→ GET detail で保存内容を確認 → 必要なら PUT で全体更新
→ 公開条件を確認 → PATCH /{id}/publication で公開
```

`POST /content`、`POST /quiz`、`POST /pubs`、`POST /tags` は `Idempotency-Key` が必須です。空、前後空白、制御文字は不可で最大 128 文字です。新しい論理操作には新しい Key を使います。同じ Key + 同じ method / path / JSON 本文で再試行すると、同じ `201` と作成結果が返り、重複作成しません。JSON object のフィールド順は影響しません。同じ Key で異なる Request は `409 idempotency_conflict`、処理中は `409 idempotency_in_progress` です。後者は時間をおいて同じ Request を再送します。成功結果は完了後 24 時間保持されます。Validation 失敗と 5xx は成功結果として保存されません。

PUT は全体 Snapshot です。GET の応答から Server 管理フィールドを除き、書き込み可能な項目だけを送ります。Content は `kind`、`slug`、`category`、`heroImageAssetId`、`translations`、Quiz は `category`、`specialDate`、`correctChoiceId`、`sourceUrl`、`relatedContentId`、`imageAssetId`、`translations`、`choices`、Pub は `prefectureCode`、`municipalityCode`、座標、URL、`status`、`translations`、`tagIds` を使います。Quiz Choice の `sortOrder` は Server が配列順から決めます。公開済み Resource の PUT でも公開条件を維持します。

Content の公開本文は `{ "status": "published" }`、Draft に戻す本文は `{ "status": "draft" }` です。Quiz と Pub は `{ "isPublished": true }` / `{ "isPublished": false }` を使います。公開条件不足は `422 publication_requirements_not_met` と `missingFields` に従って修正します。Pub の削除、Tag の更新・削除を行う Automation Endpoint はありません。

### Tag 作成ルール

新しい Tag の前に必ず `GET /api/automation/v1/master/tags` を実行し、`key` と日英翻訳を比較します。既存 Tag で表現できるなら、その ID を使います。表記違い・同義語による重複を避けます。複数店舗の検索に継続して役立つ属性（例: `live-music`、`craft-beer`、`sports`、`food`、`outdoor-seating`）は作成を検討できます。主観的な評価（`nice-atmosphere`、`good-guinness`、`friendly-owner`）、単一店舗のイベント、一時的なキャンペーンは原則作成しません。Server は意味上の重複を自動検出しません。

### 統合シナリオ

DB がある隔離環境で、次の順に実施します。作成操作は対象データと Scope を確認してから行い、各 POST の Retry と重複防止、401 / 403、公開条件不足、監査を確認します。実装の自動テストは `tests/web/automation-*.test.ts` を参照してください。

1. **Content**: `GET /content` → `POST /content` → Draft を `GET /content/{id}` → `PUT` → `PATCH /publication` → Published を再取得。日英翻訳、kind、category、slug、Markdown、公開条件を確認する。
2. **Quiz**: `GET /quiz` → `POST /quiz` → Draft を `GET /quiz/{id}` → `PUT` → `PATCH /publication` → Published を再取得。4 Choice、`correctChoiceId`、日英翻訳、HTTPS `sourceUrl`、必要時の `specialDate` / `relatedContentId` を確認する。
3. **Pub + 既存 Tag**: `GET /pubs` で重複を確認 → Master と Tag を取得 → 既存 Tag ID を選ぶ → `POST /pubs` → Draft 詳細を確認 → `PATCH /publication`。都道府県・市区町村・営業ステータスは Master の値を使う。
4. **Pub + 新規 Tag**: 同様に重複と Master / Tag を確認 → 適切な Tag がない場合だけ `POST /tags` → 返された Tag ID を使って `POST /pubs` → 詳細確認 → `PATCH /publication`。Tag と Pub の DELETE が提供されないことも API 定義で確認する。

## Audit Log

認証済みの Create / Update / Publish / Unpublish の結果は `automation_audit_logs` に保存されます。`request_id` は変更応答の `X-Request-Id` と照合できます。`resource_type` は `content` / `quiz` / `pub` / `tag`、`resource_id` は対象 ID、`action` は `create` / `update` / `publish` / `unpublish`、`result` は `success` / `failure` です。Scope、method、ID を伏せた path、HTTP status、作成時刻も記録されます。Read と認証失敗、同じ Create 成功結果の Retry は監査行を追加しません。成立した変更後に監査書き込みだけが失敗した場合、変更は rollback されず、Request ID が Server Log に残ります。

Audit Log の参照 UI / API はありません。権限を持つ運用者が対象環境の Neon SQL Editor などで、`request_id` または `resource_type` / `resource_id` を条件に読み取ります。Bearer Token、Authorization Header、Token hash、Cookie、Request / Response 本文、環境変数は監査記録に保存されません。Authorization Header をアプリや外部 Client のログへ出力しないでください。

## 契約の検証

OpenAPI 3.1 定義は既存の CI で `npm run lint:openapi` により構文と参照を検証します。API の Route Handler、共有 Validation、Response DTO を変更した場合は、同じ PR で OpenAPI とこの Runbook を見直します。`npm test` の Automation 関連テストは Scope、入力とエラー、冪等性と監査の回帰を確認します。
