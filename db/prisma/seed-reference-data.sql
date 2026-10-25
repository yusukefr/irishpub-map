\set ON_ERROR_STOP on

BEGIN;

-- This seed is for an empty application database. Never use it to copy live data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pubs)
    OR EXISTS (SELECT 1 FROM tags)
    OR EXISTS (SELECT 1 FROM quiz_questions)
    OR EXISTS (SELECT 1 FROM content_entries)
    OR EXISTS (SELECT 1 FROM media_assets)
    OR EXISTS (SELECT 1 FROM calendar_events)
    OR EXISTS (SELECT 1 FROM automation_audit_logs)
    OR EXISTS (SELECT 1 FROM automation_idempotency_keys) THEN
    RAISE EXCEPTION 'reference-data seed requires an empty application database';
  END IF;
END
$$;

CREATE TEMP TABLE municipality_codes_seed (
  code TEXT,
  prefecture_name TEXT,
  municipality_name TEXT,
  prefecture_kana TEXT,
  municipality_kana TEXT,
  unused_column_1 TEXT,
  unused_column_2 TEXT
) ON COMMIT DROP;

-- The CSV is the public municipality-code source described in
-- docs/development/prisma-baseline.md. Keep its six-digit codes as text.
\copy municipality_codes_seed (code, prefecture_name, municipality_name, prefecture_kana, municipality_kana, unused_column_1, unused_column_2) FROM 'data/市区町村コード.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM municipality_codes_seed)
    OR EXISTS (
      SELECT 1
      FROM municipality_codes_seed
      WHERE btrim(COALESCE(code, '')) !~ '^[0-9]{6}$'
        OR btrim(COALESCE(prefecture_name, '')) = ''
        OR btrim(COALESCE(prefecture_kana, '')) = ''
        OR (NULLIF(btrim(municipality_name), '') IS NOT NULL AND btrim(COALESCE(municipality_kana, '')) = '')
    )
    OR EXISTS (
      SELECT 1
      FROM municipality_codes_seed
      GROUP BY btrim(code)
      HAVING COUNT(*) > 1
    )
    OR EXISTS (
      SELECT 1
      FROM municipality_codes_seed seed
      WHERE substring(btrim(seed.code) FROM 1 FOR 2)::SMALLINT NOT BETWEEN 1 AND 47
        OR EXISTS (
          SELECT 1
          FROM municipality_codes_seed other
          WHERE substring(btrim(other.code) FROM 1 FOR 2) = substring(btrim(seed.code) FROM 1 FOR 2)
            AND (btrim(other.prefecture_name) <> btrim(seed.prefecture_name)
              OR btrim(other.prefecture_kana) <> btrim(seed.prefecture_kana))
        )
    ) THEN
    RAISE EXCEPTION 'municipality-code CSV is empty, malformed, duplicated, or has inconsistent prefecture names';
  END IF;
END
$$;

INSERT INTO prefectures (code)
SELECT DISTINCT substring(btrim(code) FROM 1 FOR 2)::SMALLINT
FROM municipality_codes_seed
ON CONFLICT (code) DO NOTHING;

INSERT INTO prefecture_translations (prefecture_code, locale, name, name_reading)
SELECT DISTINCT substring(btrim(code) FROM 1 FOR 2)::SMALLINT, 'ja', btrim(prefecture_name), NULLIF(btrim(prefecture_kana), '')
FROM municipality_codes_seed
ON CONFLICT (prefecture_code, locale) DO UPDATE
SET name = EXCLUDED.name, name_reading = EXCLUDED.name_reading;

INSERT INTO municipality_codes (code, prefecture_code)
SELECT btrim(code), substring(btrim(code) FROM 1 FOR 2)::SMALLINT
FROM municipality_codes_seed
ON CONFLICT (code) DO UPDATE SET prefecture_code = EXCLUDED.prefecture_code;

INSERT INTO municipality_translations (municipality_code, locale, name, name_reading)
SELECT btrim(code), 'ja', btrim(municipality_name), NULLIF(btrim(municipality_kana), '')
FROM municipality_codes_seed
WHERE NULLIF(btrim(municipality_name), '') IS NOT NULL
ON CONFLICT (municipality_code, locale) DO UPDATE
SET name = EXCLUDED.name, name_reading = EXCLUDED.name_reading;

INSERT INTO pub_statuses (code, key) VALUES
  (1, 'open'),
  (2, 'temporarily_closed'),
  (3, 'closed'),
  (4, 'unknown')
ON CONFLICT (code) DO UPDATE SET key = EXCLUDED.key;

INSERT INTO pub_status_translations (status_code, locale, display_name) VALUES
  (1, 'ja', '営業中'), (1, 'en', 'Open'),
  (2, 'ja', '一時休業'), (2, 'en', 'Temporarily closed'),
  (3, 'ja', '閉店'), (3, 'en', 'Closed'),
  (4, 'ja', '不明'), (4, 'en', 'Unknown')
ON CONFLICT (status_code, locale) DO UPDATE SET display_name = EXCLUDED.display_name;

INSERT INTO pub_types (code, key) VALUES
  (1, 'irish'),
  (2, 'british'),
  (3, 'other'),
  (4, 'unclassified')
ON CONFLICT (code) DO UPDATE SET key = EXCLUDED.key;

INSERT INTO pub_type_translations (pub_type_code, locale, display_name) VALUES
  (1, 'ja', 'アイリッシュパブ'), (1, 'en', 'Irish Pub'),
  (2, 'ja', 'ブリティッシュパブ'), (2, 'en', 'British Pub'),
  (3, 'ja', 'その他のパブ'), (3, 'en', 'Other Pub'),
  (4, 'ja', '未分類'), (4, 'en', 'Unclassified')
ON CONFLICT (pub_type_code, locale) DO UPDATE SET display_name = EXCLUDED.display_name;

COMMIT;
