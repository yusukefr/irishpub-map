# 店舗テーブル定義（現行スキーマ）

## 概要

Neon Postgresの `pubs` は店舗の基本属性を独立カラムで保持します。都道府県、営業状況、タグ、市区町村コードは正規化されたマスタ／関係テーブルと組み合わせて公開APIの `Pub` 形式へ変換します。

現行定義の根拠は `apps/web/app/lib/pub-repository.ts`、`db/migrations/002_normalize_pub_metadata_up.sql`、`db/migrations/004_normalize_pub_tags_up.sql` です。旧JSONB構成からの移行は[店舗テーブル移行手順](../operations/database-migration.md)を参照してください。

## `pubs` のDDL

```sql
CREATE TABLE pubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  kana TEXT,
  prefecture_code SMALLINT NOT NULL REFERENCES prefectures(code),
  city TEXT,
  address TEXT NOT NULL CHECK (btrim(address) <> ''),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  website_url TEXT CHECK (website_url IS NULL OR website_url ~* '^https?://'),
  google_maps_url TEXT CHECK (google_maps_url IS NULL OR google_maps_url ~* '^https?://'),
  instagram_url TEXT CHECK (instagram_url IS NULL OR instagram_url ~* '^https?://'),
  status_code SMALLINT NOT NULL REFERENCES pub_statuses(code),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## カラム

| カラム | 型 | NULL | 制約・用途 |
| --- | --- | --- | --- |
| `id` | UUID | 不可 | RFC 4122 UUIDの主キー |
| `name` | TEXT | 不可 | 空白だけは禁止 |
| `kana` | TEXT | 可 | 店舗名の読み。空文字はアプリでNULLへ正規化 |
| `prefecture_code` | SMALLINT | 不可 | `prefectures.code` を参照 |
| `city` | TEXT | 可 | 市区町村名。空文字はアプリでNULLへ正規化 |
| `address` | TEXT | 不可 | 空白だけは禁止 |
| `latitude` / `longitude` | DOUBLE PRECISION | 不可 | 緯度-90〜90、経度-180〜180 |
| `website_url` / `google_maps_url` / `instagram_url` | TEXT | 可 | NULLまたはHTTP(S) URL |
| `status_code` | SMALLINT | 不可 | `pub_statuses.code` を参照 |
| `updated_at` | TIMESTAMPTZ | 不可 | 既定値 `NOW()`。更新時にアプリが更新 |

タグは `pubs` の配列カラムには保存しません。`tags` と `pub_tags` の関係を取得時に配列へ集約します。`municipalityCode` も `pubs` には保存せず、`prefecture_code` と `city` が一致する `municipality_codes` から解決します。

## インデックス

アプリと移行SQLは、次の検索・並び替え用B-treeインデックスを作成します。

- `prefecture_code, name`
- `city`
- `kana`
- `status_code`

タグの逆引きには `pub_tags(tag_id)` を使用します。002から移行したDBには `prefecture_code, name` の同等インデックスが旧名 `pubs_prefecture_name_idx` で残る場合があります。アプリが新規作成する名前は `pubs_prefecture_code_name_idx` です。

## アプリケーション境界

`pub-repository` はDBドライバーの値を共有 `Pub` 型へ正規化して検証します。一部の行だけが不正な場合はその行を除外して件数をサーバーログへ記録し、全行が不正な場合はエラーにします。この境界処理はDB制約の代替ではありません。
