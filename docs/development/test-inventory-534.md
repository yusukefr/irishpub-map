# 現行テストの棚卸し（Issue #534）

この文書は、Issue #534 のレビュー用に、調査対象の `origin/main` HEAD `e6a3fef`（2026-10-10）時点で存在するテストの責務と候補をまとめたスナップショットです。Livingなテスト方針は[テスト戦略](testing.md)、現行Behaviorは実装とテストをSource of Truthとします。この文書は個々のassertionの台帳ではなく、テストファイルごとの主なLayer・機能領域を一覧化し、追加調査が必要な箇所を特定するための監査結果です。

## 対象と分類方法

対象は `tests/**/*.test.{ts,tsx}`、`e2e/*.spec.ts`、`e2e/*.storybook.spec.ts` と、それらのPlaywright snapshotです。`tests/mocks/` と `e2e/support/` はテスト資材であり、独立したテストケースではありません。

| Suite | ファイル数 | 主な責務 |
| --- | ---: | --- |
| Vitest (`tests/`) | 120（root 15、shared 8、web 97） | Domain / Component / Page / Service / Repository / API / Script / Migration |
| Playwright E2E (`e2e/*.spec.ts`, Storybookを除く) | 17 | Build済みアプリを通る公開・管理の代表導線、Browser / Accessibility |
| Storybook Browser Test (`e2e/*.storybook.spec.ts`) | 2 | Storybook上のComponent表示、操作、寸法、Accessibility |
| **合計** | **139** | Visual RegressionはE2E内のscreenshot assertionとして実行 |

Layerはファイル名だけでは決めず、実際に呼ぶ対象、Mockする境界、assertする契約を基準にしています。一つの業務機能に複数のLayerがある場合は、別の失敗を検出するかを確認しました。Migration / Securityは横断的な観点としても記載しています。

## 機能と主な保証

| 機能 | Domain / Component / Page | Service / Repository / API | E2E / Visual / Browser |
| --- | --- | --- | --- |
| Pub検索・Map・List | `tests/shared/pub.test.ts`、`tests/web/pub-search.test.ts`、`pub-explorer.test.tsx`、`pub-map.test.tsx`、`pub-list.test.tsx`、`pub-results-panel.test.tsx` | `pub-repository.test.ts`、`pubs-api.test.ts`、`admin-pub-service.test.ts`、`admin-pub-repository.test.ts`、`admin-pubs-api.test.ts` | `search.spec.ts`、`desktop-map.spec.ts`、`mobile-map.spec.ts`、`visual-regression.spec.ts`、`accessibility.spec.ts` |
| Admin Pubs / Tags / Statuses | `admin-pub-editor.test.tsx`、`admin-tag-manager.test.tsx`、`admin-status-manager.test.tsx`、対応する各 `*-page.test.tsx` | `admin-pub-service.test.ts`、`admin-pub-repository.test.ts`、`admin-tags-api.test.ts`、`admin-statuses-api.test.ts`、`admin-master-api.test.ts`、`admin-api-client.test.ts`、`tag-repository.test.ts`、`status-repository.test.ts`、`master-repository.test.ts` | `admin-pubs.spec.ts`、`admin-tags.spec.ts`、`admin-sidebar.spec.ts` |
| Admin Content / Editorial | `admin-content-editor.test.tsx`、`admin-content-page.test.tsx`、`content-validation.test.ts`、`content-renderer-registry.test.tsx` | `admin-content-service.test.ts`、`admin-content-repository.test.ts`、`admin-content-api.test.ts`、`content-repository.test.ts`、`content-cache.test.ts`、`content-id-repository.test.ts`、`media-public-route.test.ts` | `admin-content.spec.ts`、`discover.spec.ts`（Guide / Story表示・Media・導線）、`locale.spec.ts`（日英本文）、`accessibility.spec.ts`（Guide axe） |
| Admin / Public Quiz | `quiz-domain.test.ts`、`quiz-categories.test.ts`、`quiz-card.test.tsx`、`quiz-actions.test.ts`、`admin-quiz-editor.test.tsx`、`admin-quiz-page.test.tsx` | `quiz-repository.test.ts`、`admin-quiz-service.test.ts`、`admin-quiz-api.test.ts`、`automation-quiz-routes.test.ts`、`quiz-cache.test.ts` | `quiz.spec.ts`、`admin-quiz.spec.ts` |
| Calendar | `calendar-domain.test.ts`、`date-rule-summary.test.ts`、`admin-calendar-date-rule-editor.test.tsx`、`admin-calendar-editor.test.tsx`、`calendar-page.test.tsx` | `calendar-public-data.test.ts`、`calendar-repository.test.ts`、`admin-calendar-service.test.ts`、`admin-calendar-api.test.ts` | `accessibility.spec.ts`（ページ表示・axe）、`discover.spec.ts`（パンくず・関連導線）。イベント内容やAdmin draft操作の業務E2Eはありません |
| Admin Media | `media-picker.test.tsx`、`media-library.test.tsx`、`media-uploader.test.tsx`、`media-validation*.test.ts`、`media-presentation.test.ts` | `media-service.test.ts`、`media-repository.test.ts`、`media-storage.test.ts`、`media-public-route.test.ts`、`admin-media-api.test.ts`、`media-repository-e2e.test.ts` | `admin-media.spec.ts`、`admin-media-picker.storybook.spec.ts` |
| Locale / Shared UI / Metadata | `i18n.test.ts`、`i18n-server.test.ts`、`language-switcher.test.tsx`、`public-ui.test.tsx`、`design-tokens.test.ts`、`metadata.test.ts` | `root-layout.test.tsx`、`privacy-page.test.tsx`、`home-page.test.tsx`、`discover-pages.test.tsx` | `home.spec.ts`、`locale.spec.ts`、`design-tokens.spec.ts`、`public-ui.storybook.spec.ts`、`visual-regression.spec.ts` |
| Automation / MCP | `mcp-contract.test.ts`、`mcp-automation-client.test.ts` | `automation-auth.test.ts`、`automation-reliability*.test.ts`、`automation-*-api.test.ts`、`automation-tags-flow.test.ts` | Automation APIのHTTP・Tool契約は下位レイヤーで確認され、ブラウザを使うAutomation導線はありません |

### 全テストファイルの主Layer・対象・代表保証

主Layerと保証は各ファイルの`describe` / `test`名および主要な期待結果から1行に要約しています。1行はそのファイルの全assertionを列挙するものではありません。

| Test file | Primary Layer | 対象機能 | 主な保証（代表） |
| --- | --- | --- | --- |
| `e2e/accessibility.spec.ts` | E2E / Accessibility | 公開Map / Discover / Calendar / Quiz / Guide | 各代表ページでcritical / seriousなaxe違反がない |
| `e2e/admin-content.spec.ts` | E2E | admin-content | Content一覧から日英Preview、Draft保存、Publishを操作する |
| `e2e/admin-media-picker.storybook.spec.ts` | Storybook Browser | admin-media-picker.storybook | Media Picker card has a separate keyboard control and accessible dialog |
| `e2e/admin-media.spec.ts` | E2E | admin-media | Japanese Media管理画面にfixtureを表示する |
| `e2e/admin-pubs.spec.ts` | E2E | admin-pubs | ログイン後に管理店舗一覧から固定店舗の編集フォームへ移動する |
| `e2e/admin-quiz.spec.ts` | E2E | admin-quiz | Quiz一覧からDraft保存、Choice操作、Publishを確認する |
| `e2e/admin-sidebar.spec.ts` | E2E | admin-sidebar | 全管理画面で共通SidebarのログアウトとRelease Infoに到達できる |
| `e2e/admin-tags.spec.ts` | E2E | admin-tags | ログイン後にタグ管理の固定一覧と操作ラベルを表示する |
| `e2e/design-tokens.spec.ts` | Browser / Design | design-tokens | Public tokens and layout: ${locale} ${width}px |
| `e2e/desktop-map.spec.ts` | E2E | desktop-map | Desktop exploration: ${locale} ${viewport.width} |
| `e2e/discover.spec.ts` | E2E | Discover / Calendar・Quiz・Editorial導線 | 表示・404・Media・パンくず・関連導線とoverflowを確認 |
| `e2e/home.spec.ts` | E2E | home | Homeの主要な探索UIを表示する |
| `e2e/locale.spec.ts` | E2E | locale | 英語選択をcookieへ保存し、同じURLの再読み込み後も維持する |
| `e2e/mobile-map.spec.ts` | E2E | mobile-map | Mobile carousel and marker synchronization ${locale} ${width} |
| `e2e/public-ui.storybook.spec.ts` | Storybook Browser | public-ui.storybook | Public UI: ${locale} ${width}px |
| `e2e/quiz.spec.ts` | E2E | quiz | 今日のクイズを正解として採点し、回答前に回答情報を送らない |
| `e2e/search.spec.ts` | E2E | search | 店舗名検索から対象店舗だけを結果一覧へ表示する |
| `e2e/share.spec.ts` | E2E | share | public sharing ${locale} ${width} |
| `e2e/visual-regression.spec.ts` | Visual / E2E | visual-regression | Map desktop Japanese |
| `tests/calendar-migrations.test.ts` | Migration | calendar database migration | defines the Calendar tables, constraints, indexes, and migration history |
| `tests/check-llm-security.test.ts` | Security | LLM security content check | reports non-NFC text without changing it |
| `tests/classify-ci-changes.test.ts` | Script / CI | CI change classification | runs only the sensitive check for documentation paths |
| `tests/generate-api-keys.test.ts` | Script / CI | generate-api-keys | uses a safe default and validates the requested count |
| `tests/generate-database-schema.test.ts` | Script / CI | database schema generator | renders tables, columns, constraints, foreign keys, and indexes in stable order |
| `tests/import-pubs.test.ts` | Script / CI | parsePubs | accepts valid pub data |
| `tests/migrations.test.ts` | Migration | pubs database migrations | uses a unique migration number after the merged UUID-default migration |
| `tests/prepare-release.test.ts` | Script / CI | prepare-release | creates no tag before deployment and finalizes the same metadata after success |
| `tests/repository-safety.test.ts` | Security | repository safety check | detects external account information and secret-shaped values |
| `tests/resolve-neon-target.test.ts` | Script / CI | resolveNeonTarget | resolves the configured %s Branch at runtime |
| `tests/run-localization-migration.test.ts` | Migration | getLocalizationMigrationFiles | prepares the schema migration and its verification in order |
| `tests/run-neon-migration.test.ts` | Migration | prepareMigrationSql | removes the psql-only ON_ERROR_STOP command before using Neon Client |
| `tests/shared/admin-api-error.test.ts` | Domain | admin API error codes | derives API error validation from the exported code list |
| `tests/shared/admin-content.test.ts` | Domain | admin content input | accepts and normalizes an incomplete draft |
| `tests/shared/admin-pub.test.ts` | Domain | admin pub search validation | normalizes all supported filters |
| `tests/shared/admin-status.test.ts` | Domain | admin status validation | normalizes names and treats an empty English value as unregistered |
| `tests/shared/admin-tag.test.ts` | Domain | admin tag validation | normalizes display names while preserving a valid internal key |
| `tests/shared/metadata.test.ts` | Domain | normalized metadata definitions | defines all JIS prefectures in ascending code order |
| `tests/shared/pub.test.ts` | Domain | asPubs | returns typed pub data when every item is valid |
| `tests/shared/tag.test.ts` | Domain | getTagLabel | returns Japanese labels for defined tag IDs |
| `tests/validate-production-env.test.ts` | Script / CI | validate-production-env | identifies Vercel Production without exposing any value |
| `tests/verify-pr-ci.test.ts` | Script / CI | verify-pr-ci | accepts an existing successful check without dispatching |
| `tests/verify-production-release.test.ts` | Script / CI | Production release preflight | accepts one or more distinct Production hostnames |
| `tests/web/admin-api-client.test.ts` | API / Auth | admin media API error translation | falls back to the shared safe translation for unknown errors |
| `tests/web/admin-api.test.ts` | API / Auth | admin API request validation | allows authenticated read requests without an Origin header |
| `tests/web/admin-calendar-api.test.ts` | API / Auth | admin calendar API | returns the event list and database configuration state |
| `tests/web/admin-calendar-date-rule-editor.test.tsx` | Component | AdminCalendarDateRuleEditor | renders each supported rule type and emits changes |
| `tests/web/admin-calendar-editor.test.tsx` | Component | AdminCalendarEditor | renders bilingual fields, date rule, aliases, and a read-only ID |
| `tests/web/admin-calendar-service.test.ts` | Service / Domain | admin calendar service | Application生成UUIDをRepositoryへ渡し、正規化した入力と一覧を委譲する |
| `tests/web/admin-content-api.test.ts` | API / Auth | admin content API | rejects unauthenticated list access |
| `tests/web/admin-content-editor.test.tsx` | Component | AdminContentEditor | Media Pickerの画像を日本語の選択範囲へ挿入し、英語本文を変えずにPreviewできる |
| `tests/web/admin-content-page.test.tsx` | Page | Admin Content pages | 認証後にDraftを含む一覧と編集導線を表示する |
| `tests/web/admin-content-repository.test.ts` | Repository | admin content repository | returns incomplete draft fields and both locale translations |
| `tests/web/admin-content-service.test.ts` | Service / Domain | admin content service | creates a server-ID draft after validation |
| `tests/web/admin-layout.test.tsx` | Page | AdminLayout | shows setup guidance when admin authentication is not configured |
| `tests/web/admin-master-api.test.ts` | API / Auth | admin master APIs | rejects unauthenticated and invalid sessions before reading a repository |
| `tests/web/admin-media-api.test.ts` | API / Auth | admin media API | requires an administrator and reports an empty list when DB is not configured |
| `tests/web/admin-navigation.test.tsx` | Component | AdminNavigation | links every management area and marks the current page |
| `tests/web/admin-pub-editor.test.tsx` | Component | AdminPubEditor | 保存時に日本語のみの下書きとタグ0件を送信する |
| `tests/web/admin-pub-repository.test.ts` | Repository | admin pub repository | returns a Japanese-name-only draft with nullable fields |
| `tests/web/admin-pub-service.test.ts` | Service / Domain | admin pub service | rejects invalid draft input before querying references |
| `tests/web/admin-pubs-api.test.ts` | API / Auth | GET /api/admin/pubs | rejects unauthenticated requests before reading pubs |
| `tests/web/admin-pubs-page.test.tsx` | Page | AdminPubsPage states | translates loading and error states into English |
| `tests/web/admin-quiz-api.test.ts` | API / Auth | admin quiz API | returns both the list and database configuration state |
| `tests/web/admin-quiz-editor.test.tsx` | Component | AdminQuizEditor | 画像を選択して日英の説明を保存payloadへ含める |
| `tests/web/admin-quiz-page.test.tsx` | Page | Admin Quiz pages | renders the list and edit link after authentication |
| `tests/web/admin-quiz-service.test.ts` | Service / Domain | admin quiz service | normalizes valid draft input and generates sort order from array order |
| `tests/web/admin-server.test.ts` | API / Auth | requireAdminSession | redirects when admin authentication is not configured |
| `tests/web/admin-status-manager.test.tsx` | Component | AdminStatusManager | shows fixed keys, both names, and an unregistered English state |
| `tests/web/admin-statuses-api.test.ts` | API / Auth | admin statuses API | returns statuses to an authenticated administrator and rejects unauthenticated access |
| `tests/web/admin-statuses-page.test.tsx` | Page | AdminStatusesPage | does not load status data when the session is invalid |
| `tests/web/admin-tag-manager.test.tsx` | Component | AdminTagManager | shows translations and pub counts without rendering deletion for an in-use tag |
| `tests/web/admin-tags-api.test.ts` | API / Auth | admin tags API | returns tags to an authenticated administrator and rejects unauthenticated access |
| `tests/web/admin-tags-page.test.tsx` | Page | AdminTagsPage | does not load tag data when the session is invalid |
| `tests/web/admin.test.tsx` | Page | admin UI | logs in and translates an API error into Japanese |
| `tests/web/app-header.test.tsx` | Component | AppHeader | renders the home link and language switcher without a page heading |
| `tests/web/app-version-footer.test.tsx` | Component | release display | shows version and JST minute in Japanese without exposing the SHA publicly |
| `tests/web/automation-auth.test.ts` | API / Auth | Automation API authentication | compares SHA-256 digests for tokens of different lengths without throwing |
| `tests/web/automation-content-api.test.ts` | API / Auth | automation content API | requires Bearer authentication on every operation |
| `tests/web/automation-master-api.test.ts` | API / Auth | automation master APIs | requires a valid Bearer Token and master:read on every route before repository access |
| `tests/web/automation-pubs-api.test.ts` | API / Auth | Automation Pub API | uses the admin search parser and pagination for all supported filters |
| `tests/web/automation-quiz-routes.test.ts` | Domain / Unit | automation quiz routes | returns the admin quiz list and detail through quiz:read |
| `tests/web/automation-reliability-repository.test.ts` | Repository | automation reliability SQL | deletes only the expired completed target key before the unique claim |
| `tests/web/automation-reliability.test.ts` | API / Integration | automation reliability | replays %s create and rejects a different body |
| `tests/web/automation-tags-api.test.ts` | API / Auth | automation tag create API | requires a valid Bearer Token and tag:create without accepting a management session |
| `tests/web/automation-tags-flow.test.ts` | API / Integration | automation tag create and master read | returns the newly created tag with the same ID, key, translations, and zero usage |
| `tests/web/bottom-sheet.test.tsx` | Component | BottomSheet | shows optional collapsed content and moves its focus to the handle when expanded |
| `tests/web/calendar-domain.test.ts` | Domain / Unit | calendar date rule validation | all Calendar Domain date rule types are parsed from persisted definitions |
| `tests/web/calendar-page.test.tsx` | Page | Irish Calendar page | 日本語で当日複数件と月内イベントを表示する |
| `tests/web/calendar-public-data.test.ts` | Service / Domain | calendar public data loader | Published Event全体を固定Key・TagのCacheへ委譲する |
| `tests/web/calendar-repository.test.ts` | Repository | calendar public repository | 公開済みだけを検証済みのCalendarEventとして返し、管理情報を公開しない |
| `tests/web/content-cache.test.ts` | Service / Domain | editorial content cache tags | 個別・一覧のlocaleをキャッシュキーに含め、既存タグを関連付ける |
| `tests/web/content-editor-image.test.ts` | Domain / Unit | insertMediaImageMarkdown | カーソル位置または選択範囲へMedia参照を挿入する |
| `tests/web/content-id-repository.test.ts` | Repository | published content ID repository | 公開ContentだけをIDとLocale fallbackで取得する |
| `tests/web/content-renderer-registry.test.tsx` | Component | content renderer registry | kindを固定Rendererへ対応付け、DB値からimport pathを解決しない |
| `tests/web/content-repository.test.ts` | Repository | editorial content repository | 公開済みContentだけをパラメータ化SQLとlocaleフォールバックで取得する |
| `tests/web/content-validation.test.ts` | Domain / Unit | editorial content validation | reports language-independent and locale-specific publication requirements |
| `tests/web/date-rule-summary.test.ts` | Domain / Unit | formatCalendarDateRuleSummary | 動的なcase名による検証 |
| `tests/web/design-tokens.test.ts` | Domain / Unit | Design Tokens | resolves every shared component token against the canonical definitions |
| `tests/web/discover-pages.test.tsx` | Page | Discover pages | HubでStories placeholderと公開Editorial Guide、Quizへの導線を表示する |
| `tests/web/e2e-test-mode.test.ts` | Security / Service | E2E test mode | returns stable localized fixtures without a database |
| `tests/web/home-page.test.tsx` | Page | Home | keeps the explorer available without exposing a failed API response |
| `tests/web/i18n-server.test.ts` | Service / Domain | Server Component locale resolution | 動的なcase名による検証 |
| `tests/web/i18n.test.ts` | Domain / Unit | i18n locale resolution | derives the supported locale list from the shared definition |
| `tests/web/language-switcher.test.tsx` | Component | LanguageSwitcher | shows the current language and available languages |
| `tests/web/master-repository.test.ts` | Repository | master repository | returns prefectures with Japanese display names in code order |
| `tests/web/mcp-auth.test.ts` | API / Auth | MCP OAuth authentication | fails closed when required configuration is absent |
| `tests/web/mcp-automation-client.test.ts` | API / Auth | MCP Automation API client | calls the allowlisted Automation path with a server-side Bearer token |
| `tests/web/mcp-contract.test.ts` | API / Auth | Remote MCP contract | fails closed when OAuth audience and protected resource differ |
| `tests/web/media-library.test.tsx` | Component | Media Library in the admin manager | loads page one and displays media metadata without the Blob URL |
| `tests/web/media-picker.test.tsx` | Component | MediaPicker | opens a native dialog, selects temporarily, and commits only with Use selected |
| `tests/web/media-presentation.test.ts` | Domain / Unit | media presentation helpers | formats MIME labels and 1024-based file sizes |
| `tests/web/media-public-route.test.ts` | API / Auth | public Media URL | 登録済み画像をBlobへ一時redirectし、画像バイナリをproxyしない |
| `tests/web/media-repository-e2e.test.ts` | Repository | Media repository E2E mode | returns fixed paginated fixtures without opening Neon |
| `tests/web/media-repository.test.ts` | Repository | media repository | uses fixed-size pagination, stable ordering, and maps rows without storage keys |
| `tests/web/media-service.test.ts` | Service / Domain | media upload service | compensates a Blob upload when database insert fails |
| `tests/web/media-storage.test.ts` | Service / Domain | media storage | uploads a public blob with stable, non-overwriting options |
| `tests/web/media-uploader.test.tsx` | Component | MediaUploader | allows %s files |
| `tests/web/media-validation-animated.test.ts` | Domain / Unit | animated media validation | rejects multi-frame WebP after decoding its metadata |
| `tests/web/media-validation.test.ts` | Domain / Unit | media upload validation | uses decoded image format and dimensions |
| `tests/web/privacy-page.test.tsx` | Page | PrivacyPage | 日本語版と英語版のポリシーJSONは同じセクション構造を持つ |
| `tests/web/pub-explorer.test.tsx` | Component | shared pub links | opens a shared %s pub in the detail panel |
| `tests/web/pub-list.test.tsx` | Component | PubList | renders the result count and compact pub cards |
| `tests/web/pub-map.test.tsx` | Component | PubMap | initializes a MapLibre map and markers when WebGL is available |
| `tests/web/pub-repository.test.ts` | Repository | admin pub list search | passes all filters as parameters and returns a bounded page with both publication states |
| `tests/web/pub-results-panel.test.tsx` | Component | PubResultsPanel | renders compact results and an empty state |
| `tests/web/pub-search.test.ts` | Domain / Unit | filterPubsByQuery | keeps translated prefecture options in JIS order without changing filter values |
| `tests/web/public-ui.test.tsx` | Component | Public UI primitives | requires an accessible icon label and hides decorative paths |
| `tests/web/pubs-api.test.ts` | API / Auth | GET /api/pubs | returns an empty list locally when API key and database are not configured |
| `tests/web/quiz-actions.test.ts` | Service / Domain | submitQuizAnswer | Server側でLocaleを決定し、Published Quiz Repositoryの結果を返す |
| `tests/web/quiz-cache.test.ts` | Service / Domain | public quiz cache | localeをCache Keyに含め、Published一覧だけを5分Cacheする |
| `tests/web/quiz-card.test.tsx` | Component | QuizCard | 回答前は問題と4択だけを表示し、正解・解説・情報源を公開しない |
| `tests/web/quiz-categories.test.ts` | Domain / Unit | quiz category definitions | covers every allowed category exactly once with complete labels |
| `tests/web/quiz-domain.test.ts` | Domain / Unit | daily quiz selection | uses the Asia/Tokyo calendar date boundary |
| `tests/web/quiz-repository.test.ts` | Repository | public quiz repository | E2E Test ModeではPublished Question一覧と採点をfixtureから返す |
| `tests/web/release-info.test.ts` | Domain / Unit | release info | validates and formats the same metadata for Public and Admin |
| `tests/web/root-layout.test.tsx` | Page | RootLayout | Vercel AnalyticsとSpeed Insightsを全ページに追加する |
| `tests/web/share-button.test.tsx` | Component | ShareButton | shares only the supplied public payload and prevents duplicate operations |
| `tests/web/status-repository.test.ts` | Repository | status repository | returns an empty list without a configured database |
| `tests/web/tag-repository.test.ts` | Repository | tag repository | returns an empty list without opening a connection when the database is not configured |

### Layerの横断傾向

- **Domain / Unit**: `tests/shared/` (8 files); `tests/web/` pure-rule and transformation tests such as `pub-search`, `quiz-domain`, `quiz-categories`, `calendar-domain`, `date-rule-summary`, `content-validation`, `content-editor-image`, `media-validation*`, `media-presentation`, `media-validation-animated`, `i18n`, and `metadata`.
- **Component**: `tests/web/*.test.tsx` focused on individual interactive components, including Pub Map / List / Explorer, quiz and admin editors, status/tag managers, media picker/uploader/library, public UI, navigation, header, sheet, and share controls.
- **Page**: `tests/web/*-page.test.tsx` and page-focused files `admin.test.tsx`, `admin-layout.test.tsx`, `home-page.test.tsx`, `discover-pages.test.tsx`, `calendar-page.test.tsx`, `root-layout.test.tsx`, and `privacy-page.test.tsx`.
- **Service**: `admin-pub-service`, `admin-content-service`, `admin-quiz-service`, `admin-calendar-service`, and `media-service` verify use-case order, dependency calls, and failure handling with repositories / media dependencies mocked.
- **Repository**: `*-repository.test.ts` and `*-repository-e2e.test.ts` control Neon responses or test-mode behavior to check query construction, row conversion, ordering, pagination, public filtering, and DB-disabled / E2E fixture boundaries.
- **API**: `*-api.test.ts`, `admin-api.test.ts`, `admin-api-client.test.ts`, `admin-server.test.ts`, `automation-auth.test.ts`, `mcp-auth.test.ts`, `mcp-contract.test.ts`, `mcp-automation-client.test.ts`, `pubs-api.test.ts`, and `media-public-route.test.ts` check route/auth/response contracts and external tool contracts.
- **Migration**: `migrations.test.ts` and `calendar-migrations.test.ts` inspect migration SQL, verification / rollback SQL, schema-history ordering, constraints, and compatibility transitions. `run-neon-migration.test.ts` and `run-localization-migration.test.ts` focus on migration runner parsing and file selection.
- **Script / Security / CI**: root-level `import-pubs`, `generate-api-keys`, `generate-database-schema`, `prepare-release`, `resolve-neon-target`, `validate-production-env`, `verify-production-release`, `verify-pr-ci`, `classify-ci-changes`, `repository-safety`, and `check-llm-security` verify operational scripts, release guards, and repository policy. `e2e-test-mode.test.ts` covers data / mutation safety for browser fixtures.
- **E2E**: 17 Playwright files cover public home, Discover, search, map, quiz, sharing, locale and editorial content; admin pubs, tags, quiz, content, media and sidebar; and accessibility / design-token checks. `visual-regression.spec.ts`, `desktop-map.spec.ts`, `mobile-map.spec.ts`, and `admin-media.spec.ts` own screenshot baselines. The two `*.storybook.spec.ts` files run separately through `playwright.storybook.config.ts`.

## 整合性、重複、旧仕様、Mock / Fixture

- 確認したファイル名・テスト名と、`docs/development/testing.md` のLayer責務、`vitest.config.ts`、`playwright.config.ts`、`playwright.storybook.config.ts` の分離は整合しています。Vitestはjsdom、Playwright E2Eはbuild済みアプリ + `E2E_TEST_MODE=1`、Storybook browser testは別設定です。
- #219 完了後の現行Playwright構成が対象です。`*.storybook.spec.ts` は通常E2Eから除外され、Storybook browser test設定でのみ実行されます。Visual snapshotは単独のLayerではなく、Map / Media等のBrowserシナリオに対する見た目のassertです。
- Pub / Quiz / Content / Tag / CalendarのDomain・Component・Service・Repository・API・E2Eが同じ業務用語を含むことだけでは重複と判定しません。例えばQuizのDomain入力規則、Service依存呼び出し、Admin API認可、Repository永続化、E2E編集導線は異なる失敗を検出します。削除・統合できると確認できたassertion/fileはありません。
- 明確な旧仕様テスト候補は見つかりませんでした。`legacy` / 旧ID / 旧データ形式への言及は、現行Schema・移行処理・入力契約の互換性や拒否を守るテストです。例は `migrations.test.ts`、`admin-quiz-service.test.ts`、`admin-quiz-api.test.ts`、`automation-quiz-routes.test.ts`、`mcp-contract.test.ts`、`shared/pub.test.ts`、`import-pubs.test.ts` です。これらは現行の移行系列・Validationと合わせて維持する候補です。
- `vi.mock` / `vi.spyOn` 等のMock使用は検索上181箇所でした（これは呼出し箇所数であり、独立したMock件数ではありません）。特にRepository / API / ServiceのMockは対象境界の外側に配置され、Layer分離に沿います。テストの結果状態や型の形が実装から乖離していないか、変更時に確認してください。
- `E2E_TEST_DATA` と `e2e/support/test-values.ts` はBuild済みE2Eの固定データ・資格情報、`tests/setup.ts` と `tests/mocks/maplibre-gl.ts` はVitest共通環境・地図Mockです。`media-repository-e2e.test.ts` はE2E modeでNeonに接続しないこととmutation拒否を、`e2e/admin-media.spec.ts` は実画面でFixture表示・操作を確認しており、別境界を確認します。
- `test.skip` / `it.skip` / `test.todo` / `test.only` 等の固定・未実装ケースは検索で見つかりませんでした。

## 維持・削除 / 統合・Mock / Fixture候補

| 判断 | 対象 | 根拠 / 次の作業 |
| --- | --- | --- |
| 維持 | 既存の全Layerと17本の代表E2E | 固有の境界や利用者導線を確認しており、重複だけを理由に削除できるものは見つからない |
| 削除候補 | なし | 現行仕様から外れた保証や固有assertionのないファイルを特定できなかった |
| 統合候補 | なし（要再確認候補は下記） | 同一条件・同一観測結果の重複を確認できなかった。類似領域は下位詳細 + 上位代表導線の関係 |
| Mock / Fixture見直し | Repository / API testsのDB row・request mocks、複数箇所のQuiz / Media payload、`E2E_TEST_DATA` | Schema / shared type / E2E fixture変更時に各fixtureを追従させる必要がある。現時点で誤った値や仕様との不一致は確認されていない |
| Mock / Fixture見直し | MapLibre共通Mock | `tests/mocks/maplibre-gl.ts` によるjsdomテストでは実Map挙動を証明しない。Mapの主要接続・失敗回復はChromiumのMap E2Eで補完できていることを維持する |

類似目的に見える組合せは、将来テストを整理するときにassertion単位で再点検してください。

- `tests/web/design-tokens.test.ts` と `e2e/design-tokens.spec.ts`: 前者はtoken定義・互換token、後者はcompiled CSSのBrowser状態を確認します。
- `tests/calendar-migrations.test.ts` と `tests/migrations.test.ts`: Calendar用SQLの制約・verify詳細と、全体 migration 023 の前提確認を持つため、現在のassertionは同一ではありません。
- `tests/web/media-repository.test.ts` と `media-repository-e2e.test.ts`: 通常RepositoryのSQL / row mappingと、E2E modeのNeon非接続 / mutation拒否を分担しています。
- `tests/web/admin-tags-api.test.ts` と `automation-tags-api.test.ts` / `automation-tags-flow.test.ts`: Admin sessionとAutomation bearer scopeという異なる認証・HTTP契約を検証します。
- Component / PageテストとStorybook / Visual: 状態・操作、画面構成、実Browserの寸法・見た目を別々に保証します。

## Coverage Hole / 後続候補

これはテストが誤っているという指摘ではなく、現状のSuiteから見た追加保証候補です。優先度・受容条件は別Issueで検討してください。

1. **Calendarの業務E2E**: 公開Calendarは`e2e/accessibility.spec.ts`でページ表示とaxe検査を、`e2e/discover.spec.ts`でパンくずと関連導線を確認します。Editorial Guideは`e2e/accessibility.spec.ts`のaxe検査と`e2e/locale.spec.ts`の日英本文表示があり、Discover / Guide全体も`e2e/discover.spec.ts`が確認します。一方、Calendarイベントの表示内容や業務操作、Admin draft保存などの業務フローを通すE2Eはありません。実際のrouting / cookie / API接続回帰を防ぎたい場合に、短い代表シナリオを追加する候補です。
2. **Migrationの実DB適用**: migrationテストはSQL文字列や期待する節の存在を確認し、実Postgresへの適用成功、既存データ形状での値変換、verify / rollbackの実行成功までは保証しません。Runbookに従う隔離DB検証・CI化は別途検討候補です。SQL文字列assertionを増やすだけではHoleを埋めません。
3. **Accessibilityのページ代表範囲**: E2E axeはPublic Map、Discover index、Public Calendar、Public Quiz、Guide、Admin Mediaを検査し、StorybookではPublic UIとMedia Pickerを確認します。Admin Content / Quiz / Calendarのアクセシビリティをブラウザで守る必要がある場合は、全画面一律ではなく代表状態を選ぶ候補です。
4. **Visual Baselineの対象範囲**: screenshot baselineはMap / Discover index / Admin Mediaに集中しています。Discover / Calendar / Editorialにはページ表示・導線・axeの確認がありますが、Calendarイベント内容や主要なAdmin Content / Quizの見た目をVisual基準で守る必要がある場合は、既存Browser assertionとの役割を分けて追加します。
5. **実データSchemaとの差分**: Repositoryテストは制御したNeon mockの応答を使います。新しいQuery / Migration変更時、mockの形だけで現行Production Schemaとの整合を主張せず、必要な場合は隔離したDBで検証します。

## 確認したこと / 未確認なこと

- 確認したこと: 139テストファイルそれぞれの主Layer・対象機能・代表的な`describe` / `test`名、Vitest / Playwright / Storybook設定、代表Fixture / Mock、Visual snapshot参照、skip / todo / only markerの有無、Testing StrategyとのLayer整合性。
- 未確認なこと: Neon上のProduction Schema / データに対する各Repository QueryとMigrationの実行結果、全画面の実ブラウザ手動操作、CI実行結果。これらはこの静的な棚卸しからは結論できません。
