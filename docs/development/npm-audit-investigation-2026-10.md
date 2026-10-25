# npm依存のセキュリティ調査（2026-10）

この記録はIssue #693の調査結果です。npm advisoryは更新されるため、件数と判定は記録時点のものです。Releaseや依存更新の判断では、現在のlockfileとadvisoryを再確認してください。

## 調査条件

- 調査日: 2026-10-25
- 基準: PR #717後の `package.json` / `package-lock.json`
- Node.js: 24.21.0（`.nvmrc` と一致。環境に `nvm` はなく、同じNode majorを使用）
- npm: 11.19.0
- 変更前の `npm audit --json`: 22件（High 10 / Moderate 10 / Low 2）
- 修正後のルート `npm audit --json`: 20件（High 10 / Moderate 10 / Low 0）
- 修正後の `npm audit --omit=dev`: High 8件

2026-10-17に記録された71件とは、lockfile、Node/npm、Expo SDKが異なるため件数を直接比較しません。今回の修正では、ルートと独立lockfileを持つ `tools/docs-check` の開発依存Mermaidを12.1.0から12.2.0へ更新しました。ルートlockfileでは `katex` が0.16.47から0.18.10へ更新され、Low 2件を解消しました。`tools/docs-check` のlockfileも `npm ci --prefix tools/docs-check --ignore-scripts` 後に2件のLowを報告しましたが、同じ12.2.0への更新後は `npm install --prefix tools/docs-check --package-lock-only --ignore-scripts` の自動監査で0件でした。SDKやWeb実行依存の強制更新はしていません。

`npm audit --omit=dev` は8件のHighを報告します。npmは `apps/mobile` の `expo` をproduction dependencyとして扱うため、この結果にはExpo CLI・署名証明書検証のbuild toolingも含まれます。したがって「Webサーバーのproduction依存だけが8件脆弱」という意味ではありません。

## 依存経路と影響

| 対象・advisory | 依存経路 / workspace | 実行時の分類と影響条件 | 判断 |
| --- | --- | --- | --- |
| `node-forge` — GHSA-86w9-cpqp-85rv（High） | `apps/mobile` の `expo` → `@expo/cli` → `@expo/code-signing-certificates` → `node-forge@1.4.0` | Expo CLI / 証明書検証のbuild tooling。MobileのJavaScript runtime bundleで使う経路ではありません。影響には脆弱なRSA PKCS#1 v1.5検証へ攻撃者が細工した署名データを渡す条件が必要です。 | Advisoryにpatched versionがありません。Expo SDK 58互換の修正経路も確認できず、overrideを追加しません。ExpoのSDK更新時に再評価します。 |
| `zod` — GHSA-mrhx-c7xc-m3w5（High） | Expo CLI側の `expo/node_modules/zod@3.25.76`、およびWeb側の `@vercel/blob` → `@vercel/oidc` → `@vercel/cli-config` → `zod@4.1.11` | 脆弱性は制約のないArray schemaへ大きな不正配列を検証させ、メモリを消費させる場合に発生します。Expo側はCLI toolingです。Vercel経路はWebのproduction dependency木に入りますが、`@vercel/cli-config`の設定処理へ外部利用者が任意配列を渡せる経路は今回確認できませんでした。 | 修正済みZod 4.6.6はアプリ直依存で利用中ですが、`@vercel/cli-config`はZod 4.1.11を固定し、Expo側はZod 3系です。広域overrideは互換性を確認できないため行いません。上流の依存更新を待ち、依存経路または外部入力処理の変更時に再評価します。 |
| `@vercel/blob` / `@vercel/oidc` / `@vercel/cli-config`（Highの推移依存経路） | `apps/web` の直接依存 `@vercel/blob@2.8.1` → `@vercel/oidc@3.8.9` → `@vercel/cli-config@0.3.0` → 脆弱なZod | Web server production dependency木に含まれます。今回報告された脆弱性の根はZodの入力検証です。npmの提案は `@vercel/blob@2.4.0` への降格で、現行 `^2.8.1` の互換更新ではありません。 | Blobの降格やZodの強制overrideは採用しません。上流が修正版を公開したら通常の互換更新を優先します。 |
| `hono`、`lodash` とPrisma関連依存（High / Moderate） | ルートの開発依存 `@prisma/orm-postgres` / Prisma 8 RC tooling → `@prisma/dev` / `@prisma/composer` / `hono`、`lodash`、`valibot`、Chevrotain関連 | Prisma CLI・開発時のschema toolingに限られ、Web / Mobile runtime dependencyではありません。`hono` の報告には複数のadvisoryが含まれます。悪用には脆弱なHono機能やlodash APIへ細工された値を渡す必要があります。 | npmの一括修正案はPrisma 7.10.1へのMajor downgradeです。Prisma 8 RCの利用を壊すため適用しません。上流修正またはPrisma正式版への移行時に再評価します。 |
| Mermaid / KaTeX（Low、修正済み） | ルートの開発依存 `mermaid@12.1.0` → `katex@0.16.47` | 文書図の開発・検証用です。Web / Mobile runtimeには入りません。 | `mermaid@12.2.0` へ更新し、依存経路上の `katex@0.18.10` によりLow 2件を解消しました。 |

全依存監査で、Highの推移依存は `hono@<=4.13.6` と `lodash@<=4.17.23` も含みます。Honoは複数のadvisoryが同一package entryに集約されています。LodashはGHSA-r5fr-rjxr-66jc、GHSA-f23m-r3pf-42rh、GHSA-xxjr-mmjv-4gpgの対象範囲です。

Moderateの推移依存package entryは、`@chevrotain/cst-dts-gen@10.0.0–10.5.0`、`@chevrotain/gast@<=10.5.0`、`chevrotain@10.0.0–10.5.0`、`@mrleebo/prisma-ast@0.4.2–0.13.1`、`@prisma/composer@>=0.7.0`、`@prisma/composer-cli`、`@prisma/dev@<=0.24.16`、`alchemy@2.0.0-beta.1–beta.83`、`prisma@8.0.0-rc.3–8.0.0-rc.9-dev.79`、`valibot@<=1.4.1`です。いずれもルートの `@prisma/orm-postgres` / Prisma開発toolingから推移的に入ります。ルートlockfileの直接依存は `prisma@8.0.0-rc.22` で、監査報告に示されたPrismaの影響範囲外です。実際の導入ノードを `npm ci` 後に確認できなかったため、Prisma package entryの適用有無は未確定として残します。監査結果の一括修正候補はPrisma 7.10.1で、現行のPrisma 8 RCからMajor downgradeとなるため採用しません。

直接依存は `apps/mobile` の `expo@58.0.19`、`apps/web` の `@vercel/blob@2.8.1`、ルート開発依存の `prisma@8.0.0-rc.22` と `mermaid@12.2.0` です。`tools/docs-check` も `mermaid@12.2.0` を独立した開発依存として使用します。表中のその他の脆弱packageは推移依存です。npmの監査報告は影響packageごとの範囲と修正候補を示しますが、同一advisoryが複数経路に現れる場合は別packageの独立した脆弱性として合算しません。

監査件数は脆弱なパッケージ名や独立した脆弱性の個数と一致しません。たとえば同じadvisoryが複数のExpo / Vercel経路に現れ、Honoの1パッケージには複数のadvisoryがあります。advisoryと導入経路を単位に評価します。

## install scripts

現行lockfileの `hasInstallScript` は次の6エントリーです。

| Package | lockfileの役割 | 判断 |
| --- | --- | --- |
| `agent-browser@0.36.0` | Browser automation CLI。postinstall hookあり | 開発・browser automation専用。hookがGitHub Releaseからplatform binaryを取得するため、npm registryのtarball integrityだけでは取得binaryの出所を検証しません。CIで不要な場合は許可しません。 |
| `esbuild@0.28.2` | Build用bundler。postinstall hookあり | 対応platform用native binaryを選択するhookです。 |
| `neon/node_modules/esbuild@0.28.1` | Neon CLI配下のBuild用bundler | 上と同種のnative binary選択hookです。 |
| `unrs-resolver@1.12.2` | ESLint resolver。postinstall hookあり | N-API native bindingを選択するhookです。 |
| `workerd@1.20260901.1` | Cloudflare Workers runtime tooling | platform runtime binaryを用意するhookです。 |
| `fsevents@2.3.3` | macOS向けoptional dependency | macOSのみ対象のoptional hookです。現在のUbuntu環境では実行対象外です。 |

`package-lock.json` と各packageの `scripts` metadataでinstall hookの存在を確認しました。`npm install-scripts ls` は実行を試みましたが、このmanaged環境ではsandboxのcache用Git directory初期化時に権限エラーとなり、allowlistの実状態を取得できませんでした。npmの警告を抑えるためにscript許可を一括変更していません。CIで install script を許可する場合は、platformごとの必要性を確認した上で対象を限定してください。

script metadataはlockfileの各package versionに対応するupstream package manifestと照合しました。`agent-browser@0.36.0`のhookはGitHub Releaseから実行binaryを別途取得し、`esbuild`と`unrs-resolver`のhookはplatform用native bindingを選択します。

## 残余リスクと再評価

- Expo SDK 58の依存 `node-forge@1.4.0` とExpo CLI側Zod 3系は、修正版またはSDK互換の更新が利用可能になった時点で再評価します。Native公開前には、Build環境が未信頼の署名データやschema入力を処理するかを確認してください。
- WebのVercel OIDC / Blob経路はproduction依存木にあります。上流修正版がない間、外部要求から `@vercel/cli-config` のZod parserへ制約なし配列が渡る経路が追加されていないか、依存や認証構成の更新時に確認します。
- Prisma 8 RCの開発toolingには複数のHigh / Moderate advisoryが残ります。Production bundleから分離されていますが、CI / 開発者端末で信頼できないschemaまたは設定を処理する前に再評価します。
- この記録はnpm advisoryとlockfile上の導入経路の調査です。Android実機、iOS、EAS cloud buildでの検証は行っていません。EAS実行にはユーザーの今回限りの明示承認が別途必要です。
