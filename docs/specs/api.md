# API 方針

## 現状

Next.js Route Handler で公開 API と管理 API を提供します。Automation APIでは共通認証・認可基盤を使い、Master参照、タグ作成、Pub・Editorial Content・Quiz管理を提供します。公開画面はサーバー側から API 経由で店舗データを取得します。`DATABASE_URL` が設定されている環境ではNeonを読み書きし、未設定時は空の店舗一覧を返します。

## UUID

Resource IDの新規生成は既存どおり `crypto.randomUUID()` によるUUID v4です。受入時は共有validatorに従い、RFC 9562 variantを持つUUID version 1〜8を許可します。英字の大文字・小文字はどちらも有効です。OpenAPIの共通 `Uuid` schemaは `format: uuid` に加えて同じversion・variant条件をpatternで表し、`format` 単独をRuntime検証の代わりにはしません。Choice ID、Content slug、Tag key、自治体コードなどのドメイン識別子はUUID化しません。

UUIDとして不正なPath IDは各Routeの既存エラー契約に従います（Calendar AdminとQuizは `400 invalid_request`）。UUIDを含むBody入力の形式不正は既存の `422 validation_error` を維持します。UUIDの文字列表記はAPI境界で小文字へ書き換えず、PostgreSQL `uuid` castを使うRepositoryでは大文字小文字を区別せず同一IDとして照合します。同じUUIDを複数指定できない配列とCalendar更新時のPath/Body ID照合も、大文字小文字を無視します。

## 公開 API

### `GET /api/pubs`

公開中の店舗一覧を `{ "pubs": Pub[] }` で返します。RepositoryのSQLが `pubs.is_published = TRUE` で絞り込み、公開状態の列 `isPublished` はレスポンスへ含めません。`DATABASE_URL` 未設定時は `200` と空の `pubs` 配列を返します。DB接続やデータ処理に失敗した場合、Route Handlerは例外を変換しないため、Next.jsの通常の `500` 応答になります。DBの個々の行が共有 `Pub` 型に適合しない場合はその行を省略して続行し、全行が不正なら `500` になります。

`locale` Queryは省略可能で、指定できる値は `ja` と `en` です。既定値は `ja` です。Cache keyの増加を防ぐため、Query省略時は `ja` を返しますが `Cache-Control: no-store` を設定します。共有Cacheを使うClientは正規表記 `?locale=ja` または `?locale=en` を指定してください。アプリに元の表記が届く場合、Cache lookup前に実行するProxyとRoute Handlerは、未対応Queryと重複localeを `{ "error": "Unsupported query parameter." }` と `400` で拒否します。不正なlocale値は `{ "error": "Unsupported locale." }` と `400` を返します。Vercel Previewではlocaleのpercent-encodingや末尾`&`が正規localeと同じCache entryへ合流し、空separatorだけのQueryはlocale省略へ正規化されることを確認しました。後者は既定locale応答をCacheしないため、別Cache entryを作りません。翻訳テーブルに要求localeの行がなければ日本語へフォールバックします。店舗名・住所、都道府県、市区町村、営業状態、タグ、Pub Typeの表示文言にこの優先順位を適用します。サーバー側の絞り込みは行わず、検索・絞り込みは取得後のクライアント側で行います。

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

正規表記の `?locale=ja|en` を指定した応答は `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=60` を返します。ブラウザーでは毎回再検証し、共有CDNでは60秒Cacheします。期限後の再検証中に返す古い応答は最大60秒の期間に制限します。locale省略時は既定値 `ja` で応答し、`Cache-Control: no-store` で共有CDN Cacheを使いません。応答は利用者固有情報を含みません。

## 公開 API の認証・濫用対策

`GET /api/pubs` は全環境で匿名の読み取り専用APIです。固定Client Secretを要求せず、書き込みMethodは提供しません。`locale` を検証し、Repositoryが公開済み店舗だけを取得して共有 `Pub` DTOへ変換します。DB Credential、管理情報、Server SecretはResponseへ含めません。

```bash
curl "http://localhost:3000/api/pubs?locale=ja"
```

APIは公開データのみを返します。短時間の共有CDN Cache、公開Fieldの限定、入力Validationを濫用対策として使います。分散Rate Limit基盤を利用していないため、プロセス内Memoryだけで分散環境のRate Limitを実装したとは扱いません。Native Mobileからの利用に固定Secretは不要です。ブラウザー向けCORS許可は追加していません。

Vercel Preview Deployment Protection を有効にしている場合は、`VERCEL_AUTOMATION_BYPASS_SECRET` に Protection Bypass for Automation secret を設定してください。設定されている場合、サーバー側 fetch は `x-vercel-protection-bypass` ヘッダーを送信します。未設定でSSOへリダイレクトされた場合、トップページは静的データを複製せず店舗0件で表示します。実データを表示するには、SSOを回避できる設定とDATABASE_URLの両方を適切に構成してください。

## Automation APIの認証・認可

Automation API、Admin API、および公開 `GET /api/pubs` のPath・Method・Request / Response Schema・HTTP Status・Error Code・認証要件は[OpenAPI定義](openapi/openapi.yaml)を契約のSource of Truthとします。現行の管理用Routeは、Login / Logoutを含めてすべて収録済みです。公開 `GET /media/{uuid}` はこのOpenAPIに未収録です。公開Pub APIは `@irishpub-map/api-client` の `getPubs({ baseUrl, locale, signal?, fetch? })` からPlatform非依存で利用でき、標準Fetchを既定として共有 `asPubs` でレスポンスを検証します。OpenAPIで定義されていないResponse Envelope / PubのFieldもClient境界で拒否し、許可済みの `Pub` Fieldだけを返します。

`/api/automation/v1/*` は外部Automation用です。Bearer Tokenを要求し、Serverに設定した `AUTOMATION_API_TOKEN_SHA256` と受信TokenのSHA-256をtiming-safeに照合します。Raw TokenはServer環境変数やRepositoryへ保存しません。設定、発行、Token Rotation、Scope運用とCreate / Publishフローは[Automation API Runbook](../runbooks/automation-api-access.md)を参照してください。

各操作はOpenAPIに記載された必要Scopeを個別に要求し、別Scopeから権限を継承しません。管理者Session Cookieを受け付けず、同一Origin検証も要求しません。逆に管理APIはAutomation Bearer Tokenを受け付けません。Bearer Tokenの欠落・不一致・設定不備は `401 unauthorized`、認証済みTokenのScope不足は `403 forbidden` です。Scope名とEndpointの対応はOpenAPIだけで管理します。

CreateのIdempotency-Keyは成功済みの同一Requestを重複作成から保護し、成功結果を完了から24時間再利用できます。Keyのhashは保存しますがRaw Keyは保存しません。Validation失敗や5xxは成功結果として保存しません。変更操作はRequest ID、Scope、Resourceと結果を監査記録へ保存し、Token、Cookie、Request / Response本文、環境変数は記録しません。運用上の再送・監査の詳細はAutomation API Runbookを参照してください。

## API契約の範囲

| API | 役割 | 契約の参照先 |
| --- | --- | --- |
| Public Pub API | Mobile / Web向けの公開店舗読取り | [OpenAPI定義](openapi/openapi.yaml)、本文書の[Public API](#公開-api)、[店舗データ仕様](data.md)、workspace package `@irishpub-map/api-client` |
| Admin API | Web管理画面向けの管理操作とLogin / Logout | [OpenAPI定義](openapi/openapi.yaml)。業務ルールは各ドメイン仕様を参照 |
| Automation API | 外部Connector向けのScope制御された管理操作 | [OpenAPI定義](openapi/openapi.yaml)と[Automation API Runbook](../runbooks/automation-api-access.md) |
| Admin Calendar API | Web管理画面向けCalendar操作 | [OpenAPI定義](openapi/openapi.yaml)、画面Behaviorは[Product仕様](product.md) |

OpenAPI収録済みAPIのSchemaやStatusをここへ複製しません。ログイン・ログアウトを含む機械可読なContractはOpenAPI、APIの全体方針と認証境界は本書、運用手順はRunbook、ドメイン固有の業務条件は各Specに記載します。

## 管理 API

### 認証・セキュリティとエラーの方針

管理操作には、署名と有効期限をサーバー側で検証する管理者セッションCookieが必要です。例外としてLogin / Logoutは未認証でも呼び出せます。管理者セッションはAutomation APIのBearer Tokenと別の認証境界で扱い、相互に代用しません。

Login / Logoutを含め、状態を変更する管理APIはリクエスト先と完全一致する `Origin` を要求します。管理者認証にはServer側の設定が必要で、Credential・Session Secret・Cookieの実値をAPIレスポンス、仕様例、ログへ含めません。Cookieの発行・失効・属性や各Endpointの認証要件は[OpenAPI定義](openapi/openapi.yaml)を参照してください。

管理APIの失敗レスポンスは、表示文言ではなく機械可読な `errorCode` を返し、必要に応じて `fieldErrors` や `missingFields` を含めます。管理画面のClientが選択Localeに応じて表示文言へ変換し、不明なコードやJSONではないレスポンスは一般化します。認証・入力・対象不在・設定不足などのStatus、Error Code、各DomainのRequest / Response SchemaはOpenAPIに集約し、ここには複製しません。DB・SQL・接続情報はAPIエラーへ含めません。

`DATABASE_URL` 未設定時の一覧・詳細・変更操作の挙動はDomainごとに異なるため、各EndpointのOpenAPI契約と現行Route Handlerを確認してください。管理画面の機能や操作手順は[プロダクト仕様](product.md)を参照してください。

### API契約とドメイン仕様への入口

- **APIのPath / Method / Query / Body / Response / Error / Cookie:** [OpenAPI定義](openapi/openapi.yaml)
- **店舗のDraft / Publish・入力検証:** [管理店舗の下書き・公開設計](admin-pub-lifecycle.md)、[店舗データ仕様](data.md)
- **タグ・営業ステータス:** [タグ仕様](tags.md)、[管理ステータス仕様](status-management.md)
- **Editorial Content / Calendar:** [プロダクト仕様](product.md)、Editorial Content Cacheの責務は[システム構成](../architecture/system-overview.md)を参照
- **Quiz:** [Today's Ireland Quizデータ仕様](quiz.md)
- **Media管理・保存時の整合性・外部送信:** [プロダクト仕様](product.md)、[システム構成](../architecture/system-overview.md)、[外部送信・プライバシー実態整理](../operations/privacy-and-external-transmission.md)
- **Automation APIの認証・監査・再送:** [Automation API Runbook](../runbooks/automation-api-access.md)

## 公開Media参照

公開本文の画像参照には `GET /media/{uuid}` を使用します。登録済みMedia Assetだけを許可済みVercel Blob URLへ `307` redirectし、画像バイナリはアプリ経由でProxyしません。Redirectは `max-age=300` と `s-maxage=300` でブラウザと共有CDNに5分間Cacheします。不正UUID・未登録ID・許可外URLは `404`、DB未設定・取得障害は `503` です。Storage KeyとDB接続情報は返しません。この公開RouteはAdmin APIのOpenAPI収録対象外です。

## 今後の拡張候補

- `GET /api/pubs/:id`: 店舗詳細を返す

## 注意点

- API を追加・変更する場合でも、`packages/shared` の型と検証を優先して使います。
- 秘密値はリポジトリにコミットしません。
- Google Maps など有料 API へ切り替える場合は、料金と利用制限を確認してから実装します。
