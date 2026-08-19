# 店舗テーブル移行手順

## 対象

この手順は、旧 `pubs(id TEXT, data JSONB, updated_at TIMESTAMPTZ)` 構成を現行の正規化スキーマへ移行する場合に使用します。新規の空DBは[店舗データの一括インポート](../setup/development.md#店舗データの一括インポート)で準備してください。

PreviewとProductionは別々の対象として扱います。本番データを変更するため、接続先、メンテナンス時間、アプリの書き込み停止を確認してから実行します。移行SQLは旧テーブルや対応表をバックアップとして保持しますが、Neon側のスナップショット／バックアップも事前に取得してください。

## 実行方法

001、002、004、005と各verify SQLは `@neondatabase/serverless` のNode `Client` で実行します。接続文字列は `MIGRATION_DATABASE_URL` からだけ読み込み、スクリプトは値を出力しません。

```bash
export MIGRATION_DATABASE_URL='対象環境から安全に取得した接続文字列'
```

003だけは `data/市区町村コード.csv` をクライアント側の `\\copy` で読み込むため、リポジトリルートから `psql` を使用します。003以外の移行に `psql` は不要です。実行後はシェルから接続文字列を破棄し、値を履歴・ログ・ドキュメントへ残しません。

## 実行前確認

1. Neon Consoleで対象ブランチとバックアップを確認する。
2. アプリから対象DBへの書き込みを停止する。
3. 旧 `pubs` の件数、`id` と `data.id` の一致、必須属性、座標、URL、タグ、statusを確認する。
4. リポジトリルートに `data/市区町村コード.csv` があることを確認する。
5. PreviewとProductionの接続文字列を取り違えていないことを確認する。

verify SQLは適用後スキーマを参照するため、対応するup SQLより前には実行しません。

## 適用順序

### 1. JSONBを項目別カラムへ移行する

```bash
node scripts/run-neon-migration.mjs db/migrations/001_pubs_columns_up.sql
node scripts/run-neon-migration.mjs db/migrations/001_pubs_columns_verify.sql
```

001は旧テーブルを `pubs_jsonb_legacy_20260815`、旧IDと新UUIDの対応を `pub_id_migration_map` に保持します。verifyで `row_count` と `id_map_count` が旧件数と一致し、`missing_migrated_rows` と `legacy_jsonb_dependency` が0であることを確認します。

### 2. 都道府県・営業状況・タグ関係を分離する

```bash
node scripts/run-neon-migration.mjs db/migrations/002_normalize_pub_metadata_up.sql
node scripts/run-neon-migration.mjs db/migrations/002_normalize_pub_metadata_verify.sql
```

都道府県マスタが47件、営業状況マスタが4件であり、欠損参照、孤立タグ、重複タグ、旧カラムの残存が0であることを確認します。

### 3. 市区町村コードを取り込む

```bash
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/003_municipality_codes_up.sql
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/003_municipality_codes_verify.sql
```

CSVの都道府県名・カナは `prefectures` と照合されます。verifyで市区町村コード件数が0より大きく、不正な6桁コードと都道府県への孤立参照が0であることを確認します。

### 4. タグをマスタ化する

```bash
node scripts/run-neon-migration.mjs db/migrations/004_normalize_pub_tags_up.sql
node scripts/run-neon-migration.mjs db/migrations/004_normalize_pub_tags_verify.sql
```

004は旧 `pub_tags.tag` を `tags.name` と `pub_tags.tag_id` へ移し、旧関係を `pub_tags_legacy_20260816` に保持します。verifyで孤立参照、タグ名と店舗・タグ関係の重複、旧 `tag` カラムの残存が0であることを確認します。

### 5. タグ名を共通定義へ正規化する

```bash
node scripts/run-neon-migration.mjs db/migrations/005_normalize_tag_names_up.sql
node scripts/run-neon-migration.mjs db/migrations/005_normalize_tag_names_verify.sql
```

005は移行前のタグ名と関係を専用バックアップテーブルへ保持します。verifyで別名・区切り文字の残存、孤立参照、重複が0であることを確認します。詳細は[タグの正規化仕様](../specs/tag-normalization.md)を参照してください。

## アプリ切り替え前の確認

PreviewとProductionのそれぞれで、次を確認してから現行アプリへ切り替えます。

- `GET /api/pubs` が検証済み店舗を返す
- 店舗が市区町村コード順、店舗名順で表示される
- 検索、都道府県、タグ、閉業店舗表示が機能する
- 管理画面の一覧・追加・編集・削除が機能する
- 一括インポートが既存UUIDをスキップする

## ロールバック

現行スキーマへの書き込み後にdown SQLを実行すると、その更新を移行前テーブルへ完全には戻せません。アプリの書き込みを停止し、Neonバックアップと各移行のバックアップテーブルを確認してから、適用と逆順に実行します。

```bash
node scripts/run-neon-migration.mjs db/migrations/005_normalize_tag_names_down.sql
node scripts/run-neon-migration.mjs db/migrations/004_normalize_pub_tags_down.sql
node scripts/run-neon-migration.mjs db/migrations/003_municipality_codes_down.sql
node scripts/run-neon-migration.mjs db/migrations/002_normalize_pub_metadata_down.sql
node scripts/run-neon-migration.mjs db/migrations/001_pubs_columns_down.sql
```

復旧後は対応する旧スキーマ版アプリへ戻し、件数、店舗属性、APIを再確認します。003のdown SQLはCSV取込を行わないため、NodeのNeonクライアントで実行できます。
