\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE
  migration_version CONSTANT TEXT := '014_convert_quiz_question_ids_to_uuid';
  question_id_type TEXT;
  question_translation_id_type TEXT;
  choice_question_id_type TEXT;
  choice_translation_question_id_type TEXT;
  already_applied BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = migration_version
  ) INTO already_applied;

  IF already_applied THEN
    RAISE EXCEPTION 'Migration % is already applied.', migration_version;
  END IF;

  IF to_regclass('public.quiz_questions') IS NULL
    OR to_regclass('public.quiz_question_translations') IS NULL
    OR to_regclass('public.quiz_choices') IS NULL
    OR to_regclass('public.quiz_choice_translations') IS NULL THEN
    RAISE EXCEPTION 'Quiz tables are required before migration %.', migration_version;
  END IF;

  SELECT data_type INTO question_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quiz_questions' AND column_name = 'id';
  SELECT data_type INTO question_translation_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quiz_question_translations' AND column_name = 'question_id';
  SELECT data_type INTO choice_question_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quiz_choices' AND column_name = 'question_id';
  SELECT data_type INTO choice_translation_question_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quiz_choice_translations' AND column_name = 'question_id';

  IF question_id_type IS DISTINCT FROM 'text'
    OR question_translation_id_type IS DISTINCT FROM 'text'
    OR choice_question_id_type IS DISTINCT FROM 'text'
    OR choice_translation_question_id_type IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION 'Migration % expects text Question ID columns.', migration_version;
  END IF;
END $$;

CREATE TEMP TABLE quiz_question_id_map (
  old_id TEXT PRIMARY KEY,
  new_id UUID NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO quiz_question_id_map (old_id, new_id)
SELECT id, CASE
  WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN id::UUID
  ELSE gen_random_uuid()
END
FROM quiz_questions;

ALTER TABLE quiz_question_translations ADD COLUMN question_id_uuid UUID;
ALTER TABLE quiz_choices ADD COLUMN question_id_uuid UUID;
ALTER TABLE quiz_choice_translations ADD COLUMN question_id_uuid UUID;
ALTER TABLE quiz_questions ADD COLUMN id_uuid UUID;

UPDATE quiz_questions AS questions
SET id_uuid = mapping.new_id
FROM quiz_question_id_map AS mapping
WHERE mapping.old_id = questions.id;

UPDATE quiz_question_translations AS translations
SET question_id_uuid = mapping.new_id
FROM quiz_question_id_map AS mapping
WHERE mapping.old_id = translations.question_id;

UPDATE quiz_choices AS choices
SET question_id_uuid = mapping.new_id
FROM quiz_question_id_map AS mapping
WHERE mapping.old_id = choices.question_id;

UPDATE quiz_choice_translations AS translations
SET question_id_uuid = mapping.new_id
FROM quiz_question_id_map AS mapping
WHERE mapping.old_id = translations.question_id;

DO $$
BEGIN
  IF (SELECT count(*) FROM quiz_questions WHERE id_uuid IS NULL) > 0
    OR (SELECT count(*) FROM quiz_question_translations WHERE question_id_uuid IS NULL) > 0
    OR (SELECT count(*) FROM quiz_choices WHERE question_id_uuid IS NULL) > 0
    OR (SELECT count(*) FROM quiz_choice_translations WHERE question_id_uuid IS NULL) > 0 THEN
    RAISE EXCEPTION 'Could not map all Quiz Question IDs to UUIDs.';
  END IF;
END $$;

ALTER TABLE quiz_question_translations DROP CONSTRAINT IF EXISTS quiz_question_translations_question_id_fkey;
ALTER TABLE quiz_choices DROP CONSTRAINT IF EXISTS quiz_choices_question_id_fkey;
ALTER TABLE quiz_choice_translations DROP CONSTRAINT IF EXISTS quiz_choice_translations_choice_fkey;
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_correct_choice_fkey;

ALTER TABLE quiz_question_translations DROP CONSTRAINT IF EXISTS quiz_question_translations_pkey;
ALTER TABLE quiz_choices DROP CONSTRAINT IF EXISTS quiz_choices_pkey;
ALTER TABLE quiz_choice_translations DROP CONSTRAINT IF EXISTS quiz_choice_translations_pkey;
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_pkey;

ALTER TABLE quiz_questions DROP COLUMN id;
ALTER TABLE quiz_questions RENAME COLUMN id_uuid TO id;
ALTER TABLE quiz_questions ALTER COLUMN id SET NOT NULL;

ALTER TABLE quiz_question_translations DROP COLUMN question_id;
ALTER TABLE quiz_question_translations RENAME COLUMN question_id_uuid TO question_id;
ALTER TABLE quiz_question_translations ALTER COLUMN question_id SET NOT NULL;

ALTER TABLE quiz_choices DROP COLUMN question_id;
ALTER TABLE quiz_choices RENAME COLUMN question_id_uuid TO question_id;
ALTER TABLE quiz_choices ALTER COLUMN question_id SET NOT NULL;

ALTER TABLE quiz_choice_translations DROP COLUMN question_id;
ALTER TABLE quiz_choice_translations RENAME COLUMN question_id_uuid TO question_id;
ALTER TABLE quiz_choice_translations ALTER COLUMN question_id SET NOT NULL;

ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);
ALTER TABLE quiz_question_translations ADD CONSTRAINT quiz_question_translations_pkey PRIMARY KEY (question_id, locale);
ALTER TABLE quiz_choices ADD CONSTRAINT quiz_choices_pkey PRIMARY KEY (question_id, id);
ALTER TABLE quiz_choices ADD CONSTRAINT quiz_choices_question_sort_order_key UNIQUE (question_id, sort_order);
ALTER TABLE quiz_choice_translations ADD CONSTRAINT quiz_choice_translations_pkey PRIMARY KEY (question_id, choice_id, locale);

ALTER TABLE quiz_question_translations
  ADD CONSTRAINT quiz_question_translations_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE;
ALTER TABLE quiz_choices
  ADD CONSTRAINT quiz_choices_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE;
ALTER TABLE quiz_choice_translations
  ADD CONSTRAINT quiz_choice_translations_question_id_fkey
  FOREIGN KEY (question_id, choice_id) REFERENCES quiz_choices(question_id, id) ON DELETE CASCADE;
ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_correct_choice_fkey
  FOREIGN KEY (id, correct_choice_id) REFERENCES quiz_choices(question_id, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX quiz_questions_published_idx
  ON quiz_questions (id)
  WHERE is_published;
CREATE INDEX quiz_questions_special_date_idx
  ON quiz_questions (special_month, special_day, id)
  WHERE is_published AND special_month IS NOT NULL;
CREATE INDEX quiz_questions_category_idx
  ON quiz_questions (category, id);
CREATE INDEX quiz_questions_admin_list_idx
  ON quiz_questions (updated_at DESC, id);
CREATE INDEX quiz_questions_related_content_id_idx
  ON quiz_questions (related_content_id)
  WHERE related_content_id IS NOT NULL;

INSERT INTO schema_migrations (version)
VALUES ('014_convert_quiz_question_ids_to_uuid')
ON CONFLICT (version) DO NOTHING;

COMMIT;
