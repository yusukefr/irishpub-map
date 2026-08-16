# 店舗メタデータ正規化

## 現行スキーマ

Issue #194 の対応後、店舗メタデータは次の関係に分けて保存します。

| テーブル           | 役割                                             |
| ------------------ | ------------------------------------------------ |
| pubs               | 店舗の基本情報、prefecture_code、status_code     |
| prefectures        | JIS都道府県コード（1〜47）、表示名、カナ         |
| pub_statuses       | 営業状況の数値コード、外部値、表示名             |
| municipality_codes | 市区町村コード、市区町村名、カナ                 |
| tags               | タグIDとタグ名を一意に管理するマスタ             |
| pub_tags           | 店舗IDとタグIDの対応。店舗IDとタグIDの複合主キー |

pubs.prefecture_code は prefectures.code、pubs.status_code は pub_statuses.code を参照します。市区町村コードは `municipality_codes.code` に6桁文字列として保存し、都道府県コードと市区町村名で店舗と対応付けます。都道府県名・カナは prefectures マスタで管理し、municipality_codes には重複して保存しません。`tags.name` は一意で、`pub_tags.pub_id` は `pubs.id`、`pub_tags.tag_id` は `tags.id` を参照します。店舗またはタグを削除すると、対応する `pub_tags` はカスケード削除されます。未使用のタグマスタは自動削除しません。複合主キーにより同じ店舗への同一タグの重複を防ぎます。

`pub_tags_legacy_20260816` は004適用時の旧形式バックアップです。

## 外部形式との対応

アプリケーションの共有 Pub 型と公開APIには、市区町村コードを解決できた場合の `municipalityCode` が追加されます。既存の店舗JSONにコードを直接記録せず、CSVまたはDBマスタから派生させます。

| 外部項目                      | DBでの保存                |
| ----------------------------- | ------------------------- |
| prefecture（都道府県名）      | prefectures.code          |
| prefecture のカナ             | prefectures.kana          |
| status（open など）           | pub_statuses.code         |
| municipalityCode（6桁コード） | municipality_codes.code   |
| tags（文字列配列）            | tags と pub_tags の複数行 |

取得時はリポジトリがマスタを表示名・外部値へ戻し、タグ行を配列へ集約します。DB未設定時の data/pubs.json フォールバックも従来どおりです。

## コードと表示

都道府県は JIS 順の 1〜47 を採用します。営業状況は次の固定対応です。

| code | value              | 表示名   |
| ---: | ------------------ | -------- |
|    1 | open               | 営業中   |
|    2 | temporarily_closed | 一時休業 |
|    3 | closed             | 閉店     |
|    4 | unknown            | 不明     |

管理画面の選択肢と検索の都道府県順は packages/shared の同じ定義を参照します。

## 移行と初期化

既存の001適用済みDBは db/migrations/002_normalize_pub_metadata_up.sql、続けて db/migrations/003_municipality_codes_up.sql、004_normalize_pub_tags_up.sql を明示的に実行します。003はリポジトリルートから市区町村コードCSVを psql のクライアント側コピーで取り込み、004は既存の `pub_tags.tag` をタグマスタと `tag_id` 参照へ移行します。適用後は各 migration の verify SQL で確認します。戻す場合は004、003の順にdown.sqlを実行します。

タグマスタの移行は、003の確認後に次の順で実行します。

    psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/004_normalize_pub_tags_up.sql
    psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/004_normalize_pub_tags_verify.sql

004のdown.sqlを実行する場合はアプリの書き込みを停止します。新しいタグ関連付けは文字列タグへ変換して復元し、正規化後のテーブルは `pub_tags_normalized_20260816` と `tags_normalized_20260816` へ退避します。

アプリは旧形式の既存DBを自動変換しません。旧形式を検出した場合は002の実行を要求します。新規の空DBでは、マスタと正規化されたテーブルを作成し、data/pubs.json を初期投入します。
