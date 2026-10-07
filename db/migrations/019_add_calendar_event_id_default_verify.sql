DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'calendar_events' AND column_name = 'id'
      AND data_type = 'text' AND is_nullable = 'NO'
      AND column_default IN ('gen_random_uuid()::text', '(gen_random_uuid())::text')
  ) THEN
    RAISE EXCEPTION 'calendar_events.id must be text with a UUID default';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '019_add_calendar_event_id_default'
  ) THEN
    RAISE EXCEPTION 'migration 019 history is missing';
  END IF;
END
$verify$;
