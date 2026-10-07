\set ON_ERROR_STOP on

DO $verify$
DECLARE
  target_table TEXT;
  has_unknown_locale BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '021_unify_translation_locale_checks'
  ) THEN
    RAISE EXCEPTION 'migration 021 history is missing';
  END IF;

  FOREACH target_table IN ARRAY ARRAY[
    'calendar_event_translations',
    'content_translations',
    'municipality_translations',
    'prefecture_translations',
    'pub_status_translations',
    'pub_translations',
    'quiz_choice_translations',
    'quiz_question_translations',
    'tag_translations'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = target_table
        AND column_name = 'locale' AND data_type = 'text' AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION '%.locale must be TEXT NOT NULL', target_table;
    END IF;

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
      RAISE EXCEPTION '%.locale must allow only ja/en', target_table;
    END IF;

    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I WHERE locale NOT IN (''ja'', ''en''))',
      target_table
    ) INTO STRICT has_unknown_locale;
    IF has_unknown_locale THEN
      RAISE EXCEPTION '%.locale contains an unsupported value', target_table;
    END IF;
  END LOOP;
END
$verify$;
