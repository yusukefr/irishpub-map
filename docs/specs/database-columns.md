# テーブル・カラム定義

## 概要

この文書は、Issue #262で確認し、Issue #272で2026年8月26日に再確認したNeon上の実スキーマを基準に、現在存在するアプリケーション用テーブルのカラム・制約・インデックスを定義します。再確認では記載内容との意味上の差異はありませんでした。現在のアプリケーション実装を照合に用い、`db/migrations` は設計経緯を確認するための補助資料として扱います。表示文言は翻訳テーブル、言語に依存しない値は親テーブル、店舗とタグの関係は中間テーブルに保存します。

Issue #273のマイグレーション008で `is_published` を追加し、Issue #278では日本語店舗名のみの下書きを保存できるよう対象カラムのNULL制約を緩和するマイグレーション009を追加しました。Issue #342ではEditorial Contentの2テーブルを追加するマイグレーション010を追加し、Issue #344のマイグレーション011でContentの下書き用制約を緩和しました。実DBへ必要なMigrationを適用・検証してから対応アプリケーションをデプロイします。確定した保存・公開条件は[管理店舗の下書き・公開設計](admin-pub-lifecycle.md)を参照してください。

Issue #389のマイグレーション012はIrish QuizのQuestion・Choiceと各翻訳テーブルを追加します。この4テーブルは012適用後の定義であり、実DBへの適用状況やPublic Quizの参照元とは区別します。

`NULL` 欄の「不可」は `NOT NULL` または主キー制約、「可」はDB制約上NULLを許可することを表します。

## `pubs`

| カラム | 型 | NULL | キー・参照 | DEFAULT | CHECK・用途 |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | 不可 | PK | `gen_random_uuid()` | 店舗ID |
| `prefecture_code` | SMALLINT | 可 | FK → `prefectures.code` | なし | 都道府県コード |
| `municipality_code` | TEXT | 可 | FK → `municipality_codes.code` | なし | 6桁の市区町村コード |
| `latitude` | DOUBLE PRECISION | 可 |  | なし | -90以上90以下 |
| `longitude` | DOUBLE PRECISION | 可 |  | なし | -180以上180以下 |
| `website_url` | TEXT | 可 |  | なし | NULLまたはHTTP(S) URL |
| `google_maps_url` | TEXT | 可 |  | なし | NULLまたはHTTP(S) URL |
| `instagram_url` | TEXT | 可 |  | なし | NULLまたはHTTP(S) URL |
| `status_code` | SMALLINT | 可 | FK → `pub_statuses.code` | なし | 営業状況コード |
| `is_published` | BOOLEAN | 不可 |  | `FALSE` | 公開APIへの掲載状態。既存店舗は移行時に `TRUE` |
| `updated_at` | TIMESTAMPTZ | 不可 |  | `NOW()` | Repositoryが更新時にも現在時刻を設定 |

所在地、座標、営業状態は下書きではNULLを許可します。管理APIは指定されたコードの存在と市区町村の所属関係を別途検証します。

## `pub_translations`

| カラム | 型 | NULL | キー・参照 | DEFAULT | CHECK・用途 |
| --- | --- | --- | --- | --- | --- |
| `pub_id` | UUID | 不可 | PK、FK → `pubs.id` ON DELETE CASCADE | なし | 店舗ID |
| `locale` | TEXT | 不可 | PK | なし | 空白のみを禁止 |
| `name` | TEXT | 不可 |  | なし | 空白のみを禁止。店舗表示名 |
| `name_reading` | TEXT | 可 |  | なし | NULLまたは空白以外。店舗名の読み |
| `address` | TEXT | 可 |  | なし | NULL以外は空白のみを禁止。店舗住所 |
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

## `content_entries`

| カラム | 型 | NULL | キー・参照 | DEFAULT | CHECK・用途 |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | 不可 | PK | `gen_random_uuid()` | Editorial Content ID |
| `kind` | TEXT | 可 | `slug` と複合UNIQUE | なし | DraftはNULL可。アプリケーション側で `story` / `guide` をAllow List検証 |
| `slug` | TEXT | 可 | `kind` と複合UNIQUE | なし | DraftはNULL可。kind内のURL識別子 |
| `category` | TEXT | 可 |  | なし | DraftはNULL可。アプリケーション側で既知分類をAllow List検証 |
| `status` | TEXT | 不可 |  | なし | `draft` / `published` のみ |
| `published_at` | TIMESTAMPTZ | 条件付き |  | なし | draftはNULL、publishedは必須 |
| `created_at` | TIMESTAMPTZ | 不可 |  | `NOW()` | 作成日時 |
| `updated_at` | TIMESTAMPTZ | 不可 |  | `NOW()` | 更新日時 |

`kind` と `category` は将来のRenderer・分類追加を妨げないためDBの列挙制約にはせず、許可値をアプリケーション側で検証します。公開状態と日時は `content_entries_publication_state_check` で整合性を保ちます。

## `content_translations`

| カラム | 型 | NULL | キー・参照 | DEFAULT | CHECK・用途 |
| --- | --- | --- | --- | --- | --- |
| `content_id` | UUID | 不可 | PK、FK → `content_entries.id` ON DELETE CASCADE | なし | Editorial Content ID |
| `locale` | TEXT | 不可 | PK | なし | `ja` / `en` のみ |
| `title` | TEXT | 不可 |  | なし | Draftは空文字可。公開時は非空の表示タイトル |
| `summary` | TEXT | 不可 |  | なし | Draftは空文字可。公開時は非空の説明文 |
| `body_markdown` | TEXT | 不可 |  | なし | Draftは空文字可。管理APIでURLを検証し、Rendererでも安全な要素とURLに限定するMarkdown本文 |
| `updated_at` | TIMESTAMPTZ | 不可 |  | `NOW()` | 翻訳の更新日時 |

主キーは `(content_id, locale)` です。親Contentを削除すると翻訳も削除されます。

## `quiz_questions`

| カラム | 型 | NULL | キー・参照 | DEFAULT | CHECK・用途 |
| --- | --- | --- | --- | --- | --- |
| `id` | TEXT | 不可 | PK、`correct_choice_id` と複合FK | なし | 空白のみを禁止。既存JSONのQuestion ID |
| `category` | TEXT | 可 |  | なし | DraftはNULL可。NULL以外は空白のみを禁止するLocale非依存カテゴリID |
| `special_month` | SMALLINT | 条件付き |  | なし | `special_day` と同時にNULLまたは設定。1〜12 |
| `special_day` | SMALLINT | 条件付き |  | なし | `special_month` と同時にNULLまたは設定。2月は29、4・6・9・11月は30、その他は31以下 |
| `correct_choice_id` | TEXT | 可 | `id` と複合FK → `quiz_choices(question_id, id)` | なし | DraftはNULL可。NULL以外は空白のみを禁止し、同一QuestionのChoiceだけを遅延検査 |
| `source_url` | TEXT | 可 |  | なし | DraftはNULL可。NULL以外は空白のみを禁止し、URL形式はアプリケーションでも検証 |
| `related_content_id` | UUID | 可 | FK → `content_entries.id` ON DELETE SET NULL | なし | 任意の関連Editorial Content |
| `is_published` | BOOLEAN | 不可 |  | `FALSE` | 下書き・公開状態 |
| `created_at` | TIMESTAMPTZ | 不可 |  | `NOW()` | 作成日時 |
| `updated_at` | TIMESTAMPTZ | 不可 |  | `NOW()` | 更新日時 |

正解の複合外部キーは `DEFERRABLE INITIALLY DEFERRED` とします。Draftでは正解未選択のQuestionだけを保存でき、正解設定後はQuestionとChoiceを同じtransaction内で追加できます。commit時点で指定済みの正解Choiceが存在しない場合や別Questionに所属する場合は拒否します。PublishedのCategory・正解・Source・日英翻訳・4 Choicesの完全性は、Issue #392の管理APIが公開transaction内で検証します。

## `quiz_question_translations`

| カラム | 型 | NULL | キー・参照 | DEFAULT | CHECK・用途 |
| --- | --- | --- | --- | --- | --- |
| `question_id` | TEXT | 不可 | PK、FK → `quiz_questions.id` ON DELETE CASCADE | なし | Question ID |
| `locale` | TEXT | 不可 | PK | なし | `ja` / `en` のみ |
| `question` | TEXT | 不可 |  | なし | Draftは空文字可。公開時は非空の問題文 |
| `explanation` | TEXT | 不可 |  | なし | Draftは空文字可。公開時は非空の解説 |
| `source_label` | TEXT | 不可 |  | なし | Draftは空文字可。公開時は非空の情報源表示名 |
| `updated_at` | TIMESTAMPTZ | 不可 |  | `NOW()` | 翻訳の更新日時 |

主キーは `(question_id, locale)` です。親Questionを削除すると翻訳も削除されます。

## `quiz_choices`

| カラム | 型 | NULL | キー・参照 | DEFAULT | CHECK・用途 |
| --- | --- | --- | --- | --- | --- |
| `question_id` | TEXT | 不可 | PK、FK → `quiz_questions.id` ON DELETE CASCADE | なし | Question ID |
| `id` | TEXT | 不可 | PK | なし | 空白のみを禁止。Question内のChoice ID |
| `sort_order` | SMALLINT | 不可 | `question_id` と複合UNIQUE | なし | 0以上。Question内の表示順 |
| `created_at` | TIMESTAMPTZ | 不可 |  | `NOW()` | 作成日時 |
| `updated_at` | TIMESTAMPTZ | 不可 |  | `NOW()` | 更新日時 |

主キーは `(question_id, id)`、追加の一意制約は `(question_id, sort_order)` です。1QuestionあたりのChoice件数はDBでは4件に固定しません。

## `quiz_choice_translations`

| カラム | 型 | NULL | キー・参照 | DEFAULT | CHECK・用途 |
| --- | --- | --- | --- | --- | --- |
| `question_id` | TEXT | 不可 | PK、`choice_id` と複合FK | なし | Question ID |
| `choice_id` | TEXT | 不可 | PK、`question_id` と複合FK → `quiz_choices(question_id, id)` ON DELETE CASCADE | なし | Choice ID |
| `locale` | TEXT | 不可 | PK | なし | `ja` / `en` のみ |
| `label` | TEXT | 不可 |  | なし | Draftは空文字可。公開時は非空のChoice表示名 |
| `updated_at` | TIMESTAMPTZ | 不可 |  | `NOW()` | 翻訳の更新日時 |

主キーは `(question_id, choice_id, locale)` です。親Choiceを削除すると翻訳も削除されます。

## インデックス

主キー・UNIQUE制約によって作成されるインデックスに加え、次のB-treeインデックスを使用します。

| インデックス名 | テーブル | カラム | 用途 |
| --- | --- | --- | --- |
| `pubs_prefecture_code_idx` | `pubs` | `prefecture_code` | 都道府県による店舗絞り込み |
| `pubs_municipality_code_idx` | `pubs` | `municipality_code` | 市区町村コードによる検索 |
| `pubs_status_code_idx` | `pubs` | `status_code` | 営業状況による店舗絞り込み |
| `pub_tags_tag_id_idx` | `pub_tags` | `tag_id` | タグから店舗関係を逆引き |
| `quiz_questions_published_idx` | `quiz_questions` | `id`（公開行のみ） | 公開Quiz取得 |
| `quiz_questions_special_date_idx` | `quiz_questions` | `special_month, special_day, id`（公開・日付設定行のみ） | Special Date検索 |
| `quiz_questions_category_idx` | `quiz_questions` | `category, id` | Category検索 |
| `quiz_questions_admin_list_idx` | `quiz_questions` | `updated_at DESC, id` | Admin一覧 |
| `quiz_questions_related_content_id_idx` | `quiz_questions` | `related_content_id`（NULL以外） | Related Content逆引きと削除時参照処理 |

## アプリケーション境界

Repositoryは、選択ロケールと日本語の優先順位を使って各翻訳テーブルをJOINし、DBドライバーの値を共有 `Pub` 型へ正規化して検証します。一部の行だけが不正な場合はその行を除外して件数をサーバーログへ記録し、取得行がすべて不正な場合はエラーにします。この境界処理はDB制約の代替ではありません。
