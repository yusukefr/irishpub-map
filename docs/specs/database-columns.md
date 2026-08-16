# 店舗テーブル定義（項目別カラム）

注意: 本書の現行スキーマは docs/specs/database-normalization.md と db/migrations/002_normalize_pub_metadata_up.sql、db/migrations/003_municipality_codes_up.sql、db/migrations/004_normalize_pub_tags_up.sql を正とします。以下に残る prefecture、tags、status の単独カラム定義は 002 適用前の一時形式です。市区町村コードとタグマスタの定義は database-normalization.md を参照してください。

## 概要

Issue #175 の移行後、Neon Postgres の `pubs` は店舗属性を独立カラムで保持します。既存の `data JSONB` テーブルは自動変換せず、[移行手順](../operations/database-migration.md) に従って明示的に移行します。

## 001移行前のDDL（履歴）

```sql
CREATE TABLE pubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (btrim(name) <> ''), kana TEXT,
  prefecture TEXT NOT NULL CHECK (btrim(prefecture) <> ''), city TEXT,
  address TEXT NOT NULL CHECK (btrim(address) <> ''),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  website_url TEXT CHECK (website_url IS NULL OR website_url ~* '^https?://'),
  google_maps_url TEXT CHECK (google_maps_url IS NULL OR google_maps_url ~* '^https?://'),
  instagram_url TEXT CHECK (instagram_url IS NULL OR instagram_url ~* '^https?://'),
  tags TEXT[] NOT NULL DEFAULT '{}' CHECK (array_position(tags, NULL) IS NULL),
  status TEXT NOT NULL CHECK (status IN ('open', 'temporarily_closed', 'closed', 'unknown')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`kana`、`city`、各 URL の空文字は `NULL` へ正規化します。URL は空文字／NULL または HTTP(S) のみ、`tags` は JSONB ではなく `TEXT[]` とします。

| カラム | 型 | NULL | 制約・用途 |
| --- | --- | --- | --- |
| `id` | UUID | 不可 | RFC 4122 UUID の主キー |
| `name` / `prefecture` / `address` | TEXT | 不可 | 空白だけは禁止 |
| `kana` / `city` | TEXT | 可 | 読み仮名・市区町村 |
| `latitude` / `longitude` | DOUBLE PRECISION | 不可 | 緯度 -90〜90、経度 -180〜180 |
| `website_url` / `google_maps_url` / `instagram_url` | TEXT | 可 | HTTP(S) URL |
| `tags` | TEXT[] | 不可 | NULL 要素禁止、GIN インデックス |
| `status` | TEXT | 不可 | `open`、`temporarily_closed`、`closed`、`unknown` |
| `updated_at` | TIMESTAMPTZ | 不可 | 既定値 `NOW()` |

インデックスは `prefecture, name`、`city`、`kana`、`status` の B-tree と `tags` の GIN を作成します。検索・並び替えは JSONB 演算子を使用しません。

## アプリケーション対応

`pub-repository` は DB ドライバーから返された値を共有 `Pub` 型へ正規化してから検証します。DB の一部行が検証できない場合は、その行を除外して除外件数をサーバーログへ記録し、有効な行を返します。全行が不正な場合は、データ修正が必要なエラーとして処理を停止します。

この処理は DB の制約による整合性を置き換えるものではなく、既存データやドライバーの返却形式の差によって公開 API 全体が失敗することを防ぐための境界処理です。
