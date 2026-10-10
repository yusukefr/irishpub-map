# Test Suite最終確認（Issue #538）

この記録は、2026-10-10にcommit `0a42b8d` を基準に実行したTest Suiteの最終確認結果です。現行のテスト方針は[テスト戦略](testing.md)、CoverageとCIの設定は`vitest.config.ts`および`.github/workflows/ci.yml`をSource of Truthとします。

## 実行環境と結果

Node.js `v24.21.0`、ロックファイルに基づく`npm ci`後に各コマンドを実行しました。時間はこのworktreeでの単回実行であり、CI環境との性能比較を示すものではありません。

| Command                   | 結果                            | 経過時間 |
| ------------------------- | ------------------------------- | -------: |
| `npm run format:check`    | 成功                            |     11秒 |
| `npm run lint`            | 成功                            |     12秒 |
| `npm run typecheck`       | 成功                            |      5秒 |
| `npm test`                | 成功、123 files / 1007 tests    |    150秒 |
| `npm run build`           | 成功                            |     35秒 |
| `npm run build-storybook` | 成功                            |      6秒 |
| `npm run test:e2e`        | 一部失敗、67 passed / 12 failed |    162秒 |
| `npm run test:storybook`  | 成功、17 tests                  |     41秒 |

Vitest CoverageはStatements 93.43%、Branches 90.31%、Functions 93.42%、Lines 95.55%で、設定済みの各90% thresholdを満たしました。計測出力はjsdom環境を123ファイルで生成し、環境初期化がtracked timeの56%（合計218.94秒）だったと報告しています。これはVitestの実行時間を改善する際の調査候補ですが、今回の作業ではpool設定・テスト隔離方式を変更していません。

Node.js setupを追加する前のローカル実行では、Map / Discover画面の`screenshot`比較12件が失敗し、残る67件は成功しました。基準画像は更新していません。Discover desktop Japaneseの比較を単独でも再実行し、同じ差分を再現しました。Playwright Browser・OS環境差による描画差が候補でしたが、この時点では確定していません。Storybook browser testは17件すべて成功しました。

その後、E2E用GitHub ActionsコンテナにNode.js setupがなく、`.nvmrc`のNode.js 24ではなくコンテナ既定のruntimeでBuildしていたことが分かりました。WorkflowにNode.js 24 setupを加えた最新HEADで`workflow_dispatch`（`run_e2e=true`）を実行し、Full CIとE2E jobが成功しました。E2E jobは4分05秒で、Playwright E2EとStorybook browser testsの両方を完了しています。通常のPR CIとWorkflow Lintも成功しました。

## 設定の確認

- Coverage対象は`packages/shared/src`と`apps/web/app/components`です。共有Domainの検証と主要Componentを対象にし、Service・Repository・API全体へ90%を要求する設定ではありません。これらの層は個別のVitestテストがあり、Testing Strategyに記載されたCoverageの用途と一致しています。
- CIのFull CIはSensitive Data、LLM Security、Format、OpenAPI lint、Lint、Vitest、Next.js Build、Storybook Buildを実行します。通常E2EとStorybook browser testはPRの変更分類に応じて実行し、`main` pushでは実行します。Testing Strategyへこの対応を追記しました。
- E2E jobにも`.nvmrc`からNode.jsを選ぶsetupを追加しました。Node.js 24 setup後のWorkflow dispatchではFull CI、E2E、Storybook browser testsが成功しました。
- 検証ではテスト削除、Coverage threshold変更、CI条件変更をしていません。

## 後続調査

jsdom初期化の実行時間は後続でpool候補と隔離性を評価できる明確なボトルネックとして確認しました。通常E2EのVisual Regression失敗は再現環境を揃えて差分の原因を判定する必要があります。
