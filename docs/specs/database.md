# データベース定義書

## 概要

永続化先はNeon Postgresです。`DATABASE_URL` が未設定の場合、公開取得は空の店舗一覧を返し、書込み操作は利用できません。Neonの接続情報はWebサーバーだけに設定し、MobileやBrowser ClientはDBへ直接接続しません。

物理テーブル、カラム、NULL許容、制約、外部キー、IndexはProduction Neonから生成した[生成済みスキーマ](../generated/database-schema.md)を正とします。生成文書は手動編集しません。再生成・Migrationの運用手順は[Neon migration Runbook](../runbooks/neon-migrations.md)を参照してください。

## IDと生成責務

Resource IDはPostgreSQL `uuid` 型とし、Application Serviceが `crypto.randomUUID()` で生成してRepositoryへ渡します。Application生成IDのDB列にDEFAULTは設定しません。APIとTypeScriptではUUIDを文字列として扱い、UUID形式を検証します。UUID以外のdomain codeはその型を維持します。Import処理は入力に含まれる店舗UUIDを使います。

## ドメインモデルと公開境界

店舗、地域、営業状態、Pub Type、タグ、Editorial Content、Quiz、Calendarは、言語に依存しない本体とlocale別翻訳に分けて保存します。PubとTagは多対多の `pub_tags` で関連付けます。Pub Typeは `pub_types` と翻訳テーブルに保持し、keyは `irish`、`british`、`other`、`unclassified` です。Gastropub等の特徴はタグで表します。

公開APIは `is_published = TRUE` の店舗だけを取得し、DB行を直接返さず共有 `Pub` DTOへ変換・検証します。Production Neonでは `pubs.id` と `tags.id` がUUIDかつNOT NULLでDB DEFAULTなしです。`pubs.is_published` はNOT NULLで既定値は `FALSE` です。公開DTOで必須の住所、座標、地域、状態、Pub Typeは物理Schema上nullableの列を含みます。ApplicationのPublication Validationで公開条件を確認し、Repositoryが公開DTOを検証します。型とフィールドの詳細は[店舗データ仕様](data.md)を参照してください。

`locale` は `TEXT` で保持し、翻訳テーブルのCHECK制約と共有locale定義により `ja` / `en` に限定します。要求localeを優先し、翻訳がない場合は既定localeの `ja` へフォールバックします。localeを追加するときは共有定義、入力Validation、フォールバック、関連するDB制約を同じ変更で更新します。

## Resource間の整合性

店舗とタグの関連、翻訳の親子関係、ContentやQuizの画像参照は外部キーで整合させます。親Resource削除時は翻訳・中間行を必要に応じてCASCADE削除します。Media Assetを参照するContentやQuizの画像列は、参照先削除時にNULLへ戻します。都道府県、市区町村、営業状態などマスタを参照する店舗にはCASCADE削除を設定しません。使用中のタグ削除はApplication側で拒否します。

公開条件など複数テーブルにまたがる業務ルールは、Database Constraintだけで代替せず、Application ServiceとRepositoryがtransaction内で検証します。店舗本体、翻訳、タグ関係の作成・更新は単一transactionで処理します。

## Automationの冪等性と監査

CreateのIdempotency記録は `automation_idempotency_keys` に保存します。KeyそのものではなくSHA-256 hashを一意に保存し、Request fingerprint、method、path、Resource UUID、処理状態、成功Responseと有効期限を保持します。成功結果は完了から24時間再利用できます。失敗結果は成功Responseとして保存しません。

`automation_audit_logs` はRequest ID、Scope、method、path、Resource種別・ID、action、結果、HTTP status、作成時刻を保持します。現行Schemaでは `automation_idempotency_keys.resource_id` は `UUID NOT NULL`、`automation_audit_logs.resource_id` はnullable `UUID` で、Resourceへの外部キーはありません。Resource削除後も監査記録を保持します。Bearer Token、Authorization Header、Token hash、Cookie、Request/Response本文、環境変数は保存しません。

## Mediaと表示順

Media Assetは公開Blob URL、内部Storage key、MIME type、寸法、ファイルサイズを管理します。DBはID・Storage key・URLの一意性とMIME allowlistを保証します。画像は縦横8192px、総画素数4000万、4 MiBまでです。Mediaの詳細な検証と保存手順は実装および[生成済みスキーマ](../generated/database-schema.md)を参照してください。

`sort_order` は `INTEGER` とし、非負値を許可します。Choiceの表示順はQuestion内で一意です。件数上限は列型ではなくDomain Validationで表します。

## 読み書きの責務

RepositoryはSQLと物理Schemaを扱い、ServiceはPublication Validationや参照整合性などの業務条件を扱います。Route HandlerはHTTP入出力と認証・認可を担当します。管理APIは署名済み管理者Sessionを要求し、変更系Requestでは同一Originを検証します。Public API、共有DTO、Mobileの接続境界は[API仕様](api.md)と[店舗データ仕様](data.md)を参照してください。

## 関連ドキュメント

- [Production Neonから生成した物理Schema](../generated/database-schema.md)
- [店舗データ仕様](data.md)
- [管理店舗の下書き・公開設計](admin-pub-lifecycle.md)
- [タグの正規化仕様](tag-normalization.md)
- [管理タグ仕様](tag-management.md)
- [API 方針](api.md)
- [Neon migration Runbook](../runbooks/neon-migrations.md)
- [システム構成](../architecture/system-overview.md)
