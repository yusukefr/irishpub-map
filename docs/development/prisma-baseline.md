# Prisma Baseline再構築ガイド

## 対象と境界

`migrations/app/`のBaselineはPrisma Contractから生成するApplication Schemaです。現在のBaselineは24 tables、139 columns、60 CHECK constraints、22 foreign keys、55 physical indexesを再現します。`schema_migrations`、Neon管理Schema、店舗・Quiz・Content・Media・Calendar等の運用データは含みません。既存環境の旧migration履歴はそのまま保持します。

Baseline適用は空の専用DBだけで行います。Production Branchへ適用したり、既存ProductionのtableをBaselineで作り直したりしません。`db sign`はschema検証後にPrismaの署名Marker、Snapshot、Refを対象DBへ書き込みます。この操作はread-onlyではないため、Productionでは実行しません。

## Baselineの生成・確認

Node.js 24とlockfileどおりの依存関係を使います。

```bash
npm run prisma:contract:emit
npx prisma migration plan --name baseline
npx prisma migration check
```

`migration plan`はdatabaseへ接続せず、既存Migrationが空のときに現在のContractから初回Baselineを自動生成します。`migrations/app/<timestamp>_baseline/`と`migrations/snapshots/<contract-hash>/`をContractと同じ変更でcommitします。生成先が既にある場合は、同じBaselineを重複生成せず既存Migration graphを確認します。Contract変更後の再生成は新しい差分migrationを作る手順に従います。

生成結果をレビューし、全24 Application table、139 columns、DEFAULT、CHECK、UNIQUE、22 foreign keys、Indexが含まれることを確認します。`schema_migrations`、店舗などの行データ、credentialが含まれていないことも確認します。Prisma 8 RCでPSLに表現できないDESC Indexのsort direction 4件と`quiz_questions_correct_choice_fkey`の`DEFERRABLE INITIALLY DEFERRED`属性は、Contract auditに記録した既知差分です。Migration適用後にPostgreSQL catalogを照合し、足りない物理属性があればBaseline SQL側へ保持します。

## 既存Schemaを持つ隔離検証DB

Production Schemaを比較する場合は、Productionからデータを含めずSchemaだけ複製した、または同じSchemaを構築した隔離DBを使います。Branch名、Branch ID、ready状態を確認し、固定PreviewやProductionを検証先として流用しません。

1. Contractをemitする。
2. 隔離DBの現在Schemaを確認し、Contractと一致することを確認する。
3. 接続先を明示して`prisma db sign --db "$DATABASE_URL"`を実行する。
4. `prisma db verify --db "$DATABASE_URL"`と`prisma migration status --db "$DATABASE_URL"`で署名・Schema・Migration stateを確認する。

Signが失敗した場合はdriftを調べ、Signで不一致を覆い隠しません。Prismaが作る管理Marker/Ledgerは旧`schema_migrations`と別物です。旧LedgerをPrisma Contractへ加えたり、Baselineで再作成・初期化したりしません。

## 空DBの再構築

Production dataを含まない空の新規DBを用意し、BranchとDBの名前・ID・状態を確認してから次を実行します。

```bash
npx prisma migration status --db "$DATABASE_URL"
npx prisma db migrate --db "$DATABASE_URL"
npx prisma migration status --db "$DATABASE_URL"
npx prisma db verify --db "$DATABASE_URL"
```

接続URIはCLI引数へ直接書かず、Secret Injectionされた環境変数を使います。ログ・Issue・PRへ値を記録しません。`db migrate`は空DBにBaselineを適用するためのものです。既存Schemaには使わず、既存Schemaは前節のSignで採用します。

Baselineの適用後、空DBに対して`db/prisma/seed-reference-data.sql`をpsqlで1回実行し、Applicationが必要とする参照データを投入します。このscriptは業務データがすでに存在するとtransactionを中止します。日本語自治体名がないため、`data/市区町村コード.csv`が別途必要です。ファイルはRepositoryへ含めず、[総務省の全国地方公共団体コード](https://www.soumu.go.jp/denshijiti/code.html)から取得した6桁コード、都道府県・市区町村名、半角カナを使い、次の7列のUTF-8 CSVへ整形します。都道府県コードと名称は既存の[003 migration](../../db/migrations/003_municipality_codes_up.sql)が使うレイアウトと同じです。

```text
code,prefecture_name,municipality_name,prefecture_kana,municipality_kana,unused_column_1,unused_column_2
```

余分な2列は空値で構いません。コードは6桁の文字列として扱います。Scriptは47都道府県と翻訳、自治体コードと日本語翻訳、Pub Statusと日本語・英語表記、Pub Typeと日本語・英語表記を投入します。英語の自治体翻訳がない場合は現在のlocale fallbackが日本語名を使います。Productionから店舗・Quiz・Contentなどの運用データを複製しません。自治体コードデータを更新するときは、取得時点と差分をレビューしてから新しい空DB seedへ使います。

## Schema照合

既存Schemaの署名DBと空DBの両方で、PostgreSQL catalogから次を比較します。

- table、column、型、NULL可否、DEFAULT
- primary / unique / foreign key、delete action、遅延可能属性
- CHECK constraintの名前と式
- Indexの名前、列、並び方向、部分predicate

空DBは`schema_migrations`がなくても正常です。既存DBの旧Ledger行数や値を空DBへ移植せず、運用データも移しません。Catalog差分をすべて解決してからBaselineの再現検証を完了とし、結果はIssue/PRへ件数と差分の有無だけ記録します。

## 関連文書

- [Prisma tooling](prisma-tooling.md)
- [Prisma Contract audit](prisma-contract-audit.md)
- [Prisma Baseline migration inventory](prisma-baseline-inventory.md)
- [Neon migration Runbook](../runbooks/neon-migrations.md)
