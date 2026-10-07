\set ON_ERROR_STOP on

BEGIN;

DO $migration$
DECLARE
  target_table TEXT;
  has_unknown_locale BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '020_unify_translation_locale_checks'
  ) THEN
    RAISE EXCEPTION 'migration 020_unify_translation_locale_checks is already applied';
  END IF;

  FOREACH target_table IN ARRAY ARRAY[
    'pub_translations',
    'tag_translations',
    'prefecture_translations',
    'municipality_translations',
    'pub_status_translations'
  ] LOOP
    IF to_regclass('public.' || target_table) IS NULL THEN
      RAISE EXCEPTION '%.locale table is missing', target_table;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint AS con
      WHERE con.conrelid = to_regclass('public.' || target_table)
        AND con.conname = target_table || '_locale_check'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid, true) = 'CHECK (btrim(locale) <> ''''::text)'
    ) THEN
      RAISE EXCEPTION '%.locale CHECK constraint differs from the expected prior definition', target_table;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = target_table
        AND column_name = 'locale' AND data_type = 'text' AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION '%.locale must be TEXT NOT NULL', target_table;
    END IF;

    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I WHERE locale NOT IN (''ja'', ''en''))',
      target_table
    ) INTO STRICT has_unknown_locale;
    IF has_unknown_locale THEN
      RAISE EXCEPTION '%.locale contains an unsupported value', target_table;
    END IF;
  END LOOP;

  FOREACH target_table IN ARRAY ARRAY[
    'calendar_event_translations',
    'content_translations',
    'quiz_question_translations',
    'quiz_choice_translations'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint AS con
      WHERE con.conrelid = to_regclass('public.' || target_table)
        AND con.conname = target_table || '_locale_check'
        AND con.contype = 'c'
        AND con.convalidated
        AND pg_get_constraintdef(con.oid, true)
          = 'CHECK (locale = ANY (ARRAY[''ja''::text, ''en''::text]))'
    ) THEN
      RAISE EXCEPTION '%.locale must already allow only ja/en', target_table;
    END IF;
  END LOOP;
END
$migration$;

ALTER TABLE pub_translations
  DROP CONSTRAINT pub_translations_locale_check,
  ADD CONSTRAINT pub_translations_locale_check CHECK (locale IN ('ja', 'en'));

ALTER TABLE tag_translations
  DROP CONSTRAINT tag_translations_locale_check,
  ADD CONSTRAINT tag_translations_locale_check CHECK (locale IN ('ja', 'en'));

ALTER TABLE prefecture_translations
  DROP CONSTRAINT prefecture_translations_locale_check,
  ADD CONSTRAINT prefecture_translations_locale_check CHECK (locale IN ('ja', 'en'));

ALTER TABLE municipality_translations
  DROP CONSTRAINT municipality_translations_locale_check,
  ADD CONSTRAINT municipality_translations_locale_check CHECK (locale IN ('ja', 'en'));

ALTER TABLE pub_status_translations
  DROP CONSTRAINT pub_status_translations_locale_check,
  ADD CONSTRAINT pub_status_translations_locale_check CHECK (locale IN ('ja', 'en'));

INSERT INTO schema_migrations (version) VALUES ('020_unify_translation_locale_checks');

COMMIT;
