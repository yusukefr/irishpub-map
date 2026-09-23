SELECT
  'media_assets_columns' AS check_name,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'media_assets'
ORDER BY ordinal_position;

SELECT
  'media_assets_constraints' AS check_name,
  constraint_name,
  constraint_type,
  pg_get_constraintdef(constraint_oid) AS definition
FROM (
  SELECT constraint_row.conname AS constraint_name,
    CASE constraint_row.contype
      WHEN 'p' THEN 'PRIMARY KEY'
      WHEN 'u' THEN 'UNIQUE'
      WHEN 'c' THEN 'CHECK'
      WHEN 'f' THEN 'FOREIGN KEY'
      ELSE constraint_row.contype::TEXT
    END AS constraint_type,
    constraint_row.oid AS constraint_oid
  FROM pg_constraint AS constraint_row
  JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'media_assets'
) AS media_constraints
ORDER BY constraint_name;

SELECT
  'media_assets_indexes' AS check_name,
  indexname AS index_name,
  indexdef AS definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'media_assets'
ORDER BY indexname;

SELECT
  'media_assets_invalid_rows' AS check_name,
  COUNT(*) FILTER (WHERE mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp')) AS invalid_mime,
  COUNT(*) FILTER (WHERE width NOT BETWEEN 1 AND 8192) AS invalid_width,
  COUNT(*) FILTER (WHERE height NOT BETWEEN 1 AND 8192) AS invalid_height,
  COUNT(*) FILTER (WHERE file_size NOT BETWEEN 1 AND 4194304) AS invalid_file_size,
  COUNT(*) FILTER (WHERE width::BIGINT * height::BIGINT > 40000000) AS invalid_pixel_count
FROM media_assets;

SELECT
  'media_assets_migration_recorded' AS check_name,
  COUNT(*) AS count
FROM schema_migrations
WHERE version = '014_add_media_assets';
