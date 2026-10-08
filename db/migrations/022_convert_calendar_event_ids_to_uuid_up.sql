\set ON_ERROR_STOP on

BEGIN;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '022_convert_calendar_event_ids_to_uuid') THEN
    RAISE EXCEPTION 'migration 022_convert_calendar_event_ids_to_uuid is already applied';
  END IF;
  IF to_regclass('public.calendar_events') IS NULL
    OR to_regclass('public.calendar_event_translations') IS NULL THEN
    RAISE EXCEPTION 'calendar tables must exist before migration 022';
  END IF;
END
$migration$;

-- UUID形式は同じ値を保ち、それ以外のsemantic IDには対応表からUUIDを割り当てる。
CREATE TEMP TABLE calendar_event_id_map (
  old_id TEXT PRIMARY KEY,
  new_id UUID NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO calendar_event_id_map (old_id, new_id)
SELECT id,
  CASE
    WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid
    ELSE gen_random_uuid()
  END
FROM calendar_events;

CREATE TEMP TABLE calendar_event_migration_counts ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM calendar_events) AS events,
  (SELECT count(*) FROM calendar_event_translations) AS translations;

ALTER TABLE calendar_events ADD COLUMN id_uuid UUID;
ALTER TABLE calendar_event_translations ADD COLUMN event_id_uuid UUID;

UPDATE calendar_events AS event SET id_uuid = mapping.new_id
FROM calendar_event_id_map AS mapping WHERE event.id = mapping.old_id;
UPDATE calendar_event_translations AS translation SET event_id_uuid = mapping.new_id
FROM calendar_event_id_map AS mapping WHERE translation.event_id = mapping.old_id;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM calendar_events WHERE id_uuid IS NULL)
    OR EXISTS (SELECT 1 FROM calendar_event_translations WHERE event_id_uuid IS NULL)
    OR EXISTS (
      SELECT 1 FROM calendar_event_translations AS translation
      WHERE NOT EXISTS (SELECT 1 FROM calendar_events AS event WHERE event.id = translation.event_id)
    ) THEN
    RAISE EXCEPTION 'calendar event ID mapping is incomplete or contains orphaned translations';
  END IF;
END
$migration$;

ALTER TABLE calendar_event_translations DROP CONSTRAINT calendar_event_translations_event_id_fkey;
ALTER TABLE calendar_event_translations DROP CONSTRAINT calendar_event_translations_pkey;
ALTER TABLE calendar_events DROP CONSTRAINT calendar_events_pkey;
ALTER TABLE calendar_events DROP CONSTRAINT calendar_events_id_check;
DROP INDEX calendar_events_admin_list_idx;
DROP INDEX calendar_events_category_idx;
DROP INDEX calendar_events_published_idx;
DROP INDEX calendar_events_sort_order_idx;

ALTER TABLE calendar_event_translations DROP COLUMN event_id;
ALTER TABLE calendar_events DROP COLUMN id;
ALTER TABLE calendar_event_translations RENAME COLUMN event_id_uuid TO event_id;
ALTER TABLE calendar_events RENAME COLUMN id_uuid TO id;

ALTER TABLE calendar_events ALTER COLUMN id SET NOT NULL;
ALTER TABLE calendar_events ALTER COLUMN id DROP DEFAULT;
ALTER TABLE calendar_event_translations ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);
ALTER TABLE calendar_event_translations
  ADD CONSTRAINT calendar_event_translations_pkey PRIMARY KEY (event_id, locale);
ALTER TABLE calendar_event_translations
  ADD CONSTRAINT calendar_event_translations_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE;

CREATE INDEX calendar_events_published_idx
  ON calendar_events (sort_order, id) WHERE is_published;
CREATE INDEX calendar_events_category_idx ON calendar_events (category, sort_order, id);
CREATE INDEX calendar_events_admin_list_idx ON calendar_events (updated_at DESC, id);
CREATE INDEX calendar_events_sort_order_idx ON calendar_events (sort_order, id);

DO $migration$
DECLARE before_counts calendar_event_migration_counts%ROWTYPE;
BEGIN
  SELECT * INTO before_counts FROM calendar_event_migration_counts;
  IF (SELECT count(*) FROM calendar_events) <> before_counts.events
    OR (SELECT count(*) FROM calendar_event_translations) <> before_counts.translations
    OR EXISTS (
      SELECT 1 FROM calendar_event_translations AS translation
      WHERE NOT EXISTS (SELECT 1 FROM calendar_events AS event WHERE event.id = translation.event_id)
    ) THEN
    RAISE EXCEPTION 'calendar event row counts or translation references changed during migration';
  END IF;
END
$migration$;

INSERT INTO schema_migrations (version) VALUES ('022_convert_calendar_event_ids_to_uuid');

COMMIT;
