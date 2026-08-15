# 店舗テーブル移行手順

## 対象と前提

対象は `DATABASE_URL` が接続する Preview または Production の Neon Postgres です。本番データを変更するため、対象環境・接続先・メンテナンス時間を確認してから実行します。移行中は旧テーブルを保持し、二重書き込みや長期の互換期間は採用しません。

## 実行前確認とバックアップ

1. Neon Console で対象ブランチを確認し、Neon のスナップショット／バックアップを取得する。
2. `pubs` の件数、`id` と `data.id` の一致、必須属性、URL、タグ、status を確認する。
3. 接続文字列は一時的なシェル変数だけで渡し、出力・履歴・リポジトリへ記録しない。

```bash
export MIGRATION_DATABASE_URL='対象環境から安全に取得した接続文字列'
psql "$MIGRATION_DATABASE_URL" -c 'SELECT COUNT(*) FROM pubs;'
```

## 移行

アプリを新スキーマ対応版へ切り替える前に、対象 DB へ 1 回だけ実行します。

```bash
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_pubs_columns_up.sql
```

移行 SQL は、旧テーブルのスナップショット、旧 ID→決定的 UUID の対応表、必須値・座標・URL・タグ・status の事前検証、全属性の独立カラムへのコピー、件数照合を同一トランザクションで行います。切り替え後も `pubs_jsonb_legacy_20260815` と `pub_id_migration_map` を保持します。

## 移行後確認

```bash
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_pubs_columns_verify.sql
```

`row_count` と `id_map_count` が旧件数と一致し、`missing_migrated_rows` が 0、`legacy_jsonb_dependency` が 0 であることを確認します。Preview／Production それぞれで公開 API、管理画面の一覧・追加・編集・削除、検索、店舗詳細 URL、インポートも確認します。

## ロールバック

新テーブルへ書き込みが発生した後のロールバックでは、その更新は旧テーブルへ戻りません。書き込みを停止し、Neon バックアップまたは旧テーブルを確認してから実行します。

```bash
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_pubs_columns_down.sql
```

ロールバック SQL は新テーブルを `pubs_columns_rolled_back_20260815` へ退避し、旧テーブルを `pubs` に戻します。復旧後は旧スキーマ対応コードへ戻し、件数・属性・API を再確認します。接続文字列やトークンは運用記録に残しません。
