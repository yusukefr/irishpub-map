DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pubs p
    LEFT JOIN pub_translations pt ON pt.pub_id = p.id AND pt.locale = 'ja'
    WHERE pt.pub_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Japanese pub translations are incomplete';
  END IF;

  IF EXISTS (SELECT 1 FROM pubs WHERE municipality_code IS NULL) THEN
    RAISE EXCEPTION 'Pub municipality codes are incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM prefectures p
    LEFT JOIN prefecture_translations pt ON pt.prefecture_code = p.code AND pt.locale = 'ja'
    WHERE pt.prefecture_code IS NULL
  ) THEN
    RAISE EXCEPTION 'Japanese prefecture translations are incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM municipality_codes m
    LEFT JOIN municipality_translations mt ON mt.municipality_code = m.code AND mt.locale = 'ja'
    WHERE mt.municipality_code IS NULL
  ) THEN
    RAISE EXCEPTION 'Japanese municipality translations are incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pub_statuses s
    LEFT JOIN pub_status_translations st ON st.status_code = s.code AND st.locale = 'ja'
    WHERE st.status_code IS NULL
  ) THEN
    RAISE EXCEPTION 'Japanese pub status translations are incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tags t
    LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = 'ja'
    WHERE tt.tag_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Japanese tag translations are incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tag_translations tt
    LEFT JOIN tags t ON t.id = tt.tag_id
    WHERE t.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Orphaned tag translations exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'pubs' AND column_name IN ('name', 'kana', 'city', 'address'))
        OR (table_name = 'prefectures' AND column_name IN ('name', 'kana'))
        OR (table_name = 'municipality_codes' AND column_name IN ('municipality_name', 'municipality_kana'))
        OR (table_name = 'pub_statuses' AND column_name IN ('value', 'display_name'))
        OR (table_name = 'tags' AND column_name = 'name')
      )
  ) THEN
    RAISE EXCEPTION 'Legacy localization columns remain';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '007_finalize_localization') THEN
    RAISE EXCEPTION 'Migration 007 history is missing';
  END IF;
END
$verify$;
