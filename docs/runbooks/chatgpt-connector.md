# Irish Pub Map Plugin / Remote MCP Server

ChatGPT / Codex → [Irish Pub Map Plugin](../../plugins/irishpub-map/plugin.json) → Remote MCP Server → Automation API → Admin Services という経路で管理データを参照・変更します。MCP ServerはDBへ直接接続せず、[Automation API OpenAPI](../specs/openapi/openapi.yaml)を契約のSource of Truthとします。Custom GPT / GPT Actionsは正式なConnector基盤に使用しません。

## 配置と公開Tool

同じNext.js Applicationの `apps/web/app/api/mcp/route.ts` がstateless Streamable HTTP endpoint `/api/mcp` を提供します。公式MCP SDK v2と `mcp-handler` を利用し、現行Protocol `2026-07-28` の `server/discover`、`tools/list`、`tools/call` を処理します。旧Protocolの `initialize` も互換経路として受け付けます。OAuth Protected Resource Metadataは `/.well-known/oauth-protected-resource` で提供します。未認証時の `WWW-Authenticate` は公開Origin上のこのMetadata URLを案内し、Metadata内の `resource` は公開Origin + `/api/mcp` を示します。Vercelへの通常Deploymentで両Routeが公開されます。

allow listはRead 10件とContent / Quiz / Pub / Tag Write 10件の計20件です。Read ToolはGETのみを呼び、`readOnlyHint: true`、`destructiveHint: false`、`idempotentHint: true`、`openWorldHint: false` を設定しています。新しいAutomation API Endpointが増えてもToolは自動公開されません。

| Tool | Automation API GET | Required Automation API Scope | 入力・用途 |
| --- | --- | --- | --- |
| `list_prefectures` | `/master/prefectures` | `master:read` | 都道府県の確認 |
| `list_municipalities` | `/master/municipalities` | `master:read` | 必須 `prefectureCode` (1～47) で自治体を取得 |
| `list_tags` | `/master/tags` | `master:read` | タグID、翻訳、使用店舗数の確認 |
| `list_pub_statuses` | `/master/statuses` | `master:read` | ステータスのkeyとcodeの確認 |
| `list_content` / `get_content` | `/content` / `/content/:id` | `content:read` | 一覧からIDを特定し、詳細の現行値を確認 |
| `list_quizzes` / `get_quiz` | `/quiz` / `/quiz/:id` | `quiz:read` | 一覧からIDを特定し、詳細の現行値を確認 |
| `list_pubs` / `get_pub` | `/pubs` / `/pubs/:id` | `pubs:read` | 店舗検索からIDを特定し、詳細の現行値を確認 |

| Write Tool | Automation API Method / Path | Required Automation API Scope | 用途 |
| --- | --- | --- | --- |
| `create_content` | POST `/content` | `content:create` | Content Draftを作成 |
| `update_content` | PUT `/content/:id` | `content:update` | 編集可能なContent全体Snapshotを置換 |
| `set_content_publication` | PATCH `/content/:id/publication` | `content:publish` | `status` を `draft` / `published` に変更 |
| `create_quiz` | POST `/quiz` | `quiz:create` | Quiz Draftを作成 |
| `update_quiz` | PUT `/quiz/:id` | `quiz:update` | 編集可能なQuiz全体Snapshotを置換 |
| `set_quiz_publication` | PATCH `/quiz/:id/publication` | `quiz:publish` | `isPublished` を `false` / `true` に変更 |
| `create_pub` | POST `/pubs` | `pubs:create` | 非公開Pubを作成 |
| `update_pub` | PUT `/pubs/:id` | `pubs:update` | 編集可能なPub全体Snapshotを置換 |
| `set_pub_publication` | PATCH `/pubs/:id/publication` | `pubs:publish` | `isPublished` を `false` / `true` に変更 |
| `create_tag` | POST `/tags` | `tag:create` | 再利用可能なTagを作成 |

Createは `readOnlyHint: false` / `destructiveHint: false` / `idempotentHint: false`、UpdateとPublicationは `readOnlyHint: false` / `destructiveHint: true` です。全Write Toolは `openWorldHint: false` です。Createで同じ `idempotencyKey` とPayloadを使った安全な再試行は、成功結果の保持期間である24時間内に限られます。期限後の同じ引数での再実行は新しいResourceを作成し得るため、Createを恒久的に冪等とは扱いません。これらのannotationはClientへのHintであり、承認や認可の強制ではありません。

各Pathには `/api/automation/v1` が付きます。ContentとQuizの一覧にPaginationやFilterはありません。`list_pubs` のみ `name`（最大100文字）、`prefecture`（1～47）、`municipality`（6桁・対応する都道府県が必要）、`status`（`open` / `temporarily_closed` / `closed` / `unknown`）、`tag`（UUID）、`published`（boolean）、`page`（1～100000）を受け付けます。複数FilterはAND条件で、Page SizeはServer固定の50です。応答の `page`、`pageSize`、`total` を確認して次ページを取得します。独自の `limit`、`offset`、`query`、`search` はありません。

Master Dataは毎回Automation APIから取得し、MCP Serverには複製しません。成功時は応答Schemaを検証し、ID、公開状態、タグ、自治体コード、Paginationを `structuredContent` とtextに維持します。Write成功時は監査照合用の `X-Request-Id` を必須とし、`requestId` として両Resultへ添えます。欠落または不正な形式は `502 invalid_response` として扱います。Create応答はContentの `status: draft` / `publishedAt: null`、QuizとPubの `isPublished: false` も検証します。Pub Delete、Tag Update / Delete、Status Update、Calendar Update、Media Upload / Delete、DB直接操作Toolは公開しません。

[Plugin manifest](../../plugins/irishpub-map/plugin.json)と[MCP接続設定](../../plugins/irishpub-map/mcp.json)はProductionの公開Originを指します。Local / Previewで試す際は、対象環境の `/api/mcp` URLをChatGPT / Codexへ直接登録します。環境固有のPreview URLやSecretをRepository、Issue、PRへ記録しません。

## 認証とserver-side設定

認証は二段階です。ChatGPT / CodexからMCP ServerへはAuth0のOAuth 2.1 access token、MCP ServerからAutomation APIへは既存のBearer Tokenを使います。未認証ClientはTool discoveryを含めHTTP `401`で拒否します。MCP利用者のOAuth Scopeは引き続き `mcp:read` のみです。Automation APIのResource別Read / Write Scopeは別のserver-side Scopeです。

外部OAuth認可サーバーは、PKCE、CIMDまたはDCR、resource indicatorをサポートし、MCP ResourceをAudienceに持つ署名済みJWT access tokenを発行するよう設定します。ServerはIssuer、Audience、JWKS署名、期限、`sub`、`scope`を検証し、許可された管理者Subjectだけを通します。JWT署名はRS256またはES256です。OpenAIの[Plugin認証ガイド](https://developers.openai.com/plugins/build/auth)と[公式MCP認可仕様（2026-07-28）](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)に沿って認可サーバーを設定します。認可サーバー自体はこのRepositoryに実装しません。

| server-side環境変数 | 設定内容 |
| --- | --- |
| `MCP_PUBLIC_ORIGIN` | MCP Serverの公開HTTPS Origin。LocalではlocalhostのHTTPも可。 |
| `MCP_OAUTH_ISSUER` | 認可サーバーmetadataとJWT `iss` に一致するIssuer。 |
| `MCP_OAUTH_AUDIENCE` | JWT `aud` に一致するMCP Resource識別子。公開Origin + `/api/mcp` と完全一致が必須。 |
| `MCP_OAUTH_JWKS_URL` | 認可サーバーのJWKS URI。 |
| `MCP_OAUTH_ALLOWED_SUBJECT` | 利用を許す管理者本人のJWT `sub`。値は文書やログに残さない。 |
| `MCP_AUTOMATION_API_ORIGIN` | 同じ環境のAutomation API HTTPS Origin。LocalではlocalhostのHTTPも可。 |
| `MCP_AUTOMATION_API_TOKEN` | MCP Serverだけが保持するRaw Automation Token。 |
| `AUTOMATION_API_TOKEN_SHA256` | 既存Automation APIが検証する同じTokenのSHA-256。 |
| `AUTOMATION_API_SCOPES` | Readには `master:read,content:read,quiz:read,pubs:read`。Content / Quiz Writeには `content:create,content:update,content:publish,quiz:create,quiz:update,quiz:publish`、Pub / Tag Writeには `pubs:create,pubs:update,pubs:publish,tag:create` を対象環境で追加。既存Scopeの和集合を維持する。 |

Production / PreviewではVercelの対象Environmentにserver-side変数を設定して再Deploymentします。LocalではGit管理外の `apps/web/.env.local` を使います。Raw TokenをChatGPT / Codex、Plugin Instructions、Prompt、通常Chat、OpenAPI、Tool Result、Application Log、Audit Log、Test fixtureへ渡しません。Credentialの生成とServer hashの設定は[Automation API運用Runbook](automation-api-access.md#認証と環境設定)に従います。Preview Deployment Protectionが有効な場合、外部MCP ClientとServer内のAutomation API呼び出しの両方でProtectionの通過条件を確認してください。Server内の呼び出しは既存の `VERCEL_AUTOMATION_BYPASS_SECRET` を利用できます。

Write有効化の順序は、実装とContract / Security Test → 安全なPreview / Test環境でのScope追加と統合確認 → PR Merge → Production有効化時の必要なWrite Scope追加と再Deploymentです。既存Read Scopeを削らず、Write Tool実装前にProductionへWrite Scopeを先行付与しません。Auth0側へ `mcp:write` 等は追加しません。Productionの実データへのWriteをテスト目的だけで実行しません。

## Content / Quizの操作手順

MCP Serverの `instructions` と各Tool descriptionにも以下の順序を記載しています。会話上のユーザー確認はChatGPT / Codexが行い、MCP Toolは確認済みかどうかを推測しません。`confirmed` 等の独自Business Fieldも送りません。

1. Draft Create前に `list_content` または `list_quizzes` で既存・類似Resourceを確認します。ユーザーが新規Draft登録を明確に依頼していれば追加確認は不要です。CreateはDraftのみで自動Publishしません。Create後は返されたIDで `get_content` / `get_quiz` を呼び、保存値を照合します。
2. Update前に対象の `get_content` / `get_quiz` を呼びます。現行値から編集可能Fieldだけの全体Snapshotを作り、対象、変更前後の値、変更Fieldをユーザーに示して明示的な確認を得てからPUTします。GET Response全体をPUTしません。取得に失敗した場合はWriteを止めます。PUT後は再度Detailを取得して保存値を照合します。
3. Publication前にDetailを取得し、現在状態と変更後状態を示して明示的な確認を得ます。Contentは `{ "status": "published" }` / `{ "status": "draft" }`、Quizは `{ "isPublished": true }` / `{ "isPublished": false }` を送ります。変更後は再度Detailを取得して状態を照合します。

Content Write本文は `kind`、`slug`、`category`、`heroImageAssetId`、`translations` の5 Fieldです。各Localeは `title`、`summary`、`bodyMarkdown`、`heroImageAlt`、`heroImageCaption` を持ちます。`id`、`status`、`publishedAt`、`heroImage`、時刻は送りません。Publish時はkind / slug / categoryと日英のtitle / summary / bodyMarkdownが必要で、Hero Imageがある場合は日英Alt Textも必要です。

Quiz Write本文は `category`、`specialDate`、`correctChoiceId`、`sourceUrl`、`relatedContentId`、`imageAssetId`、`translations`、`choices` から構成します。Draftでは0～4択や未完成翻訳を許容します。`id`、`isPublished`、`image`、時刻、Choiceの `sortOrder` は送りません。Choice配列順からServerが `sortOrder` を決めます。Publish時はCategory、日英のQuestion / Explanation / Source Label、HTTPS Source URL、完成した4択とその一つを指す `correctChoiceId`、画像がある場合は日英Alt Textが必要です。要件の判定はAutomation APIを正とし、不足値を作りません。

Create Toolの `idempotencyKey` は業務データではなくConnector制御値です。新しい論理Createごとに1～128文字のKeyを生成し、MCP Serverが `Idempotency-Key` Headerへ移します。空文字・前後空白・制御文字は不可です。同じ処理の結果が不明な場合は、成功結果の24時間の保持期間内に同じPayloadとKeyで再試行します。24時間以上経過した場合は自動再試行せず、一覧と詳細で作成済みか確認します。`idempotency_in_progress` では時間をおいて同じKeyで再試行し、新しいKeyで重複作成しません。

## Pub / Tagの操作手順

Pub / Tagの重複とユーザー確認はChatGPT / Codexが判断します。MCP Serverは会話の承認状態を保持せず、Automation APIのScope、参照整合性、公開要件、監査を利用します。読み取りや確認に失敗したらWriteへ進みません。

1. Pub作成前に店舗名で `list_pubs` を呼び、候補の名前、住所、Web / Maps / Instagram URL、都道府県、市区町村、座標を比較します。FilterはAPI契約にある `name` 等のみを使い、必要なら次ページと `get_pub` を調べます。同一Pubが見つかったら作成せず、曖昧な候補がある場合はユーザーへ提示して判断を待ちます。新規Draft登録が明確に依頼され、重複がなければ追加確認なく進められます。
2. `list_prefectures`、`list_municipalities(prefectureCode)`、`list_pub_statuses`、`list_tags` で現行値を確認します。PubWriteの `status` はcodeやIDでなくkeyです。自治体codeと都道府県の対応、Tag IDを照合します。Master値やIDは推測しません。既存Tagで表現できるならそのIDを使います。
3. 必要な再利用可能なTagが既存一覧にないときのみ `create_tag` を呼びます。`key` は小文字英数字と中間のハイフンのみ、最大64文字で、`translations.ja` が必須、英語は任意です。表記や意味が重複するTag、一店舗だけの情報、主観的な評価は作成しません。判断が曖昧なら止めます。作成結果のIDを確認し、`list_tags` で再取得します。
4. `create_pub` にはPubWriteの `prefectureCode`、`municipalityCode`、`latitude`、`longitude`、3つのURL、`status`、`translations`、`tagIds` を送ります。Draftにはtrim後も空でない `translations.ja.name` が必要です。他の基本値と `translations.en` はnull、`tagIds` は空配列を許容します。英語翻訳を設定する場合は英語名と英語住所の両方を入力します。Createは常に `isPublished=false` で、自動Publishしません。返されたIDで `get_pub` を呼び、保存値を照合します。
5. 更新前は `get_pub` で現行値を読み、対象と変更するFieldの前後を示して明示的なユーザー確認を得ます。GET応答全体でなくPubWrite全体SnapshotをPUTし、`id`、`isPublished`、`updatedAt` を本文へ含めません。参照値を変える場合はMaster / Tagを再取得します。更新後は `get_pub` で保存値と公開状態を照合します。
6. 公開状態変更前は `get_pub` で現行状態を読み、変更後の `isPublished` を示して明示的な確認を得ます。`set_pub_publication` は `{ "isPublished": true }` / `{ "isPublished": false }` のみを送り、変更後は `get_pub` で照合します。公開には日本語名・住所、都道府県、市区町村、緯度、経度、statusが必要です。判定はAutomation APIを正とし、`422 publication_requirements_not_met` の `missingFields` を提示します。Website、Maps、Instagram、Tag、英語訳、読み仮名は現行の公開必須項目ではありません。

Pub / Tag Createの `idempotencyKey` は上記と同様、本文でなく `Idempotency-Key` Headerに移されます。`409 idempotency_conflict` は同じKeyの別Request、`409 idempotency_in_progress` は処理中を示します。後者では同じKeyと本文を維持し、新Keyへ自動変更しません。`409 tag_conflict` は既存Tagを再確認します。PubのMaster / Tag参照不整合は `409 validation_error`、通常の入力不正は `422 validation_error` の `fieldErrors` を確認します。Pubの意味的な重複を自動拒否するAPIはありません。Error後に別Resourceを自動作成しません。

各Write Resultの `requestId` はAutomation APIの `X-Request-Id` です。Auditは[Automation API運用Runbook](automation-api-access.md#audit-log)に従い、対象環境の監査記録の `request_id` と照合します。`resource_type` はPubなら `pub`、Tagなら `tag` です。SecretやRequest本文を監査記録へ残しません。

## 接続と疎通

1. `nvm use`、`npm ci`、`npm run dev` でLocal Serverを起動します。対象環境のserver-side設定とOAuth認可サーバーの設定を済ませます。Productionでは通常Deployment後に同じ確認を行います。
2. MCP Inspectorで対象の `/api/mcp` にStreamable HTTP接続し、OAuth loginを完了します。現行Protocolの `server/discover` の成功、`tools/list` が上記20件のみを返すこと、Read / Writeごとのannotationを確認します。旧Clientでは `initialize` を確認します。
3. ChatGPTではDeveloper modeを有効にし、PluginsからMCP ServerのHTTPS URLを接続します。CodexではRemote MCP Serverとして同じURLを登録し、OAuth loginを完了します。Plugin packageを利用する場合はこのRepositoryの `plugins/irishpub-map` を登録します。詳しい画面手順はOpenAIの[接続ガイド](https://developers.openai.com/plugins/deploy/connect-chatgpt)を参照してください。
4. Productionでは `list_prefectures`、`list_municipalities`、`list_tags`、`list_pub_statuses`、`list_content`、`list_quizzes`、`list_pubs` を呼び、各200と `structuredContent` を確認します。既存Resourceがあれば一覧のIDで `get_content`、`get_quiz`、`get_pub` を確認します。疎通用Resourceは作成せず、データ変更がないことを確認します。実行結果を共有する際はSecret、アカウント識別子、環境固有URLを除きます。
5. Write統合確認は安全な非Production環境で、Content / QuizのDraft Create、Update、Publish / Unpublishに加え、Pubの重複確認、既存Tag利用と必要な新規Tag作成、Pubの非公開Create、Update、Publish / Unpublish、各Read-backを実施します。Automation API Audit Logの `request_id` とTool Resultの `requestId` を照合します。Audit参照UI / APIはないため、権限を持つ運用者が対象環境のNeon SQL Editor等で `request_id` または `resource_type` / `resource_id` を条件に確認します。

OAuth認可サーバー、server-side Secret、接続権限が未設定の場合、実環境の疎通確認は完了していません。`npm test` のMCP Contract TestはMCP protocol、認証拒否、Toolのallow list、Automation API Clientを隔離環境で確認します。

## Error、Rotation、Logging

| 発生箇所 | 確認すること |
| --- | --- |
| MCP HTTP `401` | MCP利用者のOAuth未認証・期限切れ。Protected Resource Metadataの認可サーバーを確認する。 |
| MCP HTTP `403` | MCP `mcp:read` Scope不足。Toolは実行されない。 |
| Tool Result `401 unauthorized` | MCP ServerからAutomation APIへのCredential未設定・誤設定・失効。OAuthと区別する。 |
| Tool Result `400 invalid_prefecture_code` / `invalid_request` | 入力値、Pub Filterと都道府県・自治体の整合性を確認する。 |
| Tool Result `403 forbidden` | Automation APIの対象Resource別Read / Write Scope不足。別Tool / Endpointへフォールバックしない。 |
| Tool Result `404 *_not_found` | 詳細対象が存在しない。類似Resourceを自動選択しない。 |
| Tool Result `409 content_conflict` / `quiz_conflict` | Slugや既存Resourceとの衝突を確認する。別Resourceや値に自動変更しない。 |
| Tool Result `409 tag_conflict` / `validation_error` | Tagの重複、またはPubのMaster / Tag参照値を確認する。IDを推測しない。 |
| Tool Result `409 idempotency_conflict` / `idempotency_in_progress` | KeyとPayloadを確認する。結果不明時や処理中は新Keyに切り替えない。 |
| Tool Result `415 invalid_content_type` | MCP Client側のRequest生成を確認する。 |
| Tool Result `422 validation_error` | `fieldErrors` を確認し、不足情報を推測せず修正する。 |
| Tool Result `422 publication_requirements_not_met` | `missingFields` を確認し、必要な内容をUpdateした後、改めて確認を得る。 |
| Tool Result `503 database_unavailable` | DB利用不可。Quiz一覧はDB未設定時にも503となり、空配列へ変換しない。 |
| Tool Result `502 invalid_response` | Automation APIの成功応答がOpenAPI契約と一致しない。値を補完しない。 |
| Tool Result `500 internal_error` | Automation API側の障害。別Endpointへフォールバックしない。 |

Automation API ClientはJSON Errorの既知フィールドだけを返し、Request IDを安全な形式で保持します。Fetch例外、Authorization Header、Raw Token、OAuth TokenをTool Resultやログへ出しません。MCP独自ログにはSecretを出さず、変更操作の監査は既存のAutomation API Audit Logを使います。AuditにはResource、Action、Result、Scope、Method、HTTP Status、Request ID等が記録され、SecretやRequest / Response本文は記録しません。Readと認証失敗、同一Create成功結果のRetryは監査行を追加しません。詳細は[Automation API運用Runbook](automation-api-access.md#audit-log)を参照してください。

Token Rotation時は[Automation APIの手順](automation-api-access.md#token-rotation-と緊急失効)に従い、新しいRaw TokenをMCP Serverの `MCP_AUTOMATION_API_TOKEN`、対応するhashをAutomation APIの `AUTOMATION_API_TOKEN_SHA256` に更新してDeploymentします。その後、`list_prefectures` の成功と旧Tokenの `401` をread-onlyで確認します。OAuthの鍵と管理者Subjectの変更は認可サーバー側とJWKS / server-side設定を同期させます。
