# ChatGPT Connector の設定

Issue #509 の接続レイヤーには ChatGPT の **GPT Actions** を使用します。GPT Actions は OpenAPI と API key の Bearer 認証を設定できます。ChatGPT → GPT Actions → `/api/automation/v1/*` → Automation API が管理操作の経路です。Neon へ直接接続しません。OpenAI の[設定手順](https://help.openai.com/en/articles/9442513-configuring-actions-in-gpts)も参照してください。

## 契約と公開操作

[リポジトリの OpenAPI](../specs/openapi/openapi.yaml) が API 契約の Source of Truth です。分割された `$ref` を解決し、許可済み Automation 操作だけを含む単一 JSON を生成します。出力は環境ごとの Server Origin を含むため、Repository へ保存せず、登録時に生成します。生成スクリプトは未審査の Automation 操作が増えた場合に失敗します。

```bash
nvm use
npm ci
npm run generate:chatgpt-actions -- --origin 'https://<your-domain>' --output /tmp/irishpub-chatgpt-actions.json
./node_modules/.bin/redocly lint /tmp/irishpub-chatgpt-actions.json
```

`--origin` には対象環境の HTTPS Origin だけを指定します。Path、Query、認証情報は含めません。既存の出力ファイルを上書きしないため、再生成時は新しいファイル名を指定してください。生成物には Admin Calendar、Media、Status 更新、Pub 削除、Tag 更新・削除の操作は含まれません。API の Request / Response / Error / `Idempotency-Key` は元の OpenAPI から継承し、Tool 名と説明のみ ChatGPT 用に補います。

## GPT Actions への登録

1. 対象環境で [Automation API 接続 Runbook](automation-api-access.md#認証と環境設定)に従い、サーバー側の `AUTOMATION_API_TOKEN_SHA256` と `AUTOMATION_API_SCOPES` を設定します。初期疎通では `master:read` だけを許可します。Scope はサーバー側で判定され、GPT Actions 側の説明や OpenAPI の `x-required-scope` は権限を付与しません。
2. ChatGPT の GPT editor の Actions から新しい Action を作成し、生成した JSON 全体を Schema に貼り付けます。検出された Server が対象の HTTPS Origin で、操作名が `list_prefectures` などになっていることを確認します。Admin Calendar が Action に表示される場合は登録を中止し、生成物を確認します。
3. Authentication は **API key → Bearer** を選び、Raw Token を GPT Actions の認証設定へ直接入力します。`Bearer ` の接頭辞は認証方式が付与するため、Credential 欄には Token 本体だけを設定します。下記の共通 Instructions を GPT に設定します。Token を GPT の Instructions、通常会話、OpenAPI、ファイル、Issue、PR、ログへ記載しません。
4. GPT の共有範囲と Action の許可ドメインを確認し、まず非公開の設定で Preview の `list_prefectures` を試します。Preview Deployment Protection を使用する環境では、Automation Bearer とは別の Protection 設定が必要です。詳しくは [Automation API 接続 Runbook](automation-api-access.md#認証と環境設定)を参照してください。

初期 Schema には後続 Issue で検証する Write Tool も定義されますが、`master:read` のみの Token では Write Request は `403 forbidden` です。Write Scope の付与前に #510〜#513 の操作フローと検証を完了してください。`POST /content`、`POST /quiz`、`POST /pubs`、`POST /tags` の `Idempotency-Key` は Schema に含まれます。同じ論理的 Retry では同じ Key を使い、別の操作では新しい Key を使います。

共通 Instructions の例です。対象 Resource の判断や入力作成に関する指示は、後続 Issue で追加します。

```text
Use only the listed Irish Pub Map Actions for management operations.
Before a write, read the relevant resource and master data. Never use a different
endpoint to work around a permission or validation error.
Treat errorCode from the API as authoritative. On 401, stop and report that the
credential needs attention without showing it. On 403, stop and report the missing
scope. On 422, show fieldErrors or missingFields if present; do not invent values.
On a conflict, report the existing conflict rather than creating another resource.
For a retry of the same create request, reuse its Idempotency-Key. Never log or
repeat Authorization headers, bearer tokens, or credential values in chat.
```

## Read-only 疎通確認

GPT Actions の Test または Preview から `list_prefectures` を呼びます。`GET /api/automation/v1/master/prefectures` の `200` と都道府県一覧を確認します。Production で試す場合も Read だけにします。Raw Token や Authorization Header を Chat、画面記録、Application Log に出さず、実行先と HTTP Status のみ記録します。

| HTTP / `errorCode` | 確認すること |
| --- | --- |
| `401 unauthorized` | Credential 未設定、誤設定、失効、または Server の hash 未設定。Token 値を応答やログに出さず、認証設定を確認する。 |
| `403 forbidden` | 必要 Scope がない。別操作で権限を迂回せず、サーバーの Scope 設定を確認する。 |
| `422 validation_error` | `fieldErrors` の対象フィールドと理由に従い入力を直す。Validation を緩和しない。 |
| `422 publication_requirements_not_met` | `missingFields` に従い、実データを確認して補う。値を推測して埋めない。 |
| `409 content_conflict` / `quiz_conflict` / `tag_conflict` / `idempotency_conflict` | 既存データまたは同一 Key の Request を確認する。別名の Resource を自動作成しない。 |

401 / 403 の負例は Token や Scope を分けた隔離環境で確認します。Write 操作の Error と Retry の統合確認は後続 Issue の範囲です。Connector は Automation API の Error を利用し、別 Endpoint への自動フォールバックや Scope 判定の再実装を行いません。

## Token Rotation と Security

[既存の Rotation 手順](automation-api-access.md#token-rotation-と緊急失効)に従って新 Token と hash を生成し、GPT Actions の Bearer Credential を新 Token に更新してから、同じ環境の Server hash を切り替えます。Deployment 後に `list_prefectures` の `200` と旧 Token の `401` を確認します。単一 Token 方式のため切替中の短時間の失敗に注意してください。Raw Token は Credential 以外へ保存しません。

Connector 独自のログは追加しません。変更操作の監査には Automation API の既存 Audit Log を使用します。サーバー側の Scope と Request Validation は常に有効です。ChatGPT へ Neon 接続情報を設定しません。
