# テーブル・カラム定義

## 概要

この文書は、Issue #262で確認し、Issue #272で2026年8月26日に再確認したNeon上の実スキーマを基準に、現在存在するアプリケーション用テーブルのカラム・制約・インデックスを定義します。再確認では記載内容との意味上の差異はありませんでした。現在のアプリケーション実装を照合に用い、`db/migrations` は設計経緯を確認するための補助資料として扱います。表示文言は翻訳テーブル、言語に依存しない値は親テーブル、店舗とタグの関係は中間テーブルに保存します。

Issue #273のマイグレーション008で `is_published` を追加しました。下書き保存のために後続Issueで変更するNULL制約は、現行スキーマへ適用されるまでこの表へ先行記載しません。確定した変更要件は[管理店舗の下書き・公開設計](admin-pub-lifecycle.md)を参照してください。

`NULL` 欄の「不可」は `NOT NULL` または主キー制約、「可」はDB制約上NULLを許可することを表します。

## `pubs`

| カラム | 型 | NULL | キー・参照 | DEFAULT | CHECK・用途 |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | 不可 | PK | `gen_random_uuid()` | 店舗ID |
| `prefecture_code` | SMALLINT | 不可 | FK → `prefectures.code` | なし | 都道府県コード |
| `municipality_code` | TEXT | 可 | FK → `municipality_codes.code` | なし | 6桁の市区町村コード |
| `latitude` | DOUBLE PRECISION | 不可 |  | なし | -90以上90以下 |
| `longitude` | DOUBLE PRECISION | 不可 |  | なし | -180以上180以下 |
| `website_url` | TEXT | 可 |  | なし | NULLまたはHTTP(S) URL |
| `google_maps_url` | TEXT | 可 |  | なし | NULLまたはHTTP(S) URL |
| `instagram_url` | TEXT | 可 |  | なし | NULLまたはHTTP(S) URL |
| `status_code` | SMALLINT | 不可 | FK → `pub_statuses.code` | なし | 営業状況コード |
| `is_published` | BOOLEAN | 不可 |  | `FALSE` | 公開APIへの掲載状態。既存店舗は移行時に `TRUE` |
| `updated_at` | TIMESTAMPTZ | 不可 |  | `NOW()` | Repositoryが更新時にも現在時刻を設定 |

`municipality_code` はDB上ではNULLを許可します。Repositoryは、新規・更新データについて市区町村コードを解決できることを別途検証します。

## `pub_translations`

| カラム | 型 | NULL | キー・参照 | DEFAULT | CHECK・用途 |
| --- | --- | --- | --- | --- | --- |
| `pub_id` | UUID | 不可 | PK、FK → `pubs.id` ON DELETE CASCADE | なし | 店舗ID |
| `locale` | TEXT | 不可 | PK | なし | 空白のみを禁止 |
| `name` | TEXT | 不可 |  | なし | 空白のみを禁止。店舗表示名 |
| `name_reading` | TEXT | 可 |  | なし | NULLまたは空白以外。店舗名の読み |
| `address` | TEXT | 不可 |  | なし | 空白のみを禁止。店舗住所 |
| `updated_at` | TIMESTAMPTZ | 不可 |  | `NOW()` | 翻訳の更新日時 |

主キーは `(pub_id, locale)` です。

## `prefectures`

| カラム | 型       | NULL | キー・参照 | DEFAULT | CHECK・用途              |
| ------ | -------- | ---- | ---------- | ------- | ------------------------ |
| `code` | SMALLINT | 不可 | PK         | なし    | 1以上47以下のJIS順コード |

## `prefecture_translations`

| カラム | 型 | NULL | キー・参照 | DEFAULT | CHECK・用途 |
| --- | --- | --- | --- | --- | --- |
| `prefecture_code` | SMALLINT | 不可 | PK、FK → `prefectures.code` ON DELETE CASCADE | なし | 都道府県コード |
| `locale` | TEXT | 不可 | PK、`name` と複合UNIQUE | なし | 空白のみを禁止 |
| `name` | TEXT | 不可 | `locale` と複合UNIQUE | なし | 空白のみを禁止。都道府県表示名 |
| `name_reading` | TEXT | 可 |  | なし | NULLまたは空白以外。表示名の読み |

主キーは `(prefecture_code, locale)`、追加の一意制約は `(locale, name)` です。

## `municipality_codes`

| カラム            | 型       | NULL | キー・参照              | DEFAULT | CHECK・用途            |
| ----------------- | -------- | ---- | ----------------------- | ------- | ---------------------- |
| `code`            | TEXT     | 不可 | PK                      | なし    | 数字6桁                |
| `prefecture_code` | SMALLINT | 不可 | FK → `prefectures.code` | なし    | 所属する都道府県コード |

## `municipality_translations`

| カラム | 型 | NULL | キー・参照 | DEFAULT | CHECK・用途 |
| --- | --- | --- | --- | --- | --- |
| `municipality_code` | TEXT | 不可 | PK、FK → `municipality_codes.code` ON DELETE CASCADE | なし | 市区町村コード |
| `locale` | TEXT | 不可 | PK | なし | 空白のみを禁止 |
| `name` | TEXT | 不可 |  | なし | 空白のみを禁止。市区町村表示名 |
| `name_reading` | TEXT | 可 |  | なし | NULLまたは空白以外。表示名の読み |

主キーは `(municipality_code, locale)` です。

## `pub_statuses`

| カラム | 型       | NULL | キー・参照 | DEFAULT | CHECK・用途                  |
| ------ | -------- | ---- | ---------- | ------- | ---------------------------- |
| `code` | SMALLINT | 不可 | PK         | なし    | 営業状況コード               |
| `key`  | TEXT     | 不可 | UNIQUE     | なし    | 言語非依存の営業状況内部キー |

## `pub_status_translations`

| カラム | 型 | NULL | キー・参照 | DEFAULT | CHECK・用途 |
| --- | --- | --- | --- | --- | --- |
| `status_code` | SMALLINT | 不可 | PK、FK → `pub_statuses.code` ON DELETE CASCADE | なし | 営業状況コード |
| `locale` | TEXT | 不可 | PK | なし | 空白のみを禁止 |
| `display_name` | TEXT | 不可 |  | なし | 空白のみを禁止。営業状況表示名 |

主キーは `(status_code, locale)` です。

## `tags`

| カラム | 型   | NULL | キー・参照 | DEFAULT             | CHECK・用途                |
| ------ | ---- | ---- | ---------- | ------------------- | -------------------------- |
| `id`   | UUID | 不可 | PK         | `gen_random_uuid()` | タグID                     |
| `key`  | TEXT | 不可 | UNIQUE     | なし                | 言語非依存の正規化済みキー |

## `tag_translations`

| カラム   | 型   | NULL | キー・参照                           | DEFAULT | CHECK・用途                |
| -------- | ---- | ---- | ------------------------------------ | ------- | -------------------------- |
| `tag_id` | UUID | 不可 | PK、FK → `tags.id` ON DELETE CASCADE | なし    | タグID                     |
| `locale` | TEXT | 不可 | PK、`name` と複合UNIQUE              | なし    | 空白のみを禁止             |
| `name`   | TEXT | 不可 | `locale` と複合UNIQUE                | なし    | 空白のみを禁止。タグ表示名 |

主キーは `(tag_id, locale)`、追加の一意制約は `(locale, name)` です。

## `pub_tags`

| カラム   | 型   | NULL | キー・参照                           | DEFAULT | CHECK・用途 |
| -------- | ---- | ---- | ------------------------------------ | ------- | ----------- |
| `pub_id` | UUID | 不可 | PK、FK → `pubs.id` ON DELETE CASCADE | なし    | 店舗ID      |
| `tag_id` | UUID | 不可 | PK、FK → `tags.id` ON DELETE CASCADE | なし    | タグID      |

主キーは `(pub_id, tag_id)` で、同じ店舗への同一タグの重複を防ぎます。

## インデックス

主キー・UNIQUE制約によって作成されるインデックスに加え、次のB-treeインデックスを使用します。

| インデックス名               | テーブル   | カラム              | 用途                       |
| ---------------------------- | ---------- | ------------------- | -------------------------- |
| `pubs_prefecture_code_idx`   | `pubs`     | `prefecture_code`   | 都道府県による店舗絞り込み |
| `pubs_municipality_code_idx` | `pubs`     | `municipality_code` | 市区町村コードによる検索   |
| `pubs_status_code_idx`       | `pubs`     | `status_code`       | 営業状況による店舗絞り込み |
| `pub_tags_tag_id_idx`        | `pub_tags` | `tag_id`            | タグから店舗関係を逆引き   |

## アプリケーション境界

Repositoryは、選択ロケールと日本語の優先順位を使って各翻訳テーブルをJOINし、DBドライバーの値を共有 `Pub` 型へ正規化して検証します。一部の行だけが不正な場合はその行を除外して件数をサーバーログへ記録し、取得行がすべて不正な場合はエラーにします。この境界処理はDB制約の代替ではありません。
