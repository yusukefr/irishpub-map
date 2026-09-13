# Visual Regressionを更新する

## Purpose

PlaywrightのVisual Regressionで比較するReference Screenshotを、意図したPublic UI変更に合わせて更新します。基準画像は[Reference Screens](../design/reference/README.md)のSource of Truthです。

## When to use

- Public UIの構成、情報階層、responsive behaviorを意図して変更したとき
- CIのVisual Regression差分をレビューし、変更が正しいと確認できたとき

通常のE2E実行やUIに関係しない変更ではsnapshotを更新しません。

## Prerequisites

- Issue Requirement、対象Pattern、Component、Reference Screenを確認済みである。
- Desktop / Mobile、日本語 / 英語、focus、overlay、横overflowへの影響を把握している。
- Dockerが利用可能であり、CIと同じPlaywright imageを使用できる。

## Procedure

通常のVisual RegressionとAccessibilityを含むE2Eは次で実行します。

```bash
npm run test:e2e
```

意図したUI差分だけを基準画像へ反映する場合は、CIと同じcontainerで対象specを実行します。

```bash
docker run --rm --ipc=host --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work \
  mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e \
  bash -lc "npm ci && npx playwright test e2e/visual-regression.spec.ts --update-snapshots"
```

## Validation

1. 更新された画像とGit diffを確認し、意図した画面・locale・viewportだけが変わっていることを確認する。
2. `npm run test:e2e`を実行し、Visual Regression、Accessibility、通常E2Eが成功することを確認する。
3. BrowserでもKeyboard操作、visible focus、主要導線、横overflow、console errorを確認する。
4. PR本文へ、更新したReference Screenと更新理由を記載する。

## Security notes

- snapshot、HTML report、trace、screenshotにPreview URL、account、email、token、非公開店舗データを含めない。
- `DATABASE_URL`はE2Eで使用しない。E2Eは`E2E_TEST_MODE=1`の固定fixtureで実行される。
- 意図しない差分を`--update-snapshots`で受け入れない。

## Related docs

- [ローカル開発の開始](../setup/development.md)
- [E2E Reference Screens](../design/reference/README.md)
- [Design System](../design/README.md)
