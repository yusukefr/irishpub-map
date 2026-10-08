\set ON_ERROR_STOP on

BEGIN;

DO $migration$
DECLARE
  target_table TEXT;
  default_expression TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '023_remove_resource_uuid_defaults'
  ) THEN
    RAISE EXCEPTION 'migration 023_remove_resource_uuid_defaults is already applied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '022_convert_calendar_event_ids_to_uuid'
  ) THEN
    RAISE EXCEPTION 'migration 022_convert_calendar_event_ids_to_uuid must be applied first';
  END IF;

  FOREACH target_table IN ARRAY ARRAY['pubs', 'tags', 'content_entries'] LOOP
    IF to_regclass('public.' || target_table) IS NULL THEN
      RAISE EXCEPTION 'public.% is missing', target_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = target_table
        AND column_name = 'id' AND data_type = 'uuid' AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION 'public.%.id must be UUID NOT NULL', target_table;
    END IF;

    SELECT column_default INTO default_expression
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = target_table AND column_name = 'id';
    IF default_expression IS NULL
      OR default_expression NOT IN ('gen_random_uuid()', '(gen_random_uuid())') THEN
      RAISE EXCEPTION 'public.%.id does not have the expected UUID default', target_table;
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
$migration$;

ALTER TABLE pubs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE tags ALTER COLUMN id DROP DEFAULT;
ALTER TABLE content_entries ALTER COLUMN id DROP DEFAULT;

INSERT INTO schema_migrations (version) VALUES ('023_remove_resource_uuid_defaults');

COMMIT;
