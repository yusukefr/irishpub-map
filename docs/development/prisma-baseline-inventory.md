# Prisma Baseline移行前のNeon / Migration棚卸し

この文書はIssue #635の2026-10-13時点の読み取り専用調査結果です。Branch状態と履歴は変化するため、Baseline作成時にNeonの現況を再確認してください。Productionの実データ、接続情報、認証情報は記録しません。

## 調査結果

### Neon Branch

Repository設定のProject IDを指定してBranch一覧を取得し、各対象の`schema_migrations`とProduction `main`との差分Schemaを読み取りました。

| Branch | 状態 | Migration履歴とSchema |
| --- | --- | --- |
| `main`（Production） | ready / default | 006〜025を連続して記録。 |
| `preview`（固定Preview） | ready（2026-10-13 23:18 JST確認） | 006〜016、019〜024を記録。017、018、025が欠落。ProductionとのSchema差分があり、automation tablesがなく、Quiz ID関連列が`text`。 |
| `preview/ai/664-admin-form-consistency` | ready | 006〜025を記録。Productionとの差分Schemaなし。対応PR #687はマージ済み。 |
| `preview/ai/public-pub-api-client` | ready | 006〜025を記録。Productionとの差分Schemaなし。対応PR #686はOpen。 |

固定PreviewはProduction相当のBaseline検証先として扱えません。Neon Authの`jwks`にもProductionとの差分がありましたが、これは`public`のApplication Schema外であり、Baseline対象へ含めません。

Productionの`public` Schemaには24のApplication Tableと、旧`schema_migrations` Ledgerがあります。Neon AuthなどPlatform管理SchemaはApplication Baselineから除外します。Productionでprefectures、municipalities、pub statuses、pub typesとその翻訳の必須Masterを確認し、整合チェックは成功しました。個別データや件数は記録していません。

現行の`docs/generated/database-schema.md`はPR #588で025適用後のProduction Schemaから生成されました。その後のmainマージにSchema変更はありません。現行PR専用Branch 2つもProductionと同じSchemaでした。CLI経由の生成チェックはこの環境では完了できていないため、Baseline作成前に再実行してください。

### Migration 001〜025

`schema_migrations`は006で作成され、Ledger記録は006から始まります。したがって001〜005に履歴行がないことだけでは未適用とは判断できません。Productionの後続Schemaはこれらの正規化後状態を含みますが、旧up SQLが作った一時的な退避テーブルは残っていません。

| Migration | up / verifyの状態 | down / 整理判断 |
| --- | --- | --- |
| 001〜005 | Ledger開始前。最終Schemaから適用後状態は確認できるが、適用記録はなく実行時期・実行証拠は不明。Baseline前の復元・再構築依存として保護する。 | downは001〜005のみ。001 / 002 / 005のdownが要求する旧バックアップはProductionにない。004 downは旧`tags.name`形式を要求し、現在のSchemaと合わない。003 downは市区町村マスタを削除する。どれも現在のrollback手順として実行不可。新管理方式の復元手順が固まるまでは削除しない。 |
| 006〜007 | Production、固定Preview、両PR Branchに記録あり。#589の完了記録では、2026-10-10にProductionとPreviewへ履歴行を後追い登録済み。`applied_at`は補正時刻であり、当時SQLを実行した証拠ではない。 | upの再実行は禁止。`scripts/run-localization-migration.mjs`が006 / 007 SQLと履歴を参照するため、Runnerの移行・テスト更新後に削除候補。 |
| 008〜016 | 全対象Branchで記録あり。 | downなし。新Baseline・検証完了後、Runner / tests / docsの切替と同時に削除候補。 |
| 017〜018 | Productionと両PR Branchで記録あり。固定Previewでは履歴と該当Schema変更の両方が不足。 | downなし。固定Preview差分の扱いが決まる前に削除しない。 |
| 019〜024 | 全対象Branchで記録あり。 | downなし。新Baseline・検証完了後、Runner / tests / docsの切替と同時に削除候補。 |
| 025 | Productionと両PR Branchで記録あり。固定Previewでは履歴とSchema変更が不足。 | downなし。Production/Previewの差を解消・記録するまでは削除しない。 |

001〜005のdown SQLを含め、現行Productionのrollback手段として使える`down.sql`はありません。退避オブジェクトがないうえ、003のdownは稼働中のマスタを削除します。旧SQLを一括削除できるのは、Baseline再現・差分Migration・復旧手順を隔離Branchで検証し、旧Runner依存を同じ変更で移行した後です。

### Repository上の依存

- `scripts/check-neon-preflight.mjs`は`db/migrations/*_up.sql`を列挙し、`schema_migrations`を読み取り専用で照合します。現在は006〜025を依存前提とします。
- `scripts/run-neon-migration.mjs`がup / verify SQLの実行経路です。Production Target Guardを保持します。
- `scripts/run-localization-migration.mjs`は006 / 007のファイルとLedgerに直接依存します。
- `tests/migrations.test.ts`、`tests/calendar-migrations.test.ts`、`tests/check-neon-preflight.test.ts`、`tests/run-neon-migration.test.ts`、`tests/run-localization-migration.test.ts`が旧方式を検証します。
- CI WorkflowからMigration適用・Preflightを呼ぶ参照はありません。MigrationはDeployment時に自動適用されません。
- `docs/runbooks/neon-migrations.md`と`docs/generated/database-schema.md`は旧Runner / 現行Schemaの運用境界を説明します。切替時に更新し、生成SchemaはProductionから再生成します。

Preflightコマンドは実行を試みましたが、Node subprocessを起動する環境で`bwrap: Can't mkdir /var/cache/.git`となり結果を得られませんでした。Branch名・状態はProject指定Branch一覧、履歴は各Branchのread-only SELECTで確認しています。DBへの変更はありません。

## Baselineの範囲と判断

- Baseline Contractの対象はProduction `public`にあるApplication Schemaです。旧`schema_migrations`は履歴・運用資産として保持し、Prisma管理対象、Baseline再作成対象、初期化対象にしません。
- 必須Masterの初期化手順は、prefecture、municipality、pub status、pub typeと翻訳を再現可能にする必要があります。店舗、Quiz、Content、監査、Idempotencyなどの運用データはBaselineやseedへ含めません。
- `Target Resolver`、Production誤操作Guard、機密値を出力しない接続ログは、管理責務を移した後も維持します。
- 006 / 007の欠落原因は#589で未確定です。履歴の後追い登録をMigration実行の証拠として扱わず、再補正もしません。

**GO:** Production Schemaと一致するContract / Baselineのドラフトを作り、Productionから隔離した検証Branchでの検証計画へ進む。

**NO-GO:** 現時点で旧001〜025の一括削除、Prismaによる`schema_migrations`の管理・削除、Productionへの`db sign` / Migration切替を行う。固定Previewはreadyですが、017 / 018 / 025の履歴欠落とProductionとのSchema差分があるため、現状のままBaseline検証先にはできません。空DB再現、既存隔離Branchへのsign / verify、必要Masterの再現、差分Migration、復旧手順を確認し、Production作業は別途明示承認を得てから判断します。

## 再確認が必要な項目

1. Baselineを作る直前にProductionと利用中PR Branch一覧、履歴、Schema差分を再取得する。
2. `npm run db:preflight -- --target production --required-migration 025_convert_automation_resource_ids_to_uuid`と`npm run check:database-schema`を、Neon CLIが起動できる環境で実行する。
3. 固定Previewを今後使う場合はBranch復元や置換を自動実行せず、Preview Targetをどうするか別途決める。PR Branchを固定Previewの代わりに扱わない。
4. Prisma ContractでPostgres CHECK / FK / Index / DEFAULTを保持し、Production参照Schemaとの完全性を検証する。
