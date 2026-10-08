DO $verify$
DECLARE
  target_table TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '023_remove_resource_uuid_defaults'
  ) THEN
    RAISE EXCEPTION 'migration 023_remove_resource_uuid_defaults history is missing';
  END IF;

  FOREACH target_table IN ARRAY ARRAY['pubs', 'tags', 'content_entries'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = target_table
        AND column_name = 'id' AND data_type = 'uuid' AND is_nullable = 'NO'
        AND column_default IS NULL
    ) THEN
      RAISE EXCEPTION 'public.%.id must be UUID NOT NULL with no default', target_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = to_regclass('public.' || target_table)
        AND contype = 'p' AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
    ) THEN
      RAISE EXCEPTION 'public.%.id primary key is missing', target_table;
    END IF;
  END LOOP;
END
$verify$;

SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('pubs', 'tags', 'content_entries')
  AND column_name = 'id'
ORDER BY table_name;
