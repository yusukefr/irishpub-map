# タグ仕様

## 責務とデータモデル

タグの言語非依存な内部keyとlocale別の表示名を分けます。内部keyは店舗データ、検索、Importでの照合に使い、画面では要求localeの表示名を優先して日本語へフォールバックします。タグ定義とAliasの一覧は [tag-definitions.json](../../packages/shared/src/tag-definitions.json) をSource of Truthとし、一覧をこの文書へ複製しません。

Neonでは `tags` がUUIDと一意なkey、`tag_translations` がタグごとのlocale別表示名、`pub_tags` が店舗との多対多関係を保持します。表示名はlocaleごとに一意で、店舗内の同じタグ関係は重複できません。物理制約は[生成済みSchema](../generated/database-schema.md)を参照してください。

## 正規化とAlias

共有関数 [tag.ts](../../packages/shared/src/tag.ts) は前後空白を除去し、Unicode NFKCと大文字小文字を正規化します。空白とアンダースコアをハイフンへ変換し、連続するハイフンをまとめます。定義済みAliasは標準keyへ変換し、未知の値は表記だけを正規化して保持します。意味を推測した統合はしません。店舗内では正規化後に重複を除きます。

公開Repositoryは `pub_tags`、`tags`、`tag_translations` を結合し、内部keyと表示名を返します。検索・絞り込みも同じ共有正規化を使います。表示名のない未知タグは内部keyを表示できます。

## Import

[`scripts/import-pubs.mjs`](../../scripts/import-pubs.mjs) は入力タグを共有ルールと整合する形で正規化し、`tags.key` と日本語標準表示名をUPSERTして店舗関係を `pub_tags` に保存します。Importで使う標準定義もSource of Truthから参照し、keyの全一覧を文書に持ちません。

## 管理

`/admin/tags` はタグの登録、locale別表示名の更新、未使用タグの削除を提供します。タグkeyは作成時に指定し、その後変更できません。日本語名は必須、その他のサポートlocaleは任意で、空欄保存はその翻訳の削除です。keyは小文字英数字と単一ハイフンの形式、翻訳名はtrim後100文字以内です。共有Validationは [`admin-tag.ts`](../../packages/shared/src/admin-tag.ts) が担い、APIで再検証します。

作成はタグ行と翻訳を単一transactionで保存し、更新はlocaleごとのUPSERT / DELETEを単一transactionで行います。使用中のタグはAPIとUIで削除を拒否します。Repositoryはタグ行をロックして使用件数を確認し、未使用の場合のみ条件付きDELETEします。拒否時は `409` とし、店舗との関係を変更しません。店舗編集では既存タグをIDで選択し、未知のタグを自動生成しません。

管理APIのHTTP契約は[Admin Tag OpenAPI](openapi/paths/admin-tags.yaml)を参照してください。管理画面は署名済み管理セッションを要求し、書込みはOrigin一致とJSON Content-Type検証を行います。詳細な型やRepositoryのSQLをここへ複製しません。
