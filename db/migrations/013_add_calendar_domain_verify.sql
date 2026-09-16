SELECT
  'calendar_columns' AS check_name,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('calendar_events', 'calendar_event_translations')
ORDER BY table_name, ordinal_position;

SELECT
  'calendar_constraints' AS check_name,
  relation.relname AS table_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint AS con
JOIN pg_class AS relation ON relation.oid = con.conrelid
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relname IN ('calendar_events', 'calendar_event_translations')
ORDER BY relation.relname, con.conname;

SELECT
  'calendar_indexes' AS check_name,
  tablename AS table_name,
  indexname AS index_name,
  indexdef AS definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('calendar_events', 'calendar_event_translations')
ORDER BY tablename, indexname;

SELECT
  'invalid_calendar_ids' AS check_name,
  COUNT(*) AS count
FROM calendar_events
WHERE btrim(id) = '' OR id <> btrim(id);

SELECT
  'invalid_calendar_categories' AS check_name,
  COUNT(*) AS count
FROM calendar_events
WHERE category IS NOT NULL
  AND category NOT IN ('public_holiday', 'culture', 'tradition', 'language', 'literature', 'history', 'religion');

SELECT
  'invalid_calendar_date_rules' AS check_name,
  COUNT(*) AS count
FROM calendar_events
WHERE date_rule IS NOT NULL
  AND (
    jsonb_typeof(date_rule) <> 'object'
    OR NOT (date_rule ? 'type')
    OR jsonb_typeof(date_rule->'type') IS DISTINCT FROM 'string'
    OR date_rule->>'type' NOT IN (
      'fixed',
      'date_range',
      'nth_weekday',
      'last_weekday',
      'relative_to_easter',
      'weekday_on_or_after',
      'closest_weekday_to_date',
      'rule_set',
      'annual_variable'
    )
  );

SELECT
  'invalid_calendar_sort_order' AS check_name,
  COUNT(*) AS count
FROM calendar_events
WHERE sort_order < 0;

SELECT
  'unsupported_calendar_locales' AS check_name,
  COUNT(*) AS count
FROM calendar_event_translations
WHERE locale NOT IN ('ja', 'en');

SELECT
  'orphan_calendar_translations' AS check_name,
  COUNT(*) AS count
FROM calendar_event_translations AS translation
LEFT JOIN calendar_events AS event ON event.id = translation.event_id
WHERE event.id IS NULL;

SELECT
  'calendar_domain_migration_recorded' AS check_name,
  COUNT(*) AS count
FROM schema_migrations
WHERE version = '013_add_calendar_domain';
