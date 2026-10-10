# API 方針

## 現状

Next.js Route Handler で公開 API と管理 API を提供します。Automation APIでは共通認証・認可基盤を使い、Master参照、タグ作成、Pub・Editorial Content・Quiz管理を提供します。公開画面はサーバー側から API 経由で店舗データを取得します。`DATABASE_URL` が設定されている環境ではNeonを読み書きし、未設定時は空の店舗一覧を返します。

## UUID

Resource IDの新規生成は既存どおり `crypto.randomUUID()` によるUUID v4です。受入時は共有validatorに従い、RFC 9562 variantを持つUUID version 1〜8を許可します。英字の大文字・小文字はどちらも有効です。OpenAPIの共通 `Uuid` schemaは `format: uuid` に加えて同じversion・variant条件をpatternで表し、`format` 単独をRuntime検証の代わりにはしません。Choice ID、Content slug、Tag key、自治体コードなどのドメイン識別子はUUID化しません。

UUIDとして不正なPath IDは各Routeの既存エラー契約に従います（Calendar AdminとQuizは `400 invalid_request`）。UUIDを含むBody入力の形式不正は既存の `422 validation_error` を維持します。UUIDの文字列表記はAPI境界で小文字へ書き換えず、PostgreSQL `uuid` castを使うRepositoryでは大文字小文字を区別せず同一IDとして照合します。同じUUIDを複数指定できない配列とCalendar更新時のPath/Body ID照合も、大文字小文字を無視します。

## 公開 API

### `GET /api/pubs`

公開中の店舗一覧を `{ "pubs": Pub[] }` で返します。RepositoryのSQLが `pubs.is_published = TRUE` で絞り込み、公開状態の列 `isPublished` はレスポンスへ含めません。`DATABASE_URL` 未設定時は `200` と空の `pubs` 配列を返します。DB接続やデータ処理に失敗した場合、Route Handlerは例外を変換しないため、Next.jsの通常の `500` 応答になります。DBの個々の行が共有 `Pub` 型に適合しない場合はその行を省略して続行し、全行が不正なら `500` になります。

`locale` Queryは省略可能で、指定できる値は `ja` と `en` です。既定値は `ja` です。不正値は `{ "error": "Unsupported locale." }` と `400` を返します。翻訳テーブルに要求localeの行がなければ日本語へフォールバックします。店舗名・住所、都道府県、市区町村、営業状態、タグ、Pub Typeの表示文言にこの優先順位を適用します。`prefecture`、`query` など `locale` 以外のQueryはRoute Handlerで検証・解釈されず、無視されます。サーバー側の絞り込みは行わず、検索・絞り込みは取得後のクライアント側で行います。

レスポンスの各店舗は `packages/shared/src/pub.ts` の `Pub` を使い、Repositoryが `asPubs` で検証・正規化します。IDはUUID文字列、`status` は `open` / `temporarily_closed` / `closed` / `unknown`、`pubType` は `irish` / `british` / `other` / `unclassified` です。Gastropub等の特徴はタグで表します。必須項目、optional fieldの省略、URLのnullabilityと各値の詳細は[店舗データ仕様](data.md)を参照してください。

例（optionalな表示項目はデータにより省略されます）:

```json
{
  "pubs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Example Pub",
      "prefecture": "東京都",
      "address": "東京都...",
      "latitude": 35.681,
      "longitude": 139.767,
      "websiteUrl": null,
      "googleMapsUrl": null,
      "instagramUrl": null,
      "tags": ["guinness"],
      "tagDisplayNames": { "guinness": "Guinness" },
      "status": "open",
      "statusDisplayName": "営業中",
      "pubType": "irish",
      "pubTypeDisplayName": "アイリッシュパブ"
    }
  ]
}
```

Route Handlerは `Cache-Control` や再検証時間を明示していません。クライアントは固定のキャッシュ期間をAPI契約として仮定できません。

## 公開 API の現在の認証

現行の `GET /api/pubs` は `IRISHPUB_MAP_API_KEY` を使います。Production (`VERCEL_ENV=production`) では値が未設定または空白のみの場合、`{ "error": "API authentication is not configured." }` と `503` を返し、Vercel Production向けビルド検証でも設定漏れを検出します。キーが設定されている場合は `x-api-key` ヘッダーを照合し、欠落・不一致なら `{ "error": "Unauthorized" }` と `401` を返します。Production以外では未設定ならKey検証を行わず、設定されていれば照合します。認証判定が `locale` 検証より先です。

```bash
curl -H "x-api-key: $IRISHPUB_MAP_API_KEY" "http://localhost:3000/api/pubs?locale=ja"
```

API Keyの実値はレスポンスやログへ出力しません。Webトップページからの取得はサーバー側で行い、API Keyをブラウザへ渡しません。Mobileアプリへ固定Secretを埋め込む設計は安全に秘密を保持できないため、この現行方式をMobile用の認証手段として使用しません。#540 は公開APIを固定Client Secret不要のRead-only APIへ変更する別Issueで、完了するまでは将来仕様です。

Vercel Preview Deployment Protection を有効にしている場合は、`VERCEL_AUTOMATION_BYPASS_SECRET` に Protection Bypass for Automation secret を設定してください。設定されている場合、サーバー側 fetch は `x-vercel-protection-bypass` ヘッダーを送信します。未設定でSSOへリダイレクトされた場合、トップページは静的データを複製せず店舗0件で表示します。実データを表示するには、SSOを回避できる設定とDATABASE_URLの両方を適切に構成してください。

## Automation APIの認証・認可

Automation APIと、収録済みAdmin APIのPath・Method・Request / Response Schema・HTTP Status・Error Code・認証要件は[OpenAPI定義](openapi/openapi.yaml)を契約のSource of Truthとします。現在はAutomation API全体、Admin Calendar、Admin Master（都道府県、市区町村、タグ、営業ステータス、Pub Type）を収録しています。公開 `GET /api/pubs` とAdmin Pub CRUD、Tag CRUD、Status管理、Editorial Content、Quiz、Media、Login / Logoutは未収録であり、OpenAPIが全APIを網羅しているとは扱いません。現行Admin Routeと収録状況は[Admin API収録一覧](openapi/admin-api-coverage.md)、残るDomainの作業は同一覧に記載したIssueを参照してください。Public API契約と共通Clientの整備は #541 の対象です。

`/api/automation/v1/*` は外部Automation用です。Bearer Tokenを要求し、Serverに設定した `AUTOMATION_API_TOKEN_SHA256` と受信TokenのSHA-256をtiming-safeに照合します。Raw TokenはServer環境変数やRepositoryへ保存しません。設定、発行、Token Rotation、Scope運用とCreate / Publishフローは[Automation API Runbook](../runbooks/automation-api-access.md)を参照してください。

各操作はOpenAPIに記載された必要Scopeを個別に要求し、別Scopeから権限を継承しません。管理者Session Cookieを受け付けず、同一Origin検証も要求しません。逆に管理APIはAutomation Bearer Tokenを受け付けません。Bearer Tokenの欠落・不一致・設定不備は `401 unauthorized`、認証済みTokenのScope不足は `403 forbidden` です。Scope名とEndpointの対応はOpenAPIだけで管理します。

CreateのIdempotency-Keyは成功済みの同一Requestを重複作成から保護し、成功結果を完了から24時間再利用できます。Keyのhashは保存しますがRaw Keyは保存しません。Validation失敗や5xxは成功結果として保存しません。変更操作はRequest ID、Scope、Resourceと結果を監査記録へ保存し、Token、Cookie、Request / Response本文、環境変数は記録しません。運用上の再送・監査の詳細はAutomation API Runbookを参照してください。

## API契約の範囲

| API | 役割 | 契約の参照先 |
| --- | --- | --- |
| Public Pub API | Mobile / Web向けの公開店舗読取り | 本文書の[Public API](#公開-api)と[店舗データ仕様](data.md)。OpenAPI収録は #541 の対象 |
| Admin API | Web管理画面向けの認証済み管理操作 | 収録済みのCalendar / Masterは[OpenAPI定義](openapi/openapi.yaml)。その他の現行Route契約は本節と各ドメイン仕様を参照 |
| Automation API | 外部Connector向けのScope制御された管理操作 | [OpenAPI定義](openapi/openapi.yaml)と[Automation API Runbook](../runbooks/automation-api-access.md) |
| Admin Calendar API | Web管理画面向けCalendar操作 | [OpenAPI定義](openapi/openapi.yaml)、画面Behaviorは[Product仕様](product.md) |

OpenAPI収録済みAPIのSchemaやStatusをここへ複製しません。APIの全体方針と認証境界は本書、機械可読なContractはOpenAPI、運用手順はRunbook、ドメイン固有の業務条件は各Specに記載します。

## 管理 API

管理 API は有効な管理者セッション Cookie を必要とします。ログイン用の環境変数が未設定の場合、ログイン API は `503` を返します。`DATABASE_URL` が未設定の場合、管理画面での一覧取得はできますが、更新系 API は `503` を返します。

失敗レスポンスは表示文言ではなく、安定した `errorCode` を返します。管理画面のClientが現在のlocaleに応じて日本語または英語へ翻訳します。Validationでは必要に応じてフィールド別の理由コード、公開条件不足では `missingFields` も返します。

```json
{ "errorCode": "invalid_credentials" }
```

```json
{
  "errorCode": "validation_error",
  "fieldErrors": { "key": "invalid_format" }
}
```

共通コードは `unauthorized`、`forbidden`、`invalid_json`、`invalid_content_type`、`database_unavailable`、`internal_error` です。ログイン、店舗、タグ、マスタ固有のコードには `invalid_credentials`、`auth_not_configured`、`invalid_pub_data`、`pub_not_found`、`publication_requirements_not_met`、`content_conflict`、`content_not_found`、`quiz_conflict`、`quiz_not_found`、`tag_conflict`、`tag_not_found`、`tag_in_use`、`invalid_tag_id`、`invalid_prefecture_code` があります。フィールド理由は `required`、`too_long`、`invalid_format`、`invalid_type`、`leading_or_trailing_space`、`immutable` です。未知のコードやJSONでないレスポンスはClientで一般化し、APIは例外文、DB・SQL・接続情報を返しません。HTTPステータスは認証 `401`、権限 `403`、入力 `400` / `415` / `422`、対象なし `404`、競合 `409`、設定不足 `503`、内部エラー `500` を使います。

営業ステータス管理固有のコードは、不正なURLパラメーターの `invalid_status_code` と、更新対象が存在しない `status_not_found` です。

| メソッド | パス | 成功時 | 主な失敗時 |
| --- | --- | --- | --- |
| `POST` | `/api/admin/login` | `200` と `Set-Cookie` | Origin不正は `403`、資格情報不一致は `401`、管理者設定なしは `503` |
| `POST` | `/api/admin/logout` | `200` と期限切れの Cookie | Origin不正は `403` |
| `GET` | `/api/admin/pubs` | `200` と `{ pubs, total, page, pageSize, databaseConfigured }`。各店舗に `isPublished`、マスタ識別子、タグ、更新日時を含む | 未認証は `401`、Query不正は `400` |
| `GET` | `/api/admin/master/prefectures` | `200` と `{ prefectures }` | 未認証は `401`、取得失敗は `500` |
| `GET` | `/api/admin/master/municipalities?prefectureCode=:code` | `200` と `{ municipalities }` | 未認証は `401`、都道府県コード不正は `400`、取得失敗は `500` |
| `GET` | `/api/admin/master/tags` | `200` と `{ tags }` | 未認証は `401`、取得失敗は `500` |
| `GET` | `/api/admin/tags` | `200` と `{ tags, databaseConfigured }`。サポートlocaleの翻訳と使用店舗数を含む | 未認証は `401`、取得失敗は `500` |
| `POST` | `/api/admin/tags` | `201` と `{ tag }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、入力不正は `422`、重複は `409`、DB未設定は `503` |
| `PATCH` | `/api/admin/tags/:id` | `200` と `{ tag }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、ID不正は `400`、対象なしは `404`、重複は `409`、Content-Type不正は `415`、入力不正は `422`、DB未設定は `503` |
| `DELETE` | `/api/admin/tags/:id` | `200` と `{ ok: true }` | 未認証は `401`、Origin不正は `403`、ID不正は `400`、対象なしは `404`、使用中は `409`、DB未設定は `503` |
| `GET` | `/api/admin/master/statuses` | `200` と `{ statuses }` | 未認証は `401`、取得失敗は `500` |
| `GET` | `/api/admin/master/pub-types` | `200` と `{ pubTypes }` | 未認証は `401`、取得失敗は `500` |
| `GET` | `/api/admin/statuses` | `200` と `{ statuses, databaseConfigured }`。固定keyと日英表示名を含む | 未認証は `401`、取得失敗は `500` |
| `PATCH` | `/api/admin/statuses/:code` | `200` と `{ status }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、code不正は `400`、入力不正は `422`、対象なしは `404`、DB未設定は `503` |
| `POST` | `/api/admin/pubs` | `201` と非公開の `{ pub }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、入力不正は `422`、参照競合は `409`、DB未設定は `503` |
| `GET` | `/api/admin/pubs/:id` | `200` とNULL・日英翻訳・タグIDを含む `{ pub }` | 未認証は `401`、ID不正は `400`、対象なしは `404`、DB未設定は `503` |
| `PUT` | `/api/admin/pubs/:id` | `200` と公開状態を維持した `{ pub }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、入力不正・公開条件不足は `422`、参照競合は `409`、対象なしは `404`、DB未設定は `503` |
| `PATCH` | `/api/admin/pubs/:id/publication` | `200` と `{ publication: { id, isPublished, unchanged } }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、入力不正・公開条件不足は `422`、対象なしは `404`、DB未設定は `503` |
| `DELETE` | `/api/admin/pubs/:id` | `200` と `{ ok: true }` | 未認証は `401`、Origin不正は `403`、対象なしは `404`、DB 未設定は `503` |
| `GET` | `/api/admin/content` | `200` と `{ content, databaseConfigured }`。DraftとPublishedを含む | 未認証は `401`、取得失敗は `500` |
| `POST` | `/api/admin/content` | `201` とDraftの `{ content }` | 未認証は `401`、Origin不正は `403`、入力不正は `422`、重複は `409`、DB未設定は `503` |
| `GET` | `/api/admin/content/:id` | `200` と日英翻訳を含む `{ content }` | 未認証は `401`、ID不正は `400`、対象なしは `404`、DB未設定は `503` |
| `PUT` | `/api/admin/content/:id` | `200` と公開状態を維持した `{ content }` | 未認証は `401`、Origin不正は `403`、入力不正・公開条件不足は `422`、重複は `409`、対象なしは `404` |
| `PATCH` | `/api/admin/content/:id/publication` | `200` と `{ publication: { id, status, unchanged, publishedAt } }` | 未認証は `401`、Origin不正は `403`、入力不正・公開条件不足は `422`、対象なしは `404` |
| `GET` | `/api/admin/quiz` | `200` と `{ questions, databaseConfigured }`。DraftとPublishedを含む | 未認証は `401`、取得失敗は `500` |
| `POST` | `/api/admin/quiz` | `201` とServer生成UUIDを持つDraftの `{ question }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、入力不正は `422`、重複は `409`、DB未設定は `503` |
| `GET` | `/api/admin/quiz/:id` | `200` と日英翻訳・Choiceを含む `{ question }` | 未認証は `401`、ID不正は `400`、対象なしは `404`、DB未設定は `503` |
| `PUT` | `/api/admin/quiz/:id` | `200` と公開状態を維持した `{ question }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、入力不正・公開条件不足は `422`、重複は `409`、対象なしは `404`、DB未設定は `503` |
| `PATCH` | `/api/admin/quiz/:id/publication` | `200` と `{ publication: { id, isPublished, unchanged } }` | 未認証は `401`、Origin不正は `403`、Content-Type不正は `415`、入力不正・公開条件不足は `422`、対象なしは `404`、DB未設定は `503` |

Irish Calendarの公開表示は `/discover/calendar` のServer ComponentがPublic Calendar Data Loader経由でPublished Eventを取得します。管理Calendar APIの契約は[OpenAPI定義](openapi/openapi.yaml)、画面Behaviorは[Product仕様](product.md)を参照してください。

Editorial Contentの `POST` と `PUT` は、`kind`、`slug`、`category`、`translations: { ja, en }` を含む全体スナップショットを受け付けます。各翻訳は `title`、`summary`、`bodyMarkdown` を持ちます。Draftでは言語非依存項目を `null`、翻訳文言を空文字で保存できます。kindは `story` / `guide`、categoryは既知分類、localeは `ja` / `en`、slugは小文字英数字と単語間のハイフンだけを許可します。bodyMarkdownは先頭・末尾の空白を含む原文を保持します。MarkdownはRendererと同じCommonMark・GFM ParserでAST化し、link・image・definitionのURLにはHTTP(S)、ルート相対、ページ内アンカーだけを許可します。

公開状態変更本文は `{ "status": "draft" | "published" }` だけを受け付けます。レスポンスの `publishedAt` はDBで確定した公開日時を返し、Draftでは `null` です。公開時はkind、slug、category、日英すべてのtitle、summary、bodyMarkdownをサーバー側とtransaction内で検証します。Publishedの通常更新にも更新後の公開条件を適用します。本体と日英翻訳は単一transactionで作成・更新し、公開状態を変える操作とPublished更新の成功後に公開Contentの個別・一覧キャッシュタグを失効させます。

`POST` と `PUT` は、`prefectureCode`、`municipalityCode`、座標、URL、`status`、`pubType`、`translations: { ja, en }`、`tagIds` を含む管理用全体スナップショットを受け付けます。日本語店舗名だけが下書きの必須項目で、その他の未入力値はNULL、英語翻訳なしは `translations.en = null`、タグ全解除は `tagIds = []` とします。`id`、`isPublished`、`updatedAt` は入力に含めません。新規IDはサーバーで生成し、常に非公開で作成します。新規公開時は `pubType` に `irish`、`british`、`other` のいずれかが必要です。既存の公開店舗が `unclassified` の場合は公開状態を維持でき、更新時に分類できます。

管理店舗一覧は1ページ50件です。`name`、`prefecture`、`municipality`、`status`、`tag`、`published`、`page` をQuery Parameterとして受け付け、指定条件をANDで適用します。店舗名は日本語名の部分一致、都道府県は1〜47、市区町村は選択都道府県に所属する6桁コード、タグはUUID、公開状態は `true` / `false` だけを受け付けます。すべての値はパラメータ化クエリへ渡し、外部入力からSQL文字列を組み立てません。一覧APIは最終ページを超えた場合も絞り込み後の `total` を保持して `pubs` を空配列で返し、管理画面 `/admin/pubs` はその結果から最後の有効ページを求め、絞り込み条件を維持してリダイレクトします。

公開状態変更本文は `{ "isPublished": true | false }` だけを受け付けます。現在値と対象存在を確認し、同じ状態への要求は `unchanged: true` として更新しません。非公開化に公開条件は適用しません。公開時は日本語店舗名・住所、都道府県、市区町村と所属関係、緯度、経度、営業ステータス、`pubType`（`irish` / `british` / `other`）、および各日本語表示名をサーバー側で再検証します。既に公開中の店舗は `pubType = unclassified` の状態を維持できます。不足時は更新せず、`publication_requirements_not_met` と `missingFields` を `422` で返します。

タグ管理APIの入力、transaction、使用中削除拒否は[管理タグ仕様](tag-management.md)を参照してください。作成時は `key` と `translations.ja`、任意の `translations.<locale>` を受け付け、更新時は `translations` だけを受け付けます。

営業ステータス管理APIの固定key、日英表示名、transaction更新は[管理ステータス仕様](status-management.md)を参照してください。更新本文は必須の `nameJa` と任意の `nameEn` だけを利用し、余分な `key` は更新対象にしません。

Quiz管理APIの `POST` と `PUT` は、カテゴリ、特別日、関連Guide UUID、日英翻訳、0〜4件のChoice、正解、HTTPSの情報源URLを含む全体Snapshotを受け付けます。Question IDは `POST` でServerがUUIDを生成し、Request Bodyでは受け付けません。`GET`、`PUT`、公開状態変更のURLはUUIDのみ受け付け、旧kebab-case Question IDは `400 invalid_request` です。`PUT` はURLのIDを対象にし、Request BodyからIDを変更できません。Choice IDはQuestion内で一意なkebab-caseです。通常のテキストはTrimして保存し、IDの空白は正規化せず入力エラーにします。Choice Requestに `sortOrder` は含めず、配列順を利用します。関連ContentはGuideだけを選択でき、Publishedの更新は公開条件を満たさない場合に拒否します。画像付きQuizのSnapshotには `imageAssetId` と日英の `imageAlt` / `imageCaption` を含め、画像を維持する更新では値を引き継ぎます。公開時はカテゴリ、日英すべての問題文・解説・情報源ラベル、HTTPS情報源URL、4件のChoiceと各日英ラベル、正解、妥当な特別日を検証し、画像を含む場合は日英の代替テキストも必須です。`imageCaption` は任意です。`DELETE` とChoice単位のサブAPIは提供しません。

Media Asset APIは管理者専用です。`POST /api/admin/media` は同一Originの `multipart/form-data` で `file` 1件だけを受け付けます。JPEG、PNG、WebPの実データをSharpで検証し、4 MiB、縦横8192px、総画素数4000万を上限とします。GIF、AVIF、SVG、アニメーション画像、動画、形式・拡張子の偽装は拒否します。成功時は `201` と `media` DTOを返し、Blobへの保存に失敗すると `503 media_storage_unavailable` または一般化した内部エラーを返します。Blob保存後にDB登録が失敗した場合はBlobを削除して補償します。

`GET /api/admin/media?page=1` は作成日時降順・UUID降順の固定50件ページを返し、未知のQuery Parameterや不正なページ番号は `400` です。応答には `databaseConfigured` と `storageConfigured` を含み、Storage keyは公開しません。`storageConfigured` は `BLOB_READ_WRITE_TOKEN` または接続済みBlob Storeを示す `BLOB_STORE_ID` が設定されている場合に `true` です。Vercel OIDC tokenをアプリが直接参照できることは前提とせず、認証の成否はアップロード時のBlob操作で処理します。DB未設定時は空一覧と `databaseConfigured: false` を返します。`GET /api/admin/media/{uuid}` は詳細を返し、DB未設定は `503`、不正UUIDは `400`、未登録IDは `404` です。管理UIは `/admin/media` にあり、削除APIは提供しません。

公開用の `GET /media/{uuid}` は本文Markdownの安定した画像参照です。登録済みMedia Assetだけを許可済みVercel Blob URLへ `307` redirectし、画像バイナリはアプリ経由でproxyしません。redirectは `max-age=300` と `s-maxage=300` でブラウザと共有CDNに5分間Cacheします。不正UUID・未登録ID・許可外URLは `404`、DB未設定・取得障害は `503` です。Storage keyとDB接続情報は返しません。

参照マスタAPIはDB行を直接返さず、`packages/shared/src/admin-master.ts` のDTOへ変換します。都道府県は `{ code, name }`、市区町村は `{ code, prefectureCode, name }`、タグは `{ id, key, name }`、営業ステータスとPub Typeは `{ code, key, name }` です。表示名は日本語を既定とし、日本語へフォールバックします。画面操作で再取得する市区町村APIと管理店舗一覧APIは、言語Cookieを優先し、未指定時は `Accept-Language` の候補を `q` 値と記載順で評価して表示ロケールを決定します。`prefectureCode` は1〜47の10進整数だけを受け付け、DBクエリへパラメータとして渡します。

管理APIは共通認証ヘルパーで、管理者設定が揃い、有効な署名済みセッションを持つリクエストだけを許可します。変更系リクエストは共通の同一Origin検証も通し、`Origin` の欠落・不一致を `403` で拒否します。現行は単一管理者モデルのため、このセッションを管理権限として扱います。Repositoryの例外時はDB・SQL・接続情報を含まない一般化したエラーを返します。

店舗のDraft / Publishルール、管理DTO、保存の責務分離は[管理店舗の下書き・公開設計](admin-pub-lifecycle.md)を参照してください。

## 今後の拡張候補

- `GET /api/pubs/:id`: 店舗詳細を返す

## 注意点

- API を追加・変更する場合でも、`packages/shared` の型と検証を優先して使います。
- 秘密値はリポジトリにコミットしません。
- Google Maps など有料 API へ切り替える場合は、料金と利用制限を確認してから実装します。
