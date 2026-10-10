# テスト戦略

Irish Pub Mapのテストを追加・整理するときの判断基準です。この文書は現在の方針を保守するCurrent Documentです。実行手順は[開発規約](conventions.md)、[CI運用](../runbooks/release-operations.md)、[Visual Regression](../runbooks/visual-regression.md)、[ブラウザ確認](../runbooks/browser-check.md)を参照します。

## 基本原則

- **下位レイヤーほど詳細、上位レイヤーほど代表シナリオ**を検証します。境界値、分岐、エラーは原因を特定しやすい最も低いレイヤーで網羅し、上位では重要な接続点と利用者の導線を選びます。
- テスト数やCoverage率そのものを目的にしません。回帰を検出できること、失敗原因が分かること、安定して実行・保守できることを重視します。
- ファイル名や配置だけでレイヤーを決めません。実際に動かす対象、置き換える依存、検証する契約で選びます。1つの機能に複数レイヤーが必要な場合も、それぞれ異なる失敗を検出する理由を明確にします。
- 仕様変更時は、該当する既存テストと関連文書を先に確認します。新しいテストを足す前に、既存テストの更新で保証できるか検討します。

## レイヤーごとの責務

| レイヤー | 主に保証すること | ここで広げすぎないこと |
| --- | --- | --- |
| Unit / Domain | 共有型の検証、検索・日付・公開条件などの純粋な規則、境界値と異常値 | HTTP、描画、DBなど別レイヤーの接続 |
| Component | 単体UIの表示、状態、操作、アクセシブルな名前・役割。Testing Libraryで利用者から見える結果を確認する | ページ全体の取得処理や実ブラウザのレイアウト |
| Page | ページがデータ・状態・子Componentを組み合わせる結果。空状態、エラー、権限、主要な分岐 | 実サーバー、画面遷移、CSSレイアウトの再現 |
| Service | ユースケースの手順、認可後の処理、依存先の呼び分け、失敗時の結果 | Route HandlerのHTTP契約やSQLの細部 |
| Repository | クエリ、行の変換、並び順、永続化境界、DB未設定時の扱い。必要な分岐は制御したDB応答で検証する | HTTP応答やMigration後の実Schemaの証明 |
| API | Route Handlerの入力検証、認証・認可、status、response、Serviceへの受け渡し | Service内部の全分岐やRepositoryのSQLの再検証 |
| Migration | SQLの適用・検証手順、Schemaの制約・Index・履歴、既存データとの整合 | Repositoryの通常の読み書きや画面動作 |
| E2E | build済みアプリとブラウザを通る代表的な利用者導線、画面間・API間の接続 | 全入力パターン、全業務分岐、DB Migrationの保証 |
| Visual / Browser / Storybook | Visualは主要画面の意図しない見た目の差分、Browser確認は操作感・responsive・focus・console、Storybookは独立したComponentの状態と表示 | これらだけで業務規則やサーバー側の契約を保証すること |

レイヤー名はテストの責務を表します。現行のVitestは`tests/**/*.test.{ts,tsx}`をjsdomで実行し、MapLibreをテスト用Mockへ置き換えます。Playwrightの通常E2Eは`e2e/`の`*.storybook.spec.ts`を除いてChromiumで実行し、Storybook browser testは別設定で同ファイルを実行します。

Vitestは全テストをjsdomで実行し、既定poolのper-file isolationを維持します。pool・環境・隔離方式を変更する場合は、全テストの反復実行、単独ファイル実行、テスト間のDOMとmodule状態のcleanupを確認します。現行の性能調査と判断経緯はIssue #606およびPR #607に記録しています。

## 追加するレイヤーの選び方

1. 回帰として検出したい**観測可能な振る舞い**を一文にします。想定する失敗（入力、分岐、境界、接続、見た目）も特定します。
2. その失敗を再現できる最も低いレイヤーを選びます。詳細な条件はそこで検証し、上位には必要な接続点だけを残します。
3. 既存テストが同じ条件と失敗を既に検出するなら、そのテストを更新します。別レイヤーにも置く場合は、追加で検出する固有の失敗を説明できるようにします。
4. 実行時間、外部依存、Fixtureの保守、失敗時の切り分けを考え、代表ケースと詳細ケースを配分します。

### 境界の判断

- **PageとE2E**: ページに渡すデータや依存を制御して空状態・エラー・権限・表示分岐を検証できるならPageです。実際のルーティング、URL、cookie、ブラウザ操作、複数画面とAPIの接続が要件ならE2Eです。同じ表示文言を全組み合わせで両方確認しません。
- **ServiceとAPI**: 業務手順、依存先の呼び分け、失敗の扱いはServiceです。HTTP入力からの変換、認証・認可、statusやresponse形式はAPIです。Route HandlerがServiceを正しく呼ぶ代表ケースをAPIで確認し、Service内部の分岐はServiceで確認します。
- **RepositoryとMigration**: Repositoryは現行Schemaを前提にしたクエリ・行変換と永続化境界、MigrationはSchema変更の適用結果と制約・履歴を保証します。SQLテキストの検査だけで実DBへの適用成功を主張しません。Schema変更時の実DB検証は[Neon Migration Runbook](../runbooks/neon-migrations.md)に従います。
- **Component、Storybook、Visual**: Component testは状態・操作の意味、Storybookは実ブラウザで孤立した部品の状態・寸法・アクセシビリティ、Visual Regressionは基準画像に対する主要画面の見た目を担当します。同じ見た目の全状態を3箇所で固定せず、差分の発見目的に合わせて代表状態を選びます。

### E2Eを追加する条件

実サーバーとブラウザを通さないと検出しにくい、重要な接続・導線の回帰に追加します。例は、検索から店舗選択まで、言語・URLをまたぐ遷移、管理画面での認証後の主要操作です。下位テストで十分に確認できるバリデーションの全境界値やServiceの全エラー分岐には追加しません。E2EのFixtureで再現できない永続化や実DBの性質は、対応するRepository・Migrationの検証を選びます。

追加時は、利用者が観測する結果をassertし、待機条件を明示し、固定時間のsleepや実行順への依存を避けます。画面ごとの細かな分岐を増やす前に、既存の代表導線へ必要なassertを追加できるか確認します。

## 重複と削除の判断

- 複数テストが同じ仕様を扱っていても、検出する失敗が違うなら残します。例えばDomainの境界値とE2Eの画面間接続、Repositoryの行変換とMigrationのSchema制約は別の保証です。
- 同じ条件、同じ観測結果、同じ依存境界で、片方を削除しても固有の失敗を見逃さない場合は統合・削除候補です。高コストな上位テストで細部を重複させている場合は、下位テストへ詳細を寄せ、上位には代表ケースを残します。
- 削除前に対象仕様が現行Behaviorに存在するか確認します。廃止仕様のテストは削除し、現行仕様のテストなら別テストで同じ回帰を検出できることを確認します。重要な保証が失われる場合は、適切なレイヤーへ移してから削除します。
- 不安定さだけを理由に無効化して放置しません。原因がテスト側の待機・Fixture・Mockなら修正し、実装の不具合なら修正します。削除・統合時は、失うassert、残る保証、実行時間や保守負担への影響をレビュー可能にします。

## Mock・Fixture・E2Eデータ

- Mockは対象レイヤーの**外側の境界**に置きます。Unit / Domainでは時刻や外部I/O、ServiceではRepositoryなど、APIでは必要に応じてService、RepositoryではDB応答を制御します。検証したい内部処理までMockにすると、実装と同じ想定をテストで繰り返すだけになるため避けます。
- Mockは利用する契約に必要な範囲を再現し、成功・失敗の戻り値を明示します。実装にない都合のよい動作を足さず、型・Schema・ID・localeの変更に合わせて更新します。外部Map styleなど不安定な外部資源は、検証目的を損なわない範囲で固定します。
- Fixtureは小さく、意味が分かる名前と有効な値を使います。各テストが必要な差分だけ上書きし、他のテストとの共有状態や実行順依存を避けます。異常値は意図を示すテストに局所化します。
- Playwrightはbuild済みアプリを`E2E_TEST_MODE=1`で起動し、アプリの固定Fixtureを使います。Production DBは使用しません。E2E用の読み取りFixtureは現行の共有型・Schema・ID・locale・公開条件と一致させ、E2E test modeで禁止される永続化を成功したものとして扱いません。Fixtureで代替できない実DBの検証は、隔離したDB環境で別途行います。
- screenshot、trace、HTML report、Fixtureには秘密情報、Preview URL、実アカウント、非公開の店舗データを入れません。Visualの基準画像は意図したUI変更のときだけ[更新手順](../runbooks/visual-regression.md)に従って変更します。

## Coverageと実行

Vitest Coverageは未検証箇所を探す**補助指標**です。現行設定は`packages/shared/src`と`apps/web/app/components`を対象とし、lines / functions / branches / statementsに各90%のthresholdを設けています。対象外のService、Repository、APIなどまで90%を保証する設定ではありません。thresholdを満たすためだけにassertの弱いテストを増やさず、値が変わったときは重要な分岐・契約の保証を確認します。thresholdの変更は影響と理由を別途レビューします。

ローカルの通常コマンドは`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`です。UI・導線の変更に応じて`npm run test:e2e`、`npm run test:storybook`、Visual / Browser確認を追加します。

### CIとの対応

CIは変更ファイルを分類して実行範囲を決めます。機密情報とLLM securityの検査は全変更で実行し、Full CIではFormat、OpenAPI lint、Lint、Vitest、Next.js Build、Storybook Buildを実行します。PRのPlaywright E2EとStorybook browser testは画面・Component・関連テストの変更時に実行し、`main`へのpushでは毎回実行します。docs-only PRでは機密情報とLLM securityの検査だけを実行します。`workflow_dispatch`はFull CIを実行し、E2Eは`run_e2e=true`を指定した場合に実行します。

この対応は[CI運用](../runbooks/release-operations.md)の変更分類と`.github/workflows/ci.yml`を反映しています。条件の詳細と手動実行方法はCI運用文書を参照してください。
