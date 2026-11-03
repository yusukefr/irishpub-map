# Prisma Contract schema照合記録

この文書はIssue #637のContract確認記録です。Neon Productionの`main` Branchに対する読み取り専用Schema introspection結果を、2026-10-17時点の[生成済みSchema](../generated/database-schema.md)および固定版Prisma 8 RCのContract artifactと照合しました。Neon MCPの`describe_table_schema`を全Application tableに実行し、`preview/ai/issue-636`との差分Schemaも確認しました（差分なし）。2026-10-25にはProductionを変更せず、期限付きschema-only Branchで`db sign`、`db verify`、`migration status`を確認し、別の空DBへBaselineを適用して再度`db verify`しました。

## 対象範囲と再現方針

- Prisma Contract対象はProduction `public`内の24 Application tableです。Neon AuthなどPlatform管理Schemaは除外します。
- 旧`schema_migrations`は旧Migration履歴として保持し、Contract、Baseline、初期化処理へ含めません。
- CLIの`contract infer`は`--db <url>`を必須とします。Repositoryの[Prisma tooling方針](prisma-tooling.md)はProduction資格情報を一般のPrisma CLIへ渡すことを禁じています。従ってこの作業では、Project IDとProduction Branch IDを明示したNeon MCP読み取り専用introspectionを使ってContractを作成し、その後固定CLIの`contract emit`で検証しました。inferのProduction CLI実行はしていません。
- `generated/prisma8/contract.json` と`contract.d.ts`はContractとともにGit管理します。再生成は`npm run prisma:contract:emit`で行い、差分をレビューできます。生成物は編集しません。

## テーブル・制約の照合

Neon introspectionとemit artifactで合計数が一致しています。各テーブルの数は次のとおりです（Index数はPostgresのPK / UNIQUE Indexを含む物理Index数）。

| Table                         | Columns |     PK | UNIQUE |     FK |  CHECK |  Index |
| ----------------------------- | ------: | -----: | -----: | -----: | -----: | -----: |
| `automation_audit_logs`       |      11 |      1 |      0 |      0 |      4 |      4 |
| `automation_idempotency_keys` |      12 |      1 |      1 |      0 |      3 |      3 |
| `calendar_event_translations` |       5 |      1 |      0 |      1 |      1 |      1 |
| `calendar_events`             |      11 |      1 |      0 |      0 |      3 |      5 |
| `content_entries`             |       9 |      1 |      1 |      1 |      5 |      3 |
| `content_translations`        |       8 |      1 |      0 |      1 |      3 |      1 |
| `media_assets`                |       8 |      1 |      2 |      0 |      7 |      4 |
| `municipality_codes`          |       2 |      1 |      0 |      1 |      1 |      1 |
| `municipality_translations`   |       4 |      1 |      0 |      1 |      3 |      1 |
| `prefecture_translations`     |       4 |      1 |      1 |      1 |      3 |      2 |
| `prefectures`                 |       1 |      1 |      0 |      0 |      1 |      1 |
| `pub_status_translations`     |       3 |      1 |      0 |      1 |      2 |      1 |
| `pub_statuses`                |       2 |      1 |      1 |      0 |      0 |      2 |
| `pub_tags`                    |       2 |      1 |      0 |      2 |      0 |      2 |
| `pub_translations`            |       6 |      1 |      0 |      1 |      4 |      1 |
| `pub_type_translations`       |       3 |      1 |      0 |      1 |      2 |      1 |
| `pub_types`                   |       2 |      1 |      1 |      0 |      1 |      2 |
| `pubs`                        |      12 |      1 |      0 |      4 |      5 |      5 |
| `quiz_choice_translations`    |       5 |      1 |      0 |      1 |      1 |      1 |
| `quiz_choices`                |       5 |      1 |      1 |      1 |      2 |      2 |
| `quiz_question_translations`  |       8 |      1 |      0 |      1 |      3 |      1 |
| `quiz_questions`              |      11 |      1 |      0 |      3 |      4 |      7 |
| `tag_translations`            |       3 |      1 |      1 |      1 |      2 |      2 |
| `tags`                        |       2 |      1 |      1 |      0 |      0 |      2 |
| **合計**                      | **139** | **24** | **10** | **22** | **60** | **55** |

Contract artifactは24 table / 139 columns / 24 PK / 10 UNIQUE / 22 FK / 60 CHECK / 55 Indexです。 `contract emit`は既存DB接続を行わないため、Artifact生成自体は成功しますが、CHECK 60件と部分Index 7件には`PN_EXACT_NAME_BODY_COMPARISON`警告が出ます。これは`map:`名とSQL本文の完全一致をPostgres再表示と比較できるのが`contract infer`で取得した本文に限られる、というRCの警告です。現状のMCP introspection本文は照合記録として残しますが、`db verify` / `db sign`やmigration planningで差分なしと確定する前に、隔離環境で本文の比較・再現が必要です。全テーブル、列名、型、NULL可否、DEFAULT、PK / UNIQUE / FK / CHECKの名前、およびIndexの列・部分predicateを読み取りSchemaと照合しました。UUID列にDB defaultはなく、既存DB defaultsはContractに反映されています。

## 表現差分・後続への引継ぎ

| Neon物理Schema | Contractでの扱い | 次の対応 |
| --- | --- | --- |
| `automation_audit_logs_created_at_idx`, `calendar_events_admin_list_idx`, `media_assets_admin_list_idx`, `quiz_questions_admin_list_idx`のDESC列順 | 各Indexと列は保持。Prisma 8 RC.17の`@@index` PSL parserでDESC sort記法が拒否されるため順序方向はContract artifactに保持されていない。 | Baselineの`rawSql` operationでProductionと同じDESC定義を作成し、`pg_get_indexdef` postcheckと空DBのCatalog照合で確認済み。Contractで表現可能になるまでは、これらのIndexを含むMigrationでは属性を手動維持する。 |
| `quiz_questions_correct_choice_fkey`の`DEFERRABLE INITIALLY DEFERRED` | FKと列・参照先・名前は保持。遅延可能属性はPSL Relationで宣言できない。 | Baselineの`rawSql` operationで遅延属性を作成し、`pg_constraint` postcheckとQuestion→Choiceのtransaction試験で確認済み。Contractで表現可能になるまでは、当該FKを含むMigrationで属性を手動維持する。 |
| 7つの部分Index | 全て`where` predicateをContractへ保持。 | Baseline emit / migration planningで定義差分がないことを別Issueで検証する。 |
| CHECK 60件 | 60件全て名前・式をContractへ保持。 | Baseline SQL比較でPostgresが再表示する式と照合する。 |
| `schema_migrations`旧Ledger | 意図的にContract対象外。現在のテーブル・行は変更しない。 | 維持する。Baselineから再作成しない。 |
| `public.show_db_tree()` | Neon作成のSchema閲覧補助関数でApplication Contract対象外。 | 既存環境に保持し、空DB Baselineでは再現対象にしない。 |

Expression Indexはありません。Productionの現在Schema・履歴・データは変更していません。隔離Sign DBとBaseline適用後の空DBはContractに一致し、特殊な4 Indexと遅延FKの定義もProductionと一致しました。Productionへの`db sign`・migration・Contract marker書込みは行いません。
