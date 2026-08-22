# 店舗メタデータ正規化

## 現行スキーマ

現行の店舗メタデータと表示翻訳は次の関係に分けて保存します。

| テーブル                  | 役割                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| pubs                      | 言語非依存の店舗属性、prefecture_code、municipality_code、status_code |
| pub_translations          | 店舗名、読み、住所をロケール別に保存                                  |
| prefectures               | JIS都道府県コード（1〜47）                                            |
| prefecture_translations   | 都道府県表示名をロケール別に保存                                      |
| pub_statuses              | 営業状況の数値コード                                                  |
| pub_status_translations   | 営業状況表示名をロケール別に保存                                      |
| municipality_codes        | 市区町村コード                                                        |
| municipality_translations | 市区町村表示名をロケール別に保存                                      |
| tags                      | タグIDと正規化済み内部キーを一意に管理するマスタ                      |
| tag_translations          | タグ表示名をロケール別に保存                                          |
| pub_tags                  | 店舗IDとタグIDの対応。店舗IDとタグIDの複合主キー                      |

pubs.prefecture_code は prefectures.code、pubs.status_code は pub_statuses.code を参照します。市区町村コードは `municipality_codes.code` に6桁文字列として保存し、`pubs.municipality_code` から参照します。表示名は各翻訳テーブルで管理します。`tags.key` は一意で、`pub_tags.pub_id` は `pubs.id`、`pub_tags.tag_id` は `tags.id` を参照します。店舗またはタグを削除すると、対応する `pub_tags` はカスケード削除されます。未使用のタグマスタは自動削除しません。複合主キーにより同じ店舗への同一タグの重複を防ぎます。

`pub_tags_legacy_20260816` は004適用時の旧形式バックアップです。

## 外部形式との対応

アプリケーションの共有 Pub 型と公開APIには、市区町村コードを解決できた場合の `municipalityCode` が追加されます。既存の店舗JSONにコードを直接記録せず、CSVまたはDBマスタから派生させます。

| 外部項目                      | DBでの保存                |
| ----------------------------- | ------------------------- |
| prefecture（都道府県名）      | prefectures.code          |
| prefecture のカナ             | prefectures.kana          |
| status（open など）           | pub_statuses.code         |
| status の表示名               | pub_status_translations   |
| municipalityCode（6桁コード） | municipality_codes.code   |
| tags（文字列配列）            | tags と pub_tags の複数行 |

取得時はリポジトリがマスタを表示名・外部値へ戻し、タグ行を配列へ集約します。DATABASE_URL未設定時は静的データへフォールバックせず、空の店舗一覧を返します。タグの内部キー・表示名・別名・棚卸しは [タグの正規化仕様](tag-normalization.md) を正とします。

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

旧JSONB構成からは、001（項目別カラム）、002（都道府県・営業状況・タグ関係）、003（市区町村コード）、004（タグマスタ）、005（タグ名）の順に適用します。003はCSVを `psql` のクライアント側 `\\copy` で取り込み、それ以外はNodeのNeonクライアントで実行します。コマンド、verify項目、逆順のロールバックは[店舗テーブル移行手順](../operations/database-migration.md)へ集約します。

アプリは旧形式や途中まで適用されたDBを自動変換しません。新規の空DBでは一括インポートが店舗・都道府県・営業状況・タグ関連テーブルを作成しますが、公開APIを使う前に003を別途適用する必要があります。店舗データは管理画面または一括インポートで明示的に投入し、リポジトリへスナップショットを保存しません。
