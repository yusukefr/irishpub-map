# Reference Screens

Playwright E2E visual regression snapshotを、Public UIの構成、密度、情報階層、ブランド表現を確認するReference Screenshotの唯一のSource of Truthとします。Pixel単位で古い画像へ実装を戻すためのものではありません。

| Route / viewport | Source snapshot |
| --- | --- |
| Map、日本語、1440×900 | [snapshot](../../../e2e/visual-regression.spec.ts-snapshots/map-desktop-ja-chromium-linux.png) |
| Map、日本語、390×844 | [snapshot](../../../e2e/visual-regression.spec.ts-snapshots/map-mobile-ja-chromium-linux.png) |
| Discover、日本語、1440×900 | [snapshot](../../../e2e/visual-regression.spec.ts-snapshots/discover-desktop-ja-chromium-linux.png) |
| Discover、日本語、390×844 | [snapshot](../../../e2e/visual-regression.spec.ts-snapshots/discover-mobile-ja-chromium-linux.png) |

外部Map tileは変動を避けるため、Visual Regressionと同じmock styleを使っています。表示する店舗はE2E専用の公開可能なfixtureであり、本番DBの内容やPreview URLを含みません。

## Priority

競合時は次の順序で判断します。

```text
Current Product Requirement
  → Current Design Documentation
  → Current Design Tokens / Components
  → Reference Screen
```

現行BehaviorをDesignだけで暗黙に変更しません。Reference Screenが古い場合は画像を更新します。

## Update workflow

1. UI変更のRequirementとDesign Systemへの影響を確認する。
2. CIと同じPlaywright version / containerで関係するVisual Regressionを実行し、差分をレビューする。
3. 意図した差分だけを`--update-snapshots`でE2E基準画像へ反映する。
4. Desktop / Mobile、日本語 / 英語の画面、横overflow、Focus、overlay、console errorを確認する。
5. 画像にPreview URL、環境情報、account、email、token、非公開店舗データがないことを確認する。
6. このREADMEから参照するsnapshotとRepository内linkを確認する。

画面の一部だけが変わった場合は、影響するReference Screenだけを更新します。実装と大きく異なる画像を放置しません。
