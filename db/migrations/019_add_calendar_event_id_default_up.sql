\set ON_ERROR_STOP on

BEGIN;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '019_add_calendar_event_id_default'
  ) THEN
    RAISE EXCEPTION 'migration 019_add_calendar_event_id_default is already applied';
  END IF;

  IF to_regclass('public.calendar_events') IS NULL THEN
    RAISE EXCEPTION 'calendar_events must exist before migration 019';
  END IF;
END
$migration$;

ALTER TABLE calendar_events
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

INSERT INTO schema_migrations (version) VALUES ('019_add_calendar_event_id_default');

COMMIT;
