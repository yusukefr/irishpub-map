# Prisma 8 RC tooling

## 目的と境界

Prisma ORM 8 RCはSchema ContractとMigrationを扱う開発ツールとして導入しています。現行のNeon SQL Repository、`@neondatabase/serverless`によるApplication接続、CRUD経路は変更しません。Prisma ClientをApplicationから使う作業やMigration所有権の切替は別Issueで扱います。

Prisma 8 RCは互換性を保証する正式版ではありません。2026-10-13時点で確認したCLI `prisma@8.0.0-rc.22` とPostgreSQL package `@prisma/orm-postgres@8.0.0-rc.17` は別々に版が進むため、`package.json`とlockfileの両方で個別に完全固定します。CLIのNode.js要件は`>=22.18.0`で、このRepositoryが固定するNode.js 24系を満たします。正式版への更新は別タスクとし、設定API、Contract構文、CLI command、生成物、Neon接続を改めて検証します。

## 配置

- `prisma.config.ts`: Prisma 8設定。Contractと出力先を定義します。意図的に既定DB接続先を設定しません。
- `db/prisma/contract.prisma`: Prisma 8形式のContract。Productionの現行Schemaとの照合は[Contract audit](prisma-contract-audit.md)に記録しています。
- `generated/prisma8/`: `contract emit`が生成するContract artifactと型の出力先。

Contractと `generated/prisma8/contract.json` / `contract.d.ts` はGit管理し、Contract変更と同じPRで再生成・差分レビューします。現行Productionとの照合と表現差分は[Prisma Contract schema照合記録](prisma-contract-audit.md)を参照してください。

## コマンド

```bash
npm run prisma:version
npm run prisma:help
npm run prisma:contract:emit
```

コマンドの引数や動作は、lockfileで固定したCLIのhelpと実行結果を正とします。設定読込と`contract emit`はローカルファイルだけを扱い、DBへ接続しません。

## Neon接続

この設定では`db.connection`を設定しません。`contract emit`はDBへ接続しませんが、DBを使うPrisma CLIコマンドには既定の接続先がありません。Prisma CLIは`--db`で任意の接続先を明示できるため、本Repositoryでは直接CLIへProduction接続情報を与えてDBコマンドを実行しないでください。Production認証情報は開発者の一般シェルや直接起動するCLIへ配布しません。

後続IssueでDB操作を追加する場合は、標準実行経路が`config/neon-targets.json`と既存`resolveNeonTarget()`によりTarget・Branch状態・直接接続を確認し、ProductionにはProduction Guardと明示承認を適用する必要があります。Production認証情報を一般のPrisma CLIから使えないよう権限・credentialの配置範囲も設計します。接続文字列はCLI引数、ログ、Git管理ファイルへ出しません。Prisma 8 RCに対するDB操作を追加する前に、対象バージョンのCLI仕様と操作の副作用を確認してください。詳しくは[Prisma CLI設定](https://www.prisma.io/docs/cli/configuration)を参照してください。
