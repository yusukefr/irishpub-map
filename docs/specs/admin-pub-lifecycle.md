# 管理店舗の下書き・公開設計

## 文書の位置づけ

この文書は、親Issue #264の管理画面改修に先立ち、Issue #272で確定した後続実装の設計です。2026年8月26日時点のNeon実スキーマとアプリケーション実装を基準にしています。

ここで定義する下書き用DTO、公開状態、Repository、Application Service、APIはまだ実装されていません。現行挙動は[店舗データ仕様](data.md)と[API方針](api.md)、現行の物理制約は[テーブル・カラム定義](database-columns.md)を参照してください。

## 結論

- 下書き保存は「日本語店舗名」のみを必須とします。
- 公開には、日本語店舗名・日本語住所・都道府県・市区町村・緯度・経度・営業ステータスを必須とします。
- 英語翻訳、タグ、外部リンク、店舗名読みは公開条件に含めません。
- 公開用 `PublicPub`、管理用 `AdminPub`、管理API入力を分離します。未完成な下書きを公開用型で表現しません。
- 公開取得と管理取得を別のRepository関数に分け、公開取得は `is_published = true` だけを返します。
- 店舗本体、翻訳、タグ関係への1回の保存操作は、Neon HTTPドライバーの非対話型トランザクション1回で処理します。
- 管理APIは署名付き管理セッションに加え、更新系リクエストの同一Origin検証を必須にします。

## 現行DBスキーマの確認結果

### 確認方法

ローカルの接続設定を成果物へ出力せず、Neonの `information_schema.columns`、`pg_constraint`、`pg_indexes` を読み取り専用で参照しました。対象は次の11テーブルです。

```text
pubs
pub_translations
prefectures
prefecture_translations
municipality_codes
municipality_translations
pub_statuses
pub_status_translations
tags
tag_translations
pub_tags
```

カラム、データ型、NULL、DEFAULT、主キー、外部キー、UNIQUE、CHECK、参照時動作、Indexを[テーブル・カラム定義](database-columns.md)と照合しました。

### 照合結果

実スキーマの意味上の定義は、現行の `database-columns.md` と一致しています。後続実装に影響する現行制約は次のとおりです。

| 対象                          | 現行制約                         | 下書きへの影響                     |
| ----------------------------- | -------------------------------- | ---------------------------------- |
| `pubs.prefecture_code`        | `NOT NULL`、都道府県FK           | 都道府県未入力を保存できない       |
| `pubs.municipality_code`      | NULL可、市区町村FK               | 現状でも市区町村未入力を保存できる |
| `pubs.latitude` / `longitude` | `NOT NULL`、座標範囲CHECK        | 座標未入力を保存できない           |
| `pubs.status_code`            | `NOT NULL`、営業状況FK           | ステータス未入力を保存できない     |
| `pub_translations.name`       | `NOT NULL`、空白禁止             | 日本語店舗名を必須にする方針と一致 |
| `pub_translations.address`    | `NOT NULL`、空白禁止             | 住所未入力を保存できない           |
| 外部リンク3項目               | NULL可、HTTP(S) URLのCHECK       | 下書き・公開とも任意にできる       |
| `pub_tags`                    | 店舗ID・タグIDの複合PK、両方にFK | タグ0件を許容できる                |

FKの削除動作は、店舗翻訳、各マスタ翻訳、`pub_tags` に `ON DELETE CASCADE` があり、店舗から参照される都道府県、市区町村、営業ステータスにはCASCADEがありません。すべてのFKの `ON UPDATE` はPostgres既定の `NO ACTION` です。主キー・UNIQUE由来を含むIndexも現行文書と一致しています。

`db/migrations` は段階的な正規化の履歴であり、単一ファイルでは現行スキーマを表しません。最終状態の意味は実スキーマと一致します。差異は次の履歴情報に限られます。

- `pubs`、`pub_statuses`、`tags` のカラム順には、削除済み旧カラムによる欠番があります。
- `pubs` の主キーと座標・URLのCHECK制約名には、初期移行時の `pubs_columns_new_*` が残っています。
- 空DBから現行スキーマを構築する正式な一括手順は、引き続きこのリポジトリでは提供していません。

## 下書き保存条件

案Bの「下書きでは最小限だけ必須」を採用し、店舗を識別するための日本語店舗名だけで非公開保存できるようにします。

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

この方針は、#264の「先に登録し、情報を段階的に追加する」運用を、座標や所在地が未確定の段階から実現します。未完成な情報を公開用 `Pub` 型へ無理に当てはめず、新規店舗を常に非公開にすることで一般向けAPIへの混入を防ぎます。

## 公開条件

非公開から公開へ変更する時点で、次をすべて満たす必要があります。

```text
日本語店舗名、日本語住所、都道府県コード、選択した都道府県に所属する市区町村コード
緯度、経度、営業ステータス
```

日本語店舗名読み、英語翻訳、タグ、外部リンクは公開条件に含めません。Application Serviceは文字列、座標範囲、URL形式に加えて次を検証します。

- 都道府県コードが `prefectures` に存在する。
- 市区町村コードが `municipality_codes` に存在し、選択した都道府県に所属する。
- 選択した都道府県・市区町村に、日本語へフォールバック可能な表示名が存在する。
- 営業ステータスが共有 `PubStatus` の許容値で、対応する `pub_statuses` が存在する。
- 営業ステータスに日本語表示名が存在する。
- 選択したすべてのタグIDが `tags` に存在する。タグは0件でもよい。
- 選択したタグに日本語表示名が存在する。

公開条件は複数テーブルを参照する業務ルールなのでDB制約だけに依存しません。公開状態を変更するApplication Serviceで検証し、不足項目をまとめて返します。非公開へ戻す操作には公開条件を適用しません。

## 後続マイグレーションの要件

本IssueではDDLを変更しません。後続実装ではNeon実スキーマを再確認し、少なくとも次を変更します。

| 対象 | 後続変更 |
| --- | --- |
| `pubs.is_published` | `BOOLEAN NOT NULL DEFAULT FALSE` を追加。同一マイグレーション内で既存店舗を `TRUE` にする |
| `pubs.prefecture_code` | `DROP NOT NULL` |
| `pubs.latitude` / `longitude` | `DROP NOT NULL`。NULLを許容する既存範囲CHECKは維持 |
| `pubs.status_code` | `DROP NOT NULL` |
| `pub_translations.address` | `DROP NOT NULL`。CHECKを `address IS NULL OR btrim(address) <> ''` に変更 |

`pubs.municipality_code` はすでにNULL可能なので変更不要です。`pub_translations.name` は下書きの唯一の必須表示情報として `NOT NULL` と非空CHECKを維持します。既存値は変更せず、新規NULL許可が既存データを損なわないことを検証SQLで確認します。

## 型とDTO

### 公開用 `PublicPub`

公開条件を満たす店舗だけを表します。後続移行では現在の `Pub` 利用箇所を `PublicPub` へ移し、必要な互換期間だけ `Pub` を型エイリアスとして残します。

```ts
type PublicPub = {
  id: string;
  name: string;
  kana: string | null;
  prefecture: string;
  city: string;
  municipalityCode: string;
  address: string;
  latitude: number;
  longitude: number;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  instagramUrl: string | null;
  tags: string[];
  tagDisplayNames: Record<string, string>;
  status: PubStatus;
  statusDisplayName: string;
};
```

公開レスポンスは要求ロケールを優先し、なければ日本語へフォールバックします。英語翻訳を登録する場合は、英語名と英語住所を一組として必須にし、片方だけの翻訳行は作りません。

### 管理用 `AdminPub`

DBのコードと翻訳を編集可能な形で返し、未完成な下書きをNULLで表現します。

```ts
type AdminPubTranslation = {
  name: string;
  nameReading: string | null;
  address: string | null;
};

type AdminPub = {
  id: string;
  isPublished: boolean;
  prefectureCode: number | null;
  municipalityCode: string | null;
  latitude: number | null;
  longitude: number | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  instagramUrl: string | null;
  status: PubStatus | null;
  translations: { ja: AdminPubTranslation; en: AdminPubTranslation | null };
  tagIds: string[];
  updatedAt: string;
};
```

### 作成・更新入力

入力はDB行やレスポンスを流用しません。作成・通常更新では公開状態を含めず、公開切替専用操作に分離します。

```ts
type AdminPubWriteInput = Omit<AdminPub, "id" | "isPublished" | "updatedAt">;
type CreatePubInput = AdminPubWriteInput;
type UpdatePubInput = AdminPubWriteInput;
type SetPubPublicationInput = { isPublished: boolean };
```

作成・更新入力はフォーム全体のスナップショットです。`translations.en = null` は英語翻訳を削除し、`tagIds = []` はタグ関係をすべて解除します。通常更新で未指定とクリアを混同しないよう部分更新にはしません。

## Validationの責務

| レイヤー            | 責務                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| Route Handler       | 認証、同一Origin、HTTPメソッド、Content-Type、JSON構文、入力サイズ    |
| Application Service | Draft / Publish Validation、マスタ存在、市区町村の所属、公開状態遷移  |
| Repository          | コードとIDをパラメータ化クエリへ変換し、1操作をトランザクションで保存 |
| Database            | 型、NULL、FK、UNIQUE、CHECKによる最低限の整合性                       |

クライアント側Validationは入力支援に使いますが、保存可否の判定には使いません。公開できない場合は不足項目を一括で返し、画面が概要と各項目付近へ表示できる構造化エラーにします。

## APIとRepositoryの分離方針

取得責務を次のように分けます。

```text
公開用: getPublishedPubs(locale): Promise<PublicPub[]>
管理用: getAdminPubs(): Promise<AdminPub[]>
管理詳細: getAdminPub(id): Promise<AdminPub | null>
```

`getPublishedPubs` は `pubs.is_published = TRUE` をSQLで絞り込み、公開必須項目を内部JOINして検証します。条件を満たさない行が万一存在した場合は公開レスポンスから除外し、行内容を含めず件数をログへ記録します。管理取得は公開・非公開の両方をNULL許容の `AdminPub` として返し、公開用関数を流用しません。

Route HandlerからRepositoryへ直接業務ルールを持ち込まず、`createAdminPub`、`updateAdminPub`、`setAdminPubPublication`、`deleteAdminPub` というApplication Serviceを境界にします。

| メソッド | パス                              | 入力・用途                                            |
| -------- | --------------------------------- | ----------------------------------------------------- |
| `GET`    | `/api/admin/pubs`                 | 公開・非公開を含む管理一覧                            |
| `POST`   | `/api/admin/pubs`                 | `CreatePubInput`。常に非公開で作成                    |
| `GET`    | `/api/admin/pubs/:id`             | `AdminPub` の詳細                                     |
| `PUT`    | `/api/admin/pubs/:id`             | `UpdatePubInput` による全体更新。公開状態は変更しない |
| `PATCH`  | `/api/admin/pubs/:id/publication` | 公開時だけPublish Validationを実行                    |
| `DELETE` | `/api/admin/pubs/:id`             | 店舗削除。翻訳とタグ関係はFKでカスケード削除          |

入力不正はフィールドコードを含む `422`、未認証は `401`、Origin不一致は `403`、対象なしは `404`、参照競合は `409`、DB未設定は `503` とします。エラー本文やログへ入力値、接続情報、認証情報を含めません。

## トランザクション方針

使用中の `@neondatabase/serverless` 1.1.0は、`sql.transaction()` による単一の非対話型Postgresトランザクションを提供します。店舗作成・更新では `pubs` のINSERT / UPDATE、`pub_translations` のUPSERT / DELETE、`pub_tags` のDELETE / INSERTを同じトランザクションへ含めます。

- `sql.transaction(tx => [...], { isolationLevel: "ReadCommitted" })` を使います。
- UUIDはApplication Serviceで先に生成し、後続SQLが前のSQL結果へ依存しない形にします。
- マスタ存在・所属関係は保存前に検証し、保存時もFKを最終防衛線にします。
- 更新対象の存在確認と行ロックを同じトランザクションに含めます。対象なしなら関連クエリを無操作にし、結果から `404` を返します。
- 値はすべてタグ付きテンプレートのパラメータとして渡し、外部入力から動的SQLを構築しません。
- いずれかが失敗した場合は全体をロールバックし、部分保存を残しません。

英語翻訳の削除やタグ全解除も同じ更新トランザクションに含めます。店舗削除は単一の `DELETE` とFKのCASCADEで完結します。

## 認証・認可・CSRF

### 現状

- 管理画面と店舗管理APIは、サーバー側で署名と有効期限を検証した管理セッションを要求しています。
- Cookieは `HttpOnly; Secure; SameSite=Lax; Path=/`、有効期限は8時間です。
- 管理者は1種類でロールがないため、有効な管理セッションを更新権限と同義にしています。
- 更新APIはセッションを検証しますが、Origin / Referer検証とCSRF Tokenはありません。

### 後続実装の必須方針

- すべての `/api/admin/*` は共通のサーバー側認証関数を通します。
- `POST` / `PUT` / `PATCH` / `DELETE` は `Origin` を必須にし、リクエスト先Originとの完全一致を検証します。不一致または欠落は `403` にします。
- 管理Cookieは `SameSite=Strict` へ強化し、`HttpOnly`、`Secure`、署名、有効期限を維持します。
- JSON更新APIは `Content-Type: application/json` を必須にします。
- 同一Origin検証とSameSite Cookieを組み合わせ、初期実装ではCSRF Tokenを追加しません。クロスOriginの管理クライアントを許可する場合は別途設計します。
- ログイン・ログアウトもCookie状態を変えるため同一Origin検証の対象にします。
- `prefectureCode`、`municipalityCode`、`status`、`tagIds` をDBで再検証し、表示名や公開可否を信用しません。

公開APIのAPIキーは一般向け取得の保護であり、管理セッションやCSRF対策の代替にはしません。

## 後続Issueの実装順序

1. `is_published` と下書き用NULL制約を安全なマイグレーションで追加する。
2. `PublicPub` / `AdminPub` / 入力DTOとDraft / Publish Validationを実装する。
3. `getPublishedPubs` と管理取得を分離し、公開APIのSQL絞り込みを追加する。
4. 共通の管理認証・同一Origin検証を追加する。
5. Application Serviceとトランザクションを使う管理更新APIを実装する。
6. 管理画面の一覧、フォーム、タグ、ステータス管理を実装する。

各後続Issueでコード、対応テスト、DB・API・プロダクト仕様を同じPR内で同期します。
