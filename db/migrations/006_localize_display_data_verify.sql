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

  IF (SELECT COUNT(*) FROM prefecture_translations WHERE locale = 'ja') <> (SELECT COUNT(*) FROM prefectures) THEN
    RAISE EXCEPTION 'Japanese prefecture translation count does not match prefectures';
  END IF;

  IF (SELECT COUNT(*) FROM municipality_translations WHERE locale = 'ja') <>
    (SELECT COUNT(*) FROM municipality_codes WHERE NULLIF(btrim(municipality_name), '') IS NOT NULL) THEN
    RAISE EXCEPTION 'Japanese municipality translation count does not match named municipality codes';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tags t
    LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = 'ja'
    WHERE tt.tag_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Japanese tag translations are incomplete';
  END IF;

  IF EXISTS (SELECT 1 FROM pubs WHERE municipality_code IS NULL) THEN
    RAISE EXCEPTION 'Pub municipality codes are incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pub_statuses s
    LEFT JOIN pub_status_translations st ON st.status_code = s.code AND st.locale = 'ja'
    WHERE st.status_code IS NULL
  ) THEN
    RAISE EXCEPTION 'Japanese pub status translations are incomplete';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '006_localize_display_data') THEN
    RAISE EXCEPTION 'Migration 006 history is missing';
  END IF;
END
$verify$;
