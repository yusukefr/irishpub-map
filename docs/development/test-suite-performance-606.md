# Vitest jsdom性能調査（Issue #606）

この記録は、2026-10-10にHEAD `53dd43c`（Vitest `5.0.3`）で実施したローカル計測と設定候補の評価です。現在のテスト設定は[`vitest.config.ts`](../../vitest.config.ts)、継続する方針は[テスト戦略](testing.md)をSource of Truthとします。CI実行時間は計測していません。

## 計測条件

- Node.js `v24.21.0`、npm `11.19.0`、`package-lock.json`に基づく`npm ci`の後に実行。
- 同一のmanaged Linux worktree・同一のテストデータ・同一のコマンドを使用。マシンのCPU・メモリ割当は取得できていないため、別環境やCIとの時間比較には使いません。
- ベースラインは`npm test`（Coverage有効）を3回実行。1回目を依存導入後のcold run、続く2回をwarm runとして記録。
- `Duration`はVitestが出力するテスト実行の経過時間です。`environment`などの各項目およびjsdomのtracked timeはworker間の集計で、壁時計時間とは加算・比較しません。

## 変更前のベースライン

| 試行 | 状態 | Duration | Environment内訳 | jsdom生成 |            jsdom tracked time |
| ---- | ---- | -------: | --------------: | --------: | ----------------------------: |
| 1    | cold | 115.74秒 |             53% |     123回 | 161.57秒（tracked timeの53%） |
| 2    | warm | 117.40秒 |             53% |     123回 | 163.62秒（tracked timeの53%） |
| 3    | warm | 111.31秒 |             56% |     123回 | 161.41秒（tracked timeの56%） |

Durationの中央値は`115.74秒`、範囲は`111.31–117.40秒`です。warm 2回の中央値は`114.36秒`で、今回の3試行ではcold / warmに明確な差は見られませんでした。jsdom tracked timeの中央値は`161.57秒`、範囲は`161.41–163.62秒`です。

3回とも123ファイル・1,008テストが成功しました。CoverageはStatements `93.43%`、Branches `90.37%`、Functions `93.43%`、Lines `95.55%`で、各90%のthresholdを満たしました。単独実行した`tests/web/language-switcher.test.tsx`も11件成功しました。

Issue #600のHEAD `0a42b8d`で報告された`npm test`約150秒、jsdom tracked time 218.94秒とは、Node/Vitestの版、実行時点、計測環境が同一であることを確認できません。今回の値との速度比較には使いません。ただし、今回もjsdomの作成がtracked timeの53–56%を占め、主要コストであることは再現しました。

## テストファイル単位のprofile

`npm test -- --reporter=json --outputFile=/tmp/issue-606-vitest-profile.json`による診断runを1回実行しました。JSONの各suiteの`endTime - startTime`と個別assertionの`duration`を確認しています。このrunはJSON reporterを使うため、ベースラインの中央値・範囲には含めません。suite時間にはそのファイルの環境生成・setup・テスト実行が含まれ、純粋なテスト本体の時間とは限りません。

| 遅いsuite                                            | suite経過 | テスト数 |
| ---------------------------------------------------- | --------: | -------: |
| `tests/web/pub-explorer.test.tsx`                    |   13.36秒 |       47 |
| `tests/web/admin-quiz-editor.test.tsx`               |    4.80秒 |       14 |
| `tests/web/admin-content-editor.test.tsx`            |    3.44秒 |       11 |
| `tests/web/mcp-contract.test.ts`                     |    2.52秒 |       38 |
| `tests/web/admin-calendar-date-rule-editor.test.tsx` |    2.40秒 |        4 |

最長の個別testは`tests/web/privacy-page.test.tsx`の1.07秒でした。続いて`tests/verify-pr-ci.test.ts`が1.04秒、`tests/web/admin-quiz-editor.test.tsx`が1.03秒です。suite内の遅い個別testもあわせ、次の調査候補として名前を特定できました。ただしこの1回だけでは安定したボトルネックとは断定せず、最適化のためにassertionを削除しません。

## 候補の比較

| 候補 | 実測・結果 | 判断 |
| --- | --- | --- |
| `pool: "vmThreads"`（per-file isolationを保持） | `npm test -- --pool=vmThreads`はDuration `50.27秒`、1,006/1,008テスト成功。`tests/web/language-switcher.test.tsx`の2件で、`window.location`を再定義できず失敗。 | 見送り。速くなる見込みは大きいものの、現行テストの実行契約を壊す。pool対応のためだけに既存の動作保証テストを弱めたり削除したりしない。Vitestの[性能ガイド](https://vitest.dev/guide/improving-performance)もVM realmにおけるcross-realm挙動とメモリ回収の違いを挙げている。 |
| `pool: "threads", isolate: false` | 全体実行で113件の失敗。DOMがテストファイル間で共有され、既存要素と前テストの状態が残って、role queryの重複などを起こした。 | 見送り。既存suiteはファイル単位のDOM・module isolationを必要とする。cleanup不足の診断として有用だが、安全な高速化候補ではない。 |
| 全テストをjsdomで実行し、既定pool・isolationを維持 | ベースライン3回すべて成功。 | 採用。追加のテスト環境振り分けは、テストのimport依存とDOM利用をファイル単位で確認した上で別途評価する。単純な文字列検索では安全にnode環境へ移せると判定できない。 |

## 結論と制約

jsdom生成が最大のtracked-time構成要素であることを確認しました。一方、現在のsuiteに`vmThreads`を適用すると2件が失敗し、`isolate: false`では113件が失敗するため、今回の設定変更はありません。Coverage対象・thresholdを維持し、テストを削除していません。

測定は同一のmanaged worktree内でのローカル実行のみです。マシン資源の割当を記録できておらず、CIと単純比較できません。また、候補設定の全環境での再現や、他のworker数設定の網羅的ベンチマークまでは行っていません。より安全な高速化を再検討する場合は、個々のtest fileが必要とする環境をimport関係も含めて調べ、分離設定したDOM / Node向けsuiteを候補にします。
