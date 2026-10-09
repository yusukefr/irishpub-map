\set ON_ERROR_STOP on

DO $verify$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '024_add_pub_types') THEN
    RAISE EXCEPTION 'migration 024_add_pub_types history is missing';
  END IF;
  IF to_regclass('public.pub_types') IS NULL OR to_regclass('public.pub_type_translations') IS NULL THEN
    RAISE EXCEPTION 'Pub Type master tables are missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pubs'
      AND column_name = 'pub_type_code' AND data_type = 'smallint' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'pubs.pub_type_code must be a nullable SMALLINT';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pubs'::regclass
      AND conname = 'pubs_pub_type_code_fkey'
      AND contype = 'f' AND confrelid = 'public.pub_types'::regclass AND convalidated
  ) THEN
    RAISE EXCEPTION 'pubs.pub_type_code foreign key is missing or invalid';
  END IF;
  IF (SELECT COUNT(*) FROM pub_types) <> 4
    OR EXISTS (
      SELECT 1 FROM (VALUES (1, 'irish'), (2, 'british'), (3, 'other'), (4, 'unclassified')) AS expected(code, key)
      WHERE NOT EXISTS (SELECT 1 FROM pub_types actual WHERE actual.code = expected.code AND actual.key = expected.key)
    ) THEN
    RAISE EXCEPTION 'Pub type master rows are invalid';
  END IF;
  IF (SELECT COUNT(*) FROM pub_type_translations) <> 8
    OR EXISTS (
      SELECT 1 FROM pub_types type CROSS JOIN (VALUES ('ja'), ('en')) AS locale(code)
      WHERE NOT EXISTS (
        SELECT 1 FROM pub_type_translations translation
        WHERE translation.pub_type_code = type.code AND translation.locale = locale.code
          AND btrim(translation.display_name) <> ''
      )
    ) THEN
    RAISE EXCEPTION 'Pub type translations are incomplete';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pubs pub
    WHERE pub.pub_type_code IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM pub_types type WHERE type.code = pub.pub_type_code)
  ) THEN
    RAISE EXCEPTION 'Pub type foreign key coverage is invalid';
  END IF;
  IF EXISTS (SELECT 1 FROM pubs WHERE is_published AND pub_type_code IS NULL) THEN
    RAISE EXCEPTION 'Published pubs must have a type';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tags WHERE key = 'gastropub')
    OR EXISTS (
      SELECT 1 FROM tags tag CROSS JOIN (VALUES ('ja'), ('en')) AS locale(code)
      WHERE tag.key = 'gastropub'
        AND NOT EXISTS (
          SELECT 1 FROM tag_translations translation
          WHERE translation.tag_id = tag.id AND translation.locale = locale.code AND btrim(translation.name) <> ''
        )
    ) THEN
    RAISE EXCEPTION 'Gastropub tag translations are incomplete';
  END IF;
END
$verify$;
