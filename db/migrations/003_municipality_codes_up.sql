-- リポジトリルートから psql -f db/migrations/003_municipality_codes_up.sql で実行します。
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.prefectures') IS NULL THEN
    RAISE EXCEPTION 'public.prefectures is missing; run 002_normalize_pub_metadata_up.sql first';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS municipality_codes (
  code TEXT PRIMARY KEY CHECK (code ~ '^[0-9]{6}$'),
  prefecture_code SMALLINT NOT NULL REFERENCES prefectures(code),
  prefecture_name TEXT NOT NULL CHECK (btrim(prefecture_name) <> ''),
  municipality_name TEXT,
  prefecture_kana TEXT,
  municipality_kana TEXT
);

CREATE TEMP TABLE municipality_codes_import (
  code TEXT,
  prefecture_name TEXT,
  municipality_name TEXT,
  prefecture_kana TEXT,
  municipality_kana TEXT,
  unused_column_1 TEXT,
  unused_column_2 TEXT
) ON COMMIT DROP;

\copy municipality_codes_import (code, prefecture_name, municipality_name, prefecture_kana, municipality_kana, unused_column_1, unused_column_2) FROM 'data/市区町村コード.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM municipality_codes_import
    WHERE btrim(COALESCE(code, '')) !~ '^[0-9]{6}$'
      OR btrim(COALESCE(prefecture_name, '')) = ''
      OR CASE
        WHEN btrim(COALESCE(code, '')) ~ '^[0-9]{6}$'
          THEN substring(btrim(code) FROM 1 FOR 2)::SMALLINT NOT BETWEEN 1 AND 47
        ELSE FALSE
      END
  ) THEN
    RAISE EXCEPTION '市区町村コードCSVに不正なコードまたは都道府県名があります';
  END IF;
END
$$;

INSERT INTO municipality_codes (
  code, prefecture_code, prefecture_name, municipality_name, prefecture_kana, municipality_kana
)
SELECT
  btrim(source.code),
  substring(btrim(source.code) FROM 1 FOR 2)::SMALLINT,
  btrim(source.prefecture_name),
  NULLIF(btrim(source.municipality_name), ''),
  NULLIF(btrim(source.prefecture_kana), ''),
  NULLIF(btrim(source.municipality_kana), '')
FROM municipality_codes_import AS source
ON CONFLICT (code) DO UPDATE SET
  prefecture_code = EXCLUDED.prefecture_code,
  prefecture_name = EXCLUDED.prefecture_name,
  municipality_name = EXCLUDED.municipality_name,
  prefecture_kana = EXCLUDED.prefecture_kana,
  municipality_kana = EXCLUDED.municipality_kana;

CREATE INDEX IF NOT EXISTS municipality_codes_prefecture_name_idx
  ON municipality_codes (prefecture_code, municipality_name);

COMMIT;
