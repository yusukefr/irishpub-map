# 管理店舗の下書き・公開設計

この文書は、管理店舗のDraft / Publish業務ルールを定義します。型と入力Validationは `packages/shared/src/admin-pub.ts`、HTTP契約は[API方針](api.md)、DBの物理制約は[テーブル・カラム定義](database-columns.md)を正とします。

## 結論

- 下書き保存は「日本語店舗名」のみを必須とします。
- 公開には、日本語店舗名・日本語住所・都道府県・市区町村・緯度・経度・営業ステータスを必須とします。
- 英語翻訳、タグ、外部リンク、店舗名読みは公開条件に含めません。
- 公開用 `Pub`、管理一覧用 `AdminPubListItem`、管理詳細用 `AdminPub`、管理API入力を分離します。未完成な下書きを公開用型で表現しません。
- 公開取得と管理取得を別のRepository関数に分け、公開取得は `is_published = true` だけを返します。
- 店舗本体、翻訳、タグ関係への1回の保存操作は、Neon HTTPドライバーの非対話型トランザクション1回で処理します。
- 管理APIは署名付き管理セッションに加え、更新系リクエストの同一Origin検証を必須にします。

## DBとの境界

下書きに必要なNULL許容、公開状態、参照整合性はDBでも保持します。物理Schema、制約、Migration履歴はこの文書に重複させず、[テーブル・カラム定義](database-columns.md)と `db/migrations` を参照してください。

## 下書き保存条件

店舗を識別するための日本語店舗名だけで非公開保存できます。

下書き保存の必須項目:

```text
日本語店舗名
```

下書きで未入力を許可する項目:

```text
日本語店舗名読み、日本語住所、都道府県、市区町村、緯度、経度、営業ステータス
英語翻訳、公式サイト、Google Maps URL、Instagram URL、タグ
```

日本語店舗名は前後の空白を除去した後も1文字以上必要です。新規店舗は必ず非公開で作成し、作成APIの入力では `isPublished` を受け付けません。公開は保存後の明示操作に分離します。

未完成な情報を公開用 `Pub` 型へ混在させず、新規店舗を常に非公開にすることで一般向けAPIへの混入を防ぎます。

## 公開条件

非公開から公開へ変更する時点で、次をすべて満たす必要があります。

```text
日本語店舗名、日本語住所、都道府県コード、選択した都道府県に所属する市区町村コード
緯度、経度、営業ステータス
```

日本語店舗名読み、英語翻訳、タグ、外部リンクは公開条件に含めません。通常更新ではApplication Serviceが公開必須項目を判定し、Repositoryが参照整合性と保存条件を検証します。公開状態変更ではRepositoryが現在値と公開条件のsnapshotを検証します。

- 都道府県コードが `prefectures` に存在する。
- 市区町村コードが `municipality_codes` に存在し、選択した都道府県に所属する。
- 選択した都道府県・市区町村に、日本語へフォールバック可能な表示名が存在する。
- 営業ステータスが共有 `PubStatus` の許容値で、対応する `pub_statuses` が存在する。
- 営業ステータスに日本語表示名が存在する。
- 選択したすべてのタグIDが `tags` に存在する。タグは0件でもよい。
- 選択したタグに日本語表示名が存在する。

公開条件は複数テーブルを参照する業務ルールなのでDB制約だけに依存しません。通常更新ではApplication Serviceが入力上の必須項目を判定し、Repositoryが公開済み店舗の更新gateを適用します。公開状態変更ではRepositoryが現在値と公開条件を確認し、不足項目をまとめて返します。公開済み店舗の更新で不足項目を作る場合は `422` で拒否し、管理者の意図なしに自動で非公開へ変更しません。非公開へ戻す操作には公開条件を適用しません。

## 型とDTO

### 公開用 `Pub`

公開条件を満たす店舗だけを表します。正確な型定義と読み出しValidationは `packages/shared/src/pub.ts` を参照してください。

公開レスポンスは要求ロケールを優先し、なければ日本語へフォールバックします。英語翻訳を登録する場合は、英語名と英語住所を一組として必須にし、片方だけの翻訳行は作りません。

### 管理用DTOと入力

`AdminPubListItem` は公開・非公開の一覧と検索に必要な表示・識別子・更新日時を表し、`AdminPub` は編集に必要な日英翻訳とタグIDを含みます。どちらも未完成な下書きをNULLで表現できます。

入力はDB行やレスポンスを流用せず、`AdminPubWriteInput` を使用します。作成・通常更新では公開状態を含めず、公開切替は `SetAdminPubPublicationInput` を使う専用操作に分離します。正確な型定義とValidationは `packages/shared/src/admin-pub.ts` を参照してください。

作成・更新入力はフォーム全体のスナップショットです。`translations.en = null` は英語翻訳を削除し、`tagIds = []` はタグ関係をすべて解除します。通常更新で未指定とクリアを混同しないよう部分更新にはしません。

## Validationの責務

| レイヤー | 責務 |
| --- | --- |
| Route Handler | 認証、同一Origin、HTTPメソッド、Content-Type、JSON構文、入力サイズ |
| Application Service | Draft入力のValidation、店舗の作成・通常更新・削除のオーケストレーション、通常更新時の公開必須項目判定 |
| Repository | マスタ参照検証、店舗データのtransaction保存、公開状態変更のsnapshot確認と条件付き更新 |
| Database | 型、NULL、FK、UNIQUE、CHECKによる最低限の整合性 |

クライアント側Validationは入力支援に使いますが、保存可否の判定には使いません。公開できない場合は不足項目を一括で返し、画面が概要と各項目付近へ表示できる構造化エラーにします。

## APIとRepositoryの分離方針

取得責務を次のように分けます。

```text
公開用: getPublishedPubs(locale): Promise<Pub[]>
管理一覧: getAdminPubPage(condition, locale): Promise<AdminPubPage>
管理詳細: getAdminPub(id): Promise<AdminPub | null>
```

`getPublishedPubs` と管理取得は分離します。`getPublishedPubs` は `pubs.is_published = TRUE` をSQLで絞り込み、公開用 `Pub` として検証します。`getAdminPubPage` は公開・非公開とNULLを含む下書きを一覧DTOで返し、`getAdminPub` は日英翻訳とタグIDを含む完全な `AdminPub` を返します。

店舗の作成・通常更新・削除は `admin-pub-service.ts` のApplication Serviceを経由します。公開状態変更は専用Route Handlerから `pub-repository.ts` の `setAdminPubPublication` を直接呼び出し、公開時のsnapshot確認、Publish Validation、条件付き状態更新を行います。

| メソッド | パス | 入力・用途 |
| --- | --- | --- |
| `GET` | `/api/admin/pubs` | 公開・非公開を含む管理一覧。検索条件と50件ページングに対応 |
| `POST` | `/api/admin/pubs` | `CreateAdminPubInput`。常に非公開で作成 |
| `GET` | `/api/admin/pubs/:id` | `AdminPub` の詳細 |
| `PUT` | `/api/admin/pubs/:id` | `UpdateAdminPubInput` による全体更新。公開状態は変更せず、公開済みなら更新後のPublish Validationを行う |
| `PATCH` | `/api/admin/pubs/:id/publication` | 公開時だけPublish Validationを実行し、不足項目をまとめて返す |
| `DELETE` | `/api/admin/pubs/:id` | 店舗削除。翻訳とタグ関係はFKでカスケード削除 |

入力不正はフィールドコードを含む `422`、未認証は `401`、Origin不一致は `403`、対象なしは `404`、参照競合は `409`、DB未設定は `503` とします。エラー本文やログへ入力値、接続情報、認証情報を含めません。

## トランザクション方針

### 通常更新

公開状態を維持した店舗更新は `admin-pub-repository.ts` の `replaceAdminPub` が `sql.transaction()` 内で処理します。最初に対象店舗を `SELECT ... FOR UPDATE` でロックし、店舗本体、日英翻訳、タグrelationを同一transaction内で更新します。公開済み店舗では、更新後入力がPublish Validationを満たす場合だけ更新し、条件を満たさない場合は全体をロールバックして `422` と不足項目を返します。

英語翻訳の削除やタグ全解除も同じ更新transactionに含め、いずれかのSQLが失敗した場合はtransaction全体をロールバックします。店舗の作成も `insertAdminPub` による単一transactionで行い、店舗削除は単一の `DELETE` とFKのCASCADEで完結します。

### 公開状態変更

公開状態変更は `pub-repository.ts` の `setAdminPubPublication` が専用処理として行います。まず現在値と公開条件のsnapshotを取得し、公開へ変更する場合だけ不足項目を確認します。条件を満たす場合は、SQL側でも公開条件を再確認した条件付き `UPDATE pubs` を行います。更新できなかった場合は対象の現在状態を再取得して `404` または `422` に変換します。

非公開へ戻す場合はPublish Validationを要求しません。同じ状態への要求は `unchanged: true` として更新しません。通常更新と公開状態変更は同じtransaction／行ロック方式ではないため、両者を共通のConcurrency実装として説明しません。

## 認証・認可・CSRF

### 現状

- 管理画面と店舗管理APIは、サーバー側で署名と有効期限を検証した管理セッションを要求しています。
- Cookieは `HttpOnly; Secure; SameSite=Lax; Path=/`、有効期限は8時間です。
- 管理者は1種類でロールがないため、有効な管理セッションを更新権限と同義にしています。
- `POST` / `PUT` / `PATCH` / `DELETE` は `Origin` を必須にし、リクエスト先Originとの完全一致を検証します。不一致または欠落は `403` にします。ログイン・ログアウトも対象です。
- 同一Origin検証とSameSite Cookieを組み合わせ、現時点ではCSRF Tokenを追加していません。

- JSON更新APIは `Content-Type: application/json` を必須にします。
- クロスOriginの管理クライアントを許可する場合は、認証・CSRF対策を含めて別途設計します。
- `prefectureCode`、`municipalityCode`、`status`、`tagIds` をDBで再検証し、表示名や公開可否を信用しません。

公開APIのAPIキーは一般向け取得の保護であり、管理セッションやCSRF対策の代替にはしません。
