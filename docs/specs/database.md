# データベース定義書

## 概要

Irish Pub Mapの永続化先はNeon Postgresです。`DATABASE_URL` が設定された環境では、`apps/web/app/lib/pub-repository.ts` が正規化済みの店舗・マスタ・翻訳・タグ関係テーブルを読み書きします。未設定時は公開APIと管理画面が空の店舗一覧を返し、更新操作は利用できません。

現行の物理スキーマは、Neon PostgreSQLのカタログを読み取り専用で照会して生成する[生成済みスキーマ](../generated/database-schema.md)を基準とします。`npm run generate:database-schema` はテーブル、カラム、制約、外部キー、インデックスを安定した順序で再生成します。生成ファイルは手動編集せず、`DATABASE_URL` やデータ値を出力しません。Schema変更の履歴と適用手順は `db/migrations/` と[Neon migration Runbook](../runbooks/neon-migrations.md)を参照し、現行スキーマの根拠にはしません。

## 概念モデル

アプリケーションは、店舗・地域・営業状況・タグ・Editorial Content・Quizを扱います。各概念の物理テーブル名、カラム、制約、インデックスは、現行Neonから生成した[生成済みスキーマ](../generated/database-schema.md)を参照してください。認証情報は環境変数、ログイン後のセッションは署名付きHttpOnly Cookieで管理し、アプリケーション用の認証テーブルは持ちません。

## 関係

店舗は都道府県・市区町村・営業状況に分類され、各概念はロケール別の翻訳を持ちます。店舗とタグは多対多で関連付けます。Editorial Contentは翻訳を持ち、Quizは任意の関連Contentを参照し、問題・Choice・各翻訳を親子関係で管理します。

この関係はアプリケーションの概念モデルです。物理カラム、NULL許容、外部キー、削除規則は生成済みスキーマを正とします。

## 翻訳の選択

Repositoryは要求ロケールの翻訳を優先し、存在しない場合は共通locale定義の既定localeへフォールバックします。対象は店舗、都道府県、市区町村、営業状況、タグ、Editorial Content、Quizです。店舗の緯度経度、URL、コード、タグ関係やQuizのCategory、Special Date、正解など言語に依存しない値は親テーブルに保持します。

## 正規化とアプリケーション境界

店舗、都道府県、市区町村、営業状況、タグ、Editorial Content、Quizは、言語に依存しない親テーブルとロケール別の翻訳テーブルへ分離します。これにより表示言語を追加しても、識別子・コード・関係を複製しません。店舗とタグは `pub_tags` を介した多対多で、複合主キーが重複を防ぎます。

コードと内部キーは画面表示に直接使用しません。Repositoryは要求ロケールの翻訳を優先して読み、未登録なら日本語へフォールバックします。共有 `Pub` 型へ変換するときは、店舗の表示文言を `pub_translations`、地域の表示名を各翻訳テーブル、営業状態を `pub_statuses` と翻訳、タグを `pub_tags`・`tags`・翻訳から取得します。

削除時の関係維持は物理スキーマに従います。店舗・タグ・Content・Quizの親を削除した場合、対応する翻訳や中間行は必要に応じてカスケード削除されます。一方、都道府県、市区町村、営業状況を参照する店舗にはカスケード削除を設定しません。公開条件のように複数テーブルにまたがる業務ルールは、DB制約だけで代替せず、Application ServiceとRepositoryがtransaction内で検証します。

## 読み書き

| 操作 | 実装 | 整合性の扱い |
| --- | --- | --- |
| 公開取得 | `getPublishedPubs` | SQLで公開中だけに絞り、選択ロケールの共有 `Pub` 型へ変換して検証 |
| 管理一覧 | `getAdminPubPage` | 公開・非公開とNULLを含む下書きを検索・ページング済み一覧DTOで返す |
| 管理詳細 | `getAdminPub` | 日英翻訳、コード、タグID、公開状態を含む `AdminPub` を返す |
| 追加 | `createAdminPub` | 店舗本体、日英翻訳、既存タグ関係を単一transactionで保存し、常に非公開で作成 |
| 更新 | `updateAdminPub` | 公開状態を維持して全体更新し、公開済みの場合はPublish Validationを適用 |
| 削除 | `deleteAdminPub` | 店舗を削除し、店舗翻訳と `pub_tags` は外部キーでカスケード削除 |
| 一括投入 | `scripts/import-pubs.mjs` | 日本語の市区町村をコードへ解決し、新規UUIDの非公開店舗・翻訳・タグ関係だけを追加 |
| タグ管理取得 | `getAdminTags` | サポートlocaleの翻訳と `pub_tags` の重複を除いた使用店舗数を取得 |
| タグ管理追加 | `createAdminTag` | タグ本体と入力された各localeの翻訳を単一transactionで追加 |
| タグ管理更新 | `updateAdminTag` | keyを維持し、localeごとの翻訳を単一transactionでUPSERTまたは削除 |
| タグ管理削除 | `deleteAdminTag` | タグ行をロックし、`pub_tags` が0件の場合だけ条件付き削除 |
| 公開Quiz取得 | `listPublishedQuizQuestions` / `getDailyPublishedQuiz` | SQLで公開中だけに絞り、回答情報を含まないDTOへ厳密に変換して既存の日次選択を適用 |
| Quiz採点 | `gradePublishedQuizAnswer` | 公開Questionと送信Choiceをparameterized queryで検証した後だけ正解・解説・Sourceを返す |
| 管理Quiz取得 | `listAdminQuizQuestions` / `getAdminQuizQuestion` | DraftとPublished、日英翻訳、Choiceを管理DTOへ変換し、不正DB行を拒否 |
| 管理Quiz保存 | `insertAdminQuizQuestion` / `replaceAdminQuizQuestion` | Question本体、日英翻訳、Choiceを単一transactionで作成・全体更新 |
| Quiz公開状態 | `setAdminQuizPublication` | 行ロック後にCategory・正解・Source・日英翻訳・4 Choicesを再検証してPublish / Unpublish |

店舗またはタグの削除時は、対応する翻訳と `pub_tags` が `ON DELETE CASCADE` で削除されます。ただし管理タグ機能は使用中タグのDELETE自体をtransaction内で拒否し、店舗関連や店舗を変更しません。都道府県・市区町村・営業状況を参照する店舗にはカスケード削除を設定していません。

## 関連ドキュメント

- [生成済みスキーマ](../generated/database-schema.md)
- [店舗データ仕様](data.md)
- [タグの正規化仕様](tag-normalization.md)
- [管理タグ仕様](tag-management.md)
- [API 方針](api.md)
- [管理店舗の下書き・公開設計](admin-pub-lifecycle.md)
- [システム構成](../architecture/system-overview.md)
