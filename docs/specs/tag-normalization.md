# タグの正規化仕様

## 目的

タグの内部キーと表示名を分離し、Neon、管理画面、検索・絞り込みで同じタグを同じ値として扱います。内部キーは小文字の kebab-case、表示名は利用者向けの日本語です。定義は `packages/shared/src/tag-definitions.json` を正とします。

## タグ定義

タグの利用可能な内部キーと表示名は、`packages/shared/src/tag-definitions.json`を正とします。Neonの`tags`テーブルには、正規化済みの内部キーを保存します。

| 内部キー       | 表示名         |
| -------------- | -------------- |
| `guinness`     | ギネス         |
| `food`         | 食事あり       |
| `station-area` | 駅近           |
| `craft-beer`   | クラフトビール |
| `live-music`   | ライブ音楽     |
| `whiskey`      | ウイスキー     |

利用店舗数はNeonの店舗データを集計して確認します。リポジトリには店舗データのスナップショットを保存しません。

## 正規化ルール

- 前後の空白を除去し、Unicode NFKC、大文字小文字の正規化を行います。
- 空白またはアンダースコアはハイフンへ変換し、連続するハイフンを1つにします。
- `ギネス`、`食事あり`、`駅近`、`クラフトビール`、`ライブ音楽` は対応する英語の内部キーへ変換します。
- `whisky`、`ウイスキー` は `whiskey` へ変換します。
- 定義表にないタグは、機械的な表記だけを正規化して保持します。意味が異なるタグを推測で統合しません。
- 店舗内では正規化後の内部キーを重複排除します。検索条件も同じ処理を通すため、保存済みの旧表記を指定した条件を失効させません。
- 表示時は内部キーから表示名を解決し、未知のタグは内部キーをそのまま表示します。

## データ経路

`asPubs`、`scripts/import-pubs.mjs`、管理画面、Neonリポジトリ、検索フィルターはすべて共有定義を使用します。DBでは `tags.name` に正規化された内部キーを保存し、`pub_tags.tag_id` で店舗と関連付けます。

## DB移行

004適用済みのDBに対して、アプリの書き込みを停止し、Neonのバックアップを取得してから次をNode Neonクライアントで実行します。

```bash
node scripts/run-neon-migration.mjs db/migrations/005_normalize_tag_names_up.sql
node scripts/run-neon-migration.mjs db/migrations/005_normalize_tag_names_verify.sql
```

005は移行前のタグ名と店舗との関連を `tag_name_normalization_backup_20260817`、`tag_name_normalization_pub_tags_backup_20260817` に保存します。適用前後で `tags` と `pub_tags` の件数を比較し、verify SQL の別名残存、重複、孤立参照がすべて0であることを確認します。既存の意味の異なるタグを自動統合しないため、未知タグの件数は内容を確認してください。

問題がある場合は書き込みを停止したまま、次で005適用直後の状態へ戻します。

```bash
node scripts/run-neon-migration.mjs db/migrations/005_normalize_tag_names_down.sql
```

接続文字列は出力・履歴・ドキュメントへ記録しません。005の適用自体に `psql` は使用しません。
