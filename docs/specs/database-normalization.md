# 店舗メタデータ正規化

## 現行スキーマ

Issue #188 の対応後、店舗メタデータは次の関係に分けて保存します。

| テーブル     | 役割                                         |
| ------------ | -------------------------------------------- |
| pubs         | 店舗の基本情報、prefecture_code、status_code |
| prefectures  | JIS都道府県コード（1〜47）と表示名           |
| pub_statuses | 営業状況の数値コード、外部値、表示名         |
| pub_tags     | 店舗IDとタグの対応。店舗IDとタグの複合主キー |

pubs.prefecture_code は prefectures.code、pubs.status_code は pub_statuses.code を参照します。pub_tags.pub_id は pubs.id を参照し、店舗削除時はタグも削除します。複合主キーにより同じ店舗への同一タグの重複を防ぎます。

## 外部形式との対応

アプリケーションの共有 Pub 型と公開APIの形式は変更しません。

| 外部項目                 | DBでの保存        |
| ------------------------ | ----------------- |
| prefecture（都道府県名） | prefectures.code  |
| status（open など）      | pub_statuses.code |
| tags（文字列配列）       | pub_tags の複数行 |

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

既存の001適用済みDBは db/migrations/002_normalize_pub_metadata_up.sql を明示的に実行します。適用後は db/migrations/002_normalize_pub_metadata_verify.sql の件数・孤児・重複・旧カラム確認を行います。戻す場合は down.sql を先に実行します。

アプリは旧形式の既存DBを自動変換しません。旧形式を検出した場合は002の実行を要求します。新規の空DBでは、マスタと正規化されたテーブルを作成し、data/pubs.json を初期投入します。
