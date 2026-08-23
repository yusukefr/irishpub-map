# データベース正規化方針

## 目的

店舗検索で利用するコード・表示文言・多対多関係を分離し、同じ意味の値を重複保存せず、日本語と英語の表示を同じ店舗データへ関連付けます。物理カラムと制約は[テーブル・カラム定義](database-columns.md)を正とし、この文書では現行スキーマの分離方針を説明します。

## 責務の分離

| 分類 | テーブル | 保持する値 |
| --- | --- | --- |
| 店舗の言語非依存属性 | `pubs` | コード、緯度経度、URL、更新日時 |
| 店舗の表示文言 | `pub_translations` | 店舗名、読み、住所 |
| 都道府県マスタ | `prefectures`、`prefecture_translations` | JIS順コード、ロケール別の名前と読み |
| 市区町村マスタ | `municipality_codes`、`municipality_translations` | 6桁コード、所属都道府県、ロケール別の名前と読み |
| 営業状況マスタ | `pub_statuses`、`pub_status_translations` | 数値コード、内部キー、ロケール別の表示名 |
| タグマスタ | `tags`、`tag_translations` | UUID、内部キー、ロケール別の表示名 |
| 店舗とタグの関係 | `pub_tags` | 店舗IDとタグIDの組 |

親テーブルは言語に依存しない識別子と属性だけを持ち、表示文言は親IDと `locale` を複合主キーとする翻訳テーブルに保存します。これにより、表示言語を追加しても店舗・コード・関係を複製する必要がありません。

## コードと表示文言

- `pubs.prefecture_code` は `prefectures.code` を参照します。都道府県名は `prefecture_translations` から取得します。
- `pubs.municipality_code` は `municipality_codes.code` を参照します。市区町村名は `municipality_translations` から取得します。
- `pubs.status_code` は `pub_statuses.code` を参照します。営業状況の内部キーは `pub_statuses.key`、表示名は `pub_status_translations.display_name` です。
- `pub_tags.tag_id` は `tags.id` を参照します。検索・API用の内部キーは `tags.key`、表示名は `tag_translations.name` です。

コードや内部キーは画面表示に直接使用せず、表示文言と分離します。Repositoryは要求ロケールを優先し、その翻訳がない場合は日本語（`ja`）へフォールバックします。

## リレーションと削除

- 店舗とタグは `pub_tags` を介した多対多です。`(pub_id, tag_id)` の複合主キーで重複を防ぎます。
- 店舗を削除すると、その店舗の `pub_translations` と `pub_tags` がカスケード削除されます。
- タグを削除すると、そのタグの `tag_translations` と `pub_tags` がカスケード削除されます。
- 都道府県、市区町村、営業状況を参照中の店舗にはカスケード削除を設定していません。
- 使用されなくなったタグの親レコードは、店舗更新時に自動削除しません。

## アプリケーション境界

共有 `Pub` 型は、DBの正規化された複数行をAPI・Web・将来のモバイルアプリで扱いやすい1店舗単位の形式へ戻します。

| 共有 `Pub` の値           | DBでの取得元                                      |
| ------------------------- | ------------------------------------------------- |
| `name`、`kana`、`address` | 選択された `pub_translations`                     |
| `prefecture`              | 選択された `prefecture_translations.name`         |
| `city`                    | 選択された `municipality_translations.name`       |
| `municipalityCode`        | `pubs.municipality_code`                          |
| `status`                  | `pubs.status_code` に対応する共有営業状況定義     |
| `statusDisplayName`       | 選択された `pub_status_translations.display_name` |
| `tags`                    | `pub_tags` と `tags.key`                          |
| `tagDisplayNames`         | 選択された `tag_translations.name`                |

作成・更新時は、日本語の都道府県名と市区町村名からコードを解決し、言語非依存属性を `pubs`、日本語の店舗文言を `pub_translations`、タグ関係を `pub_tags` に保存します。市区町村が一意に解決できない入力は保存しません。
