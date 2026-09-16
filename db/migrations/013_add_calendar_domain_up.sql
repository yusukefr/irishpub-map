\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM schema_migrations
    WHERE version = '013_add_calendar_domain'
  ) THEN
    RAISE EXCEPTION 'migration 013_add_calendar_domain is already applied';
  END IF;

  IF to_regclass('public.calendar_events') IS NOT NULL
    OR to_regclass('public.calendar_event_translations') IS NOT NULL THEN
    RAISE EXCEPTION 'calendar domain tables already exist without migration history';
  END IF;
END
$migration$;

CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY CHECK (btrim(id) <> '' AND id = btrim(id)),
  category TEXT CHECK (
    category IS NULL
    OR category IN ('public_holiday', 'culture', 'tradition', 'language', 'literature', 'history', 'religion')
  ),
  date_rule JSONB CHECK (
    date_rule IS NULL
    OR (
      jsonb_typeof(date_rule) = 'object'
      AND date_rule ? 'type'
      AND jsonb_typeof(date_rule->'type') = 'string'
      AND date_rule->>'type' IN (
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
    )
  ),
  is_public_holiday BOOLEAN NOT NULL DEFAULT FALSE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  aliases TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  source TEXT,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE calendar_event_translations (
  event_id TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('ja', 'en')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, locale)
);

CREATE INDEX calendar_events_published_idx
  ON calendar_events (sort_order, id)
  WHERE is_published;

CREATE INDEX calendar_events_category_idx
  ON calendar_events (category, sort_order, id);

CREATE INDEX calendar_events_admin_list_idx
  ON calendar_events (updated_at DESC, id);

CREATE INDEX calendar_events_sort_order_idx
  ON calendar_events (sort_order, id);

INSERT INTO schema_migrations (version)
VALUES ('013_add_calendar_domain');

COMMIT;
