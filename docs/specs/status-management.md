# 管理ステータス仕様

## 管理対象

`pub_statuses` はアプリケーションの型、公開表示、検索で利用するシステム定義です。管理画面では既存の `code` と `key` を読み取り専用で表示し、新規登録、key変更、削除は提供しません。

管理対象は `pub_status_translations` の表示名だけです。

- 日本語（`ja`）はtrim後必須で、100文字以内
- 英語（`en`）は任意で、入力時はtrim後100文字以内
- 英語を空欄で保存した場合は空文字を残さず、翻訳レコードを削除して未登録状態へ戻す

## データと更新

管理用DTOはDB行を直接Clientへ渡さず、次のplain objectへ変換します。

```ts
type AdminPubStatus = {
  code: number;
  key: string;
  nameJa: string;
  nameEn: string | null;
};
```

日本語のupsertと英語のupsertまたはdeleteは、1回の保存につき1つのNeon transactionで実行します。Repositoryは `pub_statuses.key` を更新するSQLを持ちません。更新本文に余分な `key` が含まれてもValidation済みDTOから除外します。

## APIと認証

- `GET /api/admin/statuses`: 日英表示名を含む管理用一覧
- `PATCH /api/admin/statuses/:code`: 既存ステータスの日英表示名更新

両方とも管理者セッションを必須とし、PATCHには既存の同一Origin検証とJSON Content-Type検証を適用します。DB未設定時は一覧を空配列として閲覧でき、更新は `503` で拒否します。存在しないcodeは `404`、Validationは `422` です。

## 公開画面への反映

公開店舗Repositoryは `pub_status_translations` を要求locale、日本語の順で参照します。そのため管理画面で変更した表示名は、次回の公開データ取得時に `statusDisplayName` へ反映されます。内部keyと共有 `PubStatus` 型は変更しません。
