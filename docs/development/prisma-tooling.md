# Prisma 8 RC tooling

## 目的と境界

Prisma ORM 8 RCはSchema ContractとMigrationを扱う開発ツールとして導入しています。現行のNeon SQL Repository、`@neondatabase/serverless`によるApplication接続、CRUD経路は変更しません。Prisma ClientをApplicationから使う作業やMigration所有権の切替は別Issueで扱います。

Prisma 8 RCは互換性を保証する正式版ではありません。2026-10-13時点で確認したCLI `prisma@8.0.0-rc.22` とPostgreSQL package `@prisma/orm-postgres@8.0.0-rc.17` は別々に版が進むため、`package.json`とlockfileの両方で個別に完全固定します。CLIのNode.js要件は`>=22.18.0`で、このRepositoryが固定するNode.js 24系を満たします。正式版への更新は別タスクとし、設定API、Contract構文、CLI command、生成物、Neon接続を改めて検証します。

## 配置

- `prisma.config.ts`: Prisma 8設定。Contract、出力先、任意の`DATABASE_URL`を定義します。
- `db/prisma/contract.prisma`: Prisma 8形式のContract。Productionの現行Schema推論・制約照合は後続Issueで行います。
- `generated/prisma8/`: `contract emit`が生成するContract artifactと型の出力先。

## コマンド

```bash
npm run prisma:version
npm run prisma:help
npm run prisma:contract:emit
```

コマンドの引数や動作は、lockfileで固定したCLIのhelpと実行結果を正とします。設定読込と`contract emit`はローカルファイルだけを扱い、DBへ接続しません。

## Neon接続

Configは`DATABASE_URL`を任意で読みます。未設定でも設定読込とDB非接続コマンドを実行できます。DBへ接続するPrisma操作を追加する場合は、固定Preview / Production Targetを`config/neon-targets.json`と既存Neon Target Resolverで厳密に解決し、直接接続文字列をプロセス環境へ渡してください。Productionへの書込みは既存のProduction Guardと明示承認を維持します。接続文字列はCLI引数、ログ、Git管理ファイルへ出しません。Prisma 8 RCに対するDB操作を追加する前に、対象バージョンのCLI仕様と操作の副作用を確認してください。
