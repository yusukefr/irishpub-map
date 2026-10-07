\set ON_ERROR_STOP on

BEGIN;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '020_unify_sort_order_integer'
  ) THEN
    RAISE EXCEPTION 'migration 020_unify_sort_order_integer is already applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quiz_choices'
      AND column_name = 'sort_order'
      AND data_type = 'smallint'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'quiz_choices.sort_order must be a non-null SMALLINT before migration 020';
  END IF;
END
$migration$;

ALTER TABLE quiz_choices
  ALTER COLUMN sort_order TYPE INTEGER;

INSERT INTO schema_migrations (version) VALUES ('020_unify_sort_order_integer');

COMMIT;
