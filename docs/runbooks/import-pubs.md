# Pubを一括Importする

## Purpose

`scripts/import-pubs.mjs`で、JSON形式の店舗データを既存のNeon schemaへ追加します。この処理はテーブルや参照データを作成しません。

## When to use

- 検証済みの店舗データをProductionまたはPreview DBへ追加するとき
- 同じ入力を再実行して、未追加の店舗だけを反映したいとき

通常のローカル開発開始時には実行しません。

## Prerequisites

- 対象DBに現行schema、都道府県、営業状況、市区町村の参照データがある。
- 入力は`packages/shared`の`Pub`型に対応するJSON配列であり、各`id`が一意である。
- 対象がProductionかPreviewかを実行前に確認している。
- 接続文字列を安全な一時環境変数として利用でき、値をshell history、リポジトリ、Issue、PRへ残さない。

空DBからのschema構築手順はこのRunbookの対象外です。先に[Database specification](../specs/database.md)と[Neon migration Runbook](neon-migrations.md)を確認します。

## Procedure

1. 入力JSONのpathと、対象環境がProduction / Previewのどちらかを確認する。
2. 接続文字列を安全に読み込んだ一時環境変数を使い、対象ごとに実行する。

```bash
DATABASE_URL="$NEON_PRODUCTION_DATABASE_URL" npm run import-pubs -- path/to/pubs.json
```

```bash
DATABASE_URL="$NEON_PREVIEW_DATABASE_URL" npm run import-pubs -- path/to/pubs.json
```

引数を省略した場合だけ、リポジトリrootの`pubs.json`を読み込みます。`id`が既に存在する店舗は更新せずにskipするため、同じ入力の再実行は追加済み店舗を変更しません。

## Validation

- 結果の`Imported`、`skipped`、`total`が意図した件数であることを確認する。
- 無効な入力または入力内の重複`id`では、DB書き込み前にエラーとなることを確認する。
- 対象DBの管理画面または読み取り専用queryで、追加結果と公開状態を確認する。
- 新規店舗はDB既定値により非公開となるため、公開する場合は別途公開状態を確認する。

## Security notes

- `DATABASE_URL`や投入データに含まれる非公開情報を出力、commit、共有しない。
- ProductionとPreviewへ同じデータを投入する必要がある場合も、接続先を1回ずつ確認して個別に実行する。
- Importは書き込み操作です。誤った環境や入力を指定した場合は停止し、対象DBと実行結果を確認してから回復手順を判断する。

## Related docs

- [ローカル開発の開始](../setup/development.md)
- [Database specification](../specs/database.md)
- [Neon migrationを適用する](neon-migrations.md)
