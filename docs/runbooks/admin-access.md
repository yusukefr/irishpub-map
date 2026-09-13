# 管理者アクセスを初期設定する

## Purpose

管理画面`/admin`を有効にするため、必要な環境変数をローカル、Preview、Productionへ安全に設定します。

## When to use

- 管理画面を初めて有効にするとき
- 管理者ID、password hash、session secretをローテーションするとき

通常の開発開始時には、管理画面を使わない限り設定不要です。

## Prerequisites

- 対象EnvironmentがLocal / Preview / Productionのどれかを明確にしている。
- password hashとsession secretを安全な方法で生成・保管できる。
- Vercel Project Settingsまたはローカル`.env.local`を操作する権限がある。

## Procedure

1. `ADMIN_USERNAME`、`ADMIN_PASSWORD_HASH`、`ADMIN_SESSION_SECRET`を同じ対象Environmentへ設定する。
2. ローカルの対話TTYで、平文passwordをargvやshell historyへ渡さずに生成する。

```bash
umask 077
node scripts/generate-admin-secrets.mjs /secure/path/admin-secrets.env
```

このscriptはpasswordを非表示入力で2回受け取り、`ADMIN_PASSWORD_HASH`を`<salt>:<base64 encoded 64-byte scrypt hash>`形式で、`ADMIN_SESSION_SECRET`をランダムなbase64url値で生成します。指定したファイルは新規作成され、mode `0600`で保存されます。既存ファイルは上書きしません。

3. 生成された2つの値を、対象Environmentの`ADMIN_PASSWORD_HASH`と`ADMIN_SESSION_SECRET`へ安全に登録する。生成ファイルをIssue、PR、Repository、CI logへ保存しない。
4. 永続化を行うEnvironmentでは、同じ対象に`DATABASE_URL`も設定する。
5. 設定後に管理画面のログインと、権限を必要とする更新操作を確認する。

3つの`ADMIN_*`変数がすべて設定されているとログインが有効になります。`DATABASE_URL`未設定時は店舗0件を表示できますが、更新は失敗します。

## Validation

- 想定したEnvironmentだけで`/admin`のログインが有効である。
- 未認証アクセスや、変数が不足するEnvironmentで管理操作が有効にならない。
- 更新を使う場合、対象DBへの書き込みが意図したEnvironmentでだけ行われる。

## Rollback / Recovery

- 誤ったEnvironmentへ設定した値は、対象を再確認してからそのEnvironmentだけで削除または置き換える。
- secret漏えいの可能性がある場合は、password hashとsession secretをローテーションし、既存sessionの影響を確認する。

## Security notes

- password、password hash、session secret、`DATABASE_URL`を出力・共有・commitしない。
- scriptは対話TTY以外では実行できず、既存の出力ファイルを上書きしない。生成後のファイルは組織のSecret管理手順に従って安全に保管・削除する。
- Production / Preview / Localの値を混用しない。

## Related docs

- [ローカル開発の開始](../setup/development.md)
- [通常デプロイ](../setup/deployment.md)
- [API specification](../specs/api.md)
