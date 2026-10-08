DO $verify$
DECLARE
  constraint_record RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '022_convert_calendar_event_ids_to_uuid'
  ) THEN RAISE EXCEPTION 'migration 022 history is missing'; END IF;

  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'uuid' AND is_nullable = 'NO'
        AND (table_name, column_name) IN (
          ('calendar_events', 'id'), ('calendar_event_translations', 'event_id')
        )) <> 2 THEN
    RAISE EXCEPTION 'calendar event ID columns must be uuid not null';
  END IF;
  IF (SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'calendar_events' AND column_name = 'id') IS NOT NULL THEN
    RAISE EXCEPTION 'calendar_events.id must not have a default';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.calendar_events'::regclass AND conname = 'calendar_events_id_check'
  ) THEN RAISE EXCEPTION 'legacy text ID check remains'; END IF;

  IF EXISTS (
    SELECT 1 FROM calendar_event_translations AS translation
    WHERE NOT EXISTS (SELECT 1 FROM calendar_events AS event WHERE event.id = translation.event_id)
  ) THEN RAISE EXCEPTION 'calendar event translation has an orphaned parent'; END IF;

  SELECT conname, pg_get_constraintdef(oid) AS definition
  INTO constraint_record
  FROM pg_constraint
  WHERE conrelid = 'public.calendar_event_translations'::regclass
    AND conname = 'calendar_event_translations_event_id_fkey';
  IF NOT FOUND OR constraint_record.definition !~ '^FOREIGN KEY \(event_id\) REFERENCES calendar_events\(id\) ON DELETE CASCADE$' THEN
    RAISE EXCEPTION 'calendar event translation FK is missing or changed';
  END IF;

  IF (SELECT count(*) FROM pg_constraint
      WHERE conrelid IN ('public.calendar_events'::regclass, 'public.calendar_event_translations'::regclass)
        AND conname IN ('calendar_events_pkey', 'calendar_event_translations_pkey')) <> 2 THEN
    RAISE EXCEPTION 'calendar event primary key is missing';
  END IF;
  IF (SELECT count(*) FROM pg_indexes
      WHERE schemaname = 'public' AND indexname IN (
        'calendar_events_pkey', 'calendar_events_published_idx', 'calendar_events_category_idx',
        'calendar_events_admin_list_idx', 'calendar_events_sort_order_idx',
        'calendar_event_translations_pkey'
      )) <> 6 THEN
    RAISE EXCEPTION 'calendar event index is missing';
  END IF;
END
$verify$;

SELECT
  (SELECT count(*) FROM calendar_events) AS events,
  (SELECT count(*) FROM calendar_event_translations) AS translations;
