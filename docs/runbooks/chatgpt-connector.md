# Irish Pub Map Plugin / Remote MCP Server

ChatGPT / Codex → [Irish Pub Map Plugin](../../plugins/irishpub-map/plugin.json) → Remote MCP Server → Automation API → Admin Services という経路で管理データを参照します。MCP ServerはDBへ直接接続せず、[Automation API OpenAPI](../specs/openapi/openapi.yaml)を契約のSource of Truthとします。Custom GPT / GPT Actionsは正式なConnector基盤に使用しません。

## 配置と公開Tool

同じNext.js Applicationの `apps/web/app/api/mcp/route.ts` がstateless Streamable HTTP endpoint `/api/mcp` を提供します。公式MCP SDK v2と `mcp-handler` を利用し、現行Protocol `2026-07-28` の `server/discover`、`tools/list`、`tools/call` を処理します。旧Protocolの `initialize` も互換経路として受け付けます。OAuth Protected Resource Metadataは `/.well-known/oauth-protected-resource` で提供します。Vercelへの通常Deploymentで両Routeが公開されます。

#509のallow listは `list_prefectures` のみです。`GET /api/automation/v1/master/prefectures` を呼ぶRead-only Toolで、MCP annotationの `readOnlyHint: true` も設定しています。新しいAutomation API Endpointが増えてもToolは自動公開されません。Pub Delete、Tag Update / Delete、Status Update、Calendar Update、Media Upload / Delete、DB直接操作はTool一覧にありません。Content / Quiz / Pub / Tagの個別Toolは後続Issueで審査します。

[Plugin manifest](../../plugins/irishpub-map/plugin.json)と[MCP接続設定](../../plugins/irishpub-map/mcp.json)はProductionの公開Originを指します。Local / Previewで試す際は、対象環境の `/api/mcp` URLをChatGPT / Codexへ直接登録します。環境固有のPreview URLやSecretをRepository、Issue、PRへ記録しません。

## 認証とserver-side設定

認証は二段階です。ChatGPT / CodexからMCP ServerへはOAuth 2.1 access token、MCP ServerからAutomation APIへは既存のBearer Tokenを使います。未認証ClientはTool discoveryを含めHTTP `401`で拒否します。MCP利用者の `mcp:read` とAutomation APIの `master:read` は別のScopeです。

外部OAuth認可サーバーは、PKCE、CIMDまたはDCR、resource indicatorをサポートし、MCP ResourceをAudienceに持つ署名済みJWT access tokenを発行するよう設定します。ServerはIssuer、Audience、JWKS署名、期限、`sub`、`scope`を検証し、許可された管理者Subjectだけを通します。JWT署名はRS256またはES256です。OpenAIの[Plugin認証ガイド](https://developers.openai.com/plugins/build/auth)と[公式MCP認可仕様（2026-07-28）](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)に沿って認可サーバーを設定します。認可サーバー自体はこのRepositoryに実装しません。

| server-side環境変数           | 設定内容                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `MCP_PUBLIC_ORIGIN`           | MCP Serverの公開HTTPS Origin。LocalではlocalhostのHTTPも可。                       |
| `MCP_OAUTH_ISSUER`            | 認可サーバーmetadataとJWT `iss` に一致するIssuer。                                 |
| `MCP_OAUTH_AUDIENCE`          | JWT `aud` に一致するMCP Resource識別子。公開Origin + `/api/mcp` と完全一致が必須。 |
| `MCP_OAUTH_JWKS_URL`          | 認可サーバーのJWKS URI。                                                           |
| `MCP_OAUTH_ALLOWED_SUBJECT`   | 利用を許す管理者本人のJWT `sub`。値は文書やログに残さない。                        |
| `MCP_AUTOMATION_API_ORIGIN`   | 同じ環境のAutomation API HTTPS Origin。LocalではlocalhostのHTTPも可。              |
| `MCP_AUTOMATION_API_TOKEN`    | MCP Serverだけが保持するRaw Automation Token。                                     |
| `AUTOMATION_API_TOKEN_SHA256` | 既存Automation APIが検証する同じTokenのSHA-256。                                   |
| `AUTOMATION_API_SCOPES`       | 初期版は `master:read` のみ。                                                      |

Production / PreviewではVercelの対象Environmentにserver-side変数を設定して再Deploymentします。LocalではGit管理外の `apps/web/.env.local` を使います。Raw TokenをChatGPT / Codex、Plugin Instructions、Prompt、通常Chat、OpenAPI、Tool Result、Application Log、Audit Log、Test fixtureへ渡しません。Credentialの生成とServer hashの設定は[Automation API運用Runbook](automation-api-access.md#認証と環境設定)に従います。Preview Deployment Protectionが有効な場合、外部MCP ClientとServer内のAutomation API呼び出しの両方でProtectionの通過条件を確認してください。Server内の呼び出しは既存の `VERCEL_AUTOMATION_BYPASS_SECRET` を利用できます。

## 接続とread-only疎通

1. `nvm use`、`npm ci`、`npm run dev` でLocal Serverを起動します。対象環境のserver-side設定とOAuth認可サーバーの設定を済ませます。Productionでは通常Deployment後に同じ確認を行います。
2. MCP Inspectorで対象の `/api/mcp` にStreamable HTTP接続し、OAuth loginを完了します。現行Protocolの `server/discover` の成功、`tools/list` が `list_prefectures` のみを返すこと、read-only annotationを確認します。旧Clientでは `initialize` を確認します。
3. ChatGPTではDeveloper modeを有効にし、PluginsからMCP ServerのHTTPS URLを接続します。CodexではRemote MCP Serverとして同じURLを登録し、OAuth loginを完了します。Plugin packageを利用する場合はこのRepositoryの `plugins/irishpub-map` を登録します。詳しい画面手順はOpenAIの[接続ガイド](https://developers.openai.com/plugins/deploy/connect-chatgpt)を参照してください。
4. `list_prefectures` を呼び、Automation APIの `200` と都道府県一覧がTool Resultへ返ることを確認します。Productionではread-only操作だけを使います。実行結果を共有する際はSecret、アカウント識別子、環境固有URLを除きます。

OAuth認可サーバー、server-side Secret、接続権限が未設定の場合、実環境の疎通確認は完了していません。`npm test` のMCP Contract TestはMCP protocol、認証拒否、Toolのallow list、Automation API Clientを隔離環境で確認します。

## Error、Rotation、Logging

| 発生箇所 | 確認すること |
| --- | --- |
| MCP HTTP `401` | MCP利用者のOAuth未認証・期限切れ。Protected Resource Metadataの認可サーバーを確認する。 |
| MCP HTTP `403` | MCP `mcp:read` Scope不足。Toolは実行されない。 |
| Tool Result `401 unauthorized` | MCP ServerからAutomation APIへのCredential未設定・誤設定・失効。OAuthと区別する。 |
| Tool Result `403 forbidden` | Automation APIの `master:read` Scope不足。別Tool / Endpointへフォールバックしない。 |
| Tool Result `422 validation_error` / `publication_requirements_not_met` | `fieldErrors` / `missingFields` を確認する。Server Validationを緩和せず、値を捏造しない。 |
| Tool Result `409 content_conflict` / `quiz_conflict` / `tag_conflict` / `idempotency_conflict` | 競合を報告し、別Resourceを自動生成しない。 |

Automation API ClientはJSON Errorの既知フィールドだけを返し、Request IDを安全な形式で保持します。Create系Toolのため `Idempotency-Key` を送信できる共通Clientですが、Resource単位のRetry検証は後続Issueで行います。Fetch例外、Authorization Header、Raw Token、OAuth TokenをTool Resultやログへ出しません。MCP独自ログにはSecretを出さず、変更操作の監査は既存のAutomation API Audit Logを使います。

Token Rotation時は[Automation APIの手順](automation-api-access.md#token-rotation-と緊急失効)に従い、新しいRaw TokenをMCP Serverの `MCP_AUTOMATION_API_TOKEN`、対応するhashをAutomation APIの `AUTOMATION_API_TOKEN_SHA256` に更新してDeploymentします。その後、`list_prefectures` の成功と旧Tokenの `401` をread-onlyで確認します。OAuthの鍵と管理者Subjectの変更は認可サーバー側とJWKS / server-side設定を同期させます。
