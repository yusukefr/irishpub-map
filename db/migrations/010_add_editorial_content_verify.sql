SELECT
  'content_entry_columns' AS check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'content_entries'
ORDER BY ordinal_position;

SELECT
  'content_translation_columns' AS check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'content_translations'
ORDER BY ordinal_position;

SELECT
  'content_entry_constraints' AS check_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint AS con
JOIN pg_class AS relation
  ON relation.oid = con.conrelid
WHERE relation.relname = 'content_entries'
ORDER BY con.conname;

SELECT
  'content_translation_constraints' AS check_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint AS con
JOIN pg_class AS relation
  ON relation.oid = con.conrelid
WHERE relation.relname = 'content_translations'
ORDER BY con.conname;

SELECT
  'unsupported_translation_locales' AS check_name,
  COUNT(*) AS count
FROM content_translations
WHERE locale NOT IN ('ja', 'en');

SELECT
  'orphan_content_translations' AS check_name,
  COUNT(*) AS count
FROM content_translations AS translation
LEFT JOIN content_entries AS entry
  ON entry.id = translation.content_id
WHERE entry.id IS NULL;

SELECT
  'editorial_content_migration_recorded' AS check_name,
  COUNT(*) AS count
FROM schema_migrations
WHERE version = '010_add_editorial_content';
