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
| Admin Content / Editorial | `admin-content-editor.test.tsx`、`admin-content-page.test.tsx`、`content-validation.test.ts`、`content-renderer-registry.test.tsx` | `admin-content-service.test.ts`、`admin-content-repository.test.ts`、`admin-content-api.test.ts`、`content-repository.test.ts`、`content-cache.test.ts`、`content-id-repository.test.ts`、`media-public-route.test.ts` | `admin-content.spec.ts`、`locale.spec.ts` |
| Admin / Public Quiz | `quiz-domain.test.ts`、`quiz-categories.test.ts`、`quiz-card.test.tsx`、`quiz-actions.test.ts`、`admin-quiz-editor.test.tsx`、`admin-quiz-page.test.tsx` | `quiz-repository.test.ts`、`admin-quiz-service.test.ts`、`admin-quiz-api.test.ts`、`automation-quiz-routes.test.ts`、`quiz-cache.test.ts` | `quiz.spec.ts`、`admin-quiz.spec.ts` |
| Calendar | `calendar-domain.test.ts`、`date-rule-summary.test.ts`、`admin-calendar-date-rule-editor.test.tsx`、`admin-calendar-editor.test.tsx`、`calendar-page.test.tsx` | `calendar-public-data.test.ts`、`calendar-repository.test.ts`、`admin-calendar-service.test.ts`、`admin-calendar-api.test.ts` | 現在のE2E suiteにCalendar専用の公開・管理導線はありません |
| Admin Media | `media-picker.test.tsx`、`media-library.test.tsx`、`media-uploader.test.tsx`、`media-validation*.test.ts`、`media-presentation.test.ts` | `media-service.test.ts`、`media-repository.test.ts`、`media-storage.test.ts`、`media-public-route.test.ts`、`admin-media-api.test.ts`、`media-repository-e2e.test.ts` | `admin-media.spec.ts`、`admin-media-picker.storybook.spec.ts` |
| Locale / Shared UI / Metadata | `i18n.test.ts`、`i18n-server.test.ts`、`language-switcher.test.tsx`、`public-ui.test.tsx`、`design-tokens.test.ts`、`metadata.test.ts` | `root-layout.test.tsx`、`privacy-page.test.tsx`、`home-page.test.tsx`、`discover-pages.test.tsx` | `home.spec.ts`、`locale.spec.ts`、`design-tokens.spec.ts`、`public-ui.storybook.spec.ts`、`visual-regression.spec.ts` |
| Automation / MCP | `mcp-contract.test.ts`、`mcp-automation-client.test.ts` | `automation-auth.test.ts`、`automation-reliability*.test.ts`、`automation-*-api.test.ts`、`automation-tags-flow.test.ts` | Automation APIのHTTP・Tool契約は下位レイヤーで確認され、ブラウザを使うAutomation導線はありません |

### Test files organized by primary Layer

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

1. **Calendarのブラウザ接続**: CalendarはDomain / Page / Service / Repository / APIにテストがありますが、公開画面・Admin編集を通したPlaywright導線がありません。公開イベント表示、日英切替、Admin draft保存など、実際のrouting / cookie / API接続回帰を防ぎたい場合、短い代表シナリオを追加する候補です。
2. **Migrationの実DB適用**: migrationテストはSQL文字列や期待する節の存在を確認し、実Postgresへの適用成功、既存データ形状での値変換、verify / rollbackの実行成功までは保証しません。Runbookに従う隔離DB検証・CI化は別途検討候補です。SQL文字列assertionを増やすだけではHoleを埋めません。
3. **Accessibilityのページ代表範囲**: E2E axeはPublic MapとAdmin Media、StorybookではPublic UIとMedia Pickerが中心です。Admin Content / Quiz / Calendarや公開Editorial / Calendarに重大なアクセシビリティ回帰が起こる懸念が高ければ、全画面一律ではなく代表状態を選ぶ候補です。
4. **Visual Baselineの対象範囲**: snapshotはMap / Discover / Admin Mediaに集中しています。主要なPublic Editorial・CalendarやAdmin Content / Quizの見た目をVisual基準で守る必要がある場合、既存Browser assertionとの役割を分けたうえで追加します。
5. **実データSchemaとの差分**: Repositoryテストは制御したNeon mockの応答を使います。新しいQuery / Migration変更時、mockの形だけで現行Production Schemaとの整合を主張せず、必要な場合は隔離したDBで検証します。

## 確認したこと / 未確認なこと

- 確認したこと: テストファイルの件数、テスト名と主要assertion、Vitest / Playwright / Storybook設定、代表Fixture / Mock、Visual snapshot参照、skip / todo / only markerの有無、Testing StrategyとのLayer整合性。
- 未確認なこと: Neon上のProduction Schema / データに対する各Repository QueryとMigrationの実行結果、全画面の実ブラウザ手動操作、CI実行結果。これらはこの静的な棚卸しからは結論できません。
