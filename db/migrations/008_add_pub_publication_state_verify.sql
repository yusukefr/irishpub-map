SELECT
  'publication_column' AS check_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pubs'
  AND column_name = 'is_published';

SELECT
  'unpublished_existing_pubs' AS check_name,
  COUNT(*) AS count
FROM pubs
WHERE is_published IS DISTINCT FROM TRUE;

SELECT
  'publication_migration_recorded' AS check_name,
  COUNT(*) AS count
FROM schema_migrations
WHERE version = '008_add_pub_publication_state';
