\set ON_ERROR_STOP on

BEGIN;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '018_convert_quiz_question_ids_to_uuid') THEN
    RAISE EXCEPTION 'migration 018_convert_quiz_question_ids_to_uuid is already applied';
  END IF;
END
$migration$;

-- 既存UUIDは維持し、旧形式にだけ新しいUUIDを割り当てる。参照先を同じ対応表から更新する。
CREATE TEMP TABLE quiz_question_id_map (
  old_id TEXT PRIMARY KEY,
  new_id UUID NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO quiz_question_id_map (old_id, new_id)
SELECT id,
  CASE
    WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid
    ELSE gen_random_uuid()
  END
FROM quiz_questions;

CREATE TEMP TABLE quiz_question_migration_counts ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM quiz_questions) AS questions,
  (SELECT count(*) FROM quiz_question_translations) AS question_translations,
  (SELECT count(*) FROM quiz_choices) AS choices,
  (SELECT count(*) FROM quiz_choice_translations) AS choice_translations;

ALTER TABLE quiz_questions ADD COLUMN id_uuid UUID;
ALTER TABLE quiz_question_translations ADD COLUMN question_id_uuid UUID;
ALTER TABLE quiz_choices ADD COLUMN question_id_uuid UUID;
ALTER TABLE quiz_choice_translations ADD COLUMN question_id_uuid UUID;

UPDATE quiz_questions AS q SET id_uuid = m.new_id
FROM quiz_question_id_map AS m WHERE q.id = m.old_id;
UPDATE quiz_question_translations AS t SET question_id_uuid = m.new_id
FROM quiz_question_id_map AS m WHERE t.question_id = m.old_id;
UPDATE quiz_choices AS c SET question_id_uuid = m.new_id
FROM quiz_question_id_map AS m WHERE c.question_id = m.old_id;
UPDATE quiz_choice_translations AS t SET question_id_uuid = m.new_id
FROM quiz_question_id_map AS m WHERE t.question_id = m.old_id;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM quiz_questions WHERE id_uuid IS NULL)
    OR EXISTS (SELECT 1 FROM quiz_question_translations WHERE question_id_uuid IS NULL)
    OR EXISTS (SELECT 1 FROM quiz_choices WHERE question_id_uuid IS NULL)
    OR EXISTS (SELECT 1 FROM quiz_choice_translations WHERE question_id_uuid IS NULL) THEN
    RAISE EXCEPTION 'quiz question ID mapping is incomplete';
  END IF;
END
$migration$;

-- 循環参照を含む旧TEXT列への依存を先に外す。非ID列の制約とindexは保持する。
ALTER TABLE quiz_questions DROP CONSTRAINT quiz_questions_correct_choice_fkey;
ALTER TABLE quiz_choice_translations DROP CONSTRAINT quiz_choice_translations_choice_fkey;
ALTER TABLE quiz_question_translations DROP CONSTRAINT quiz_question_translations_question_id_fkey;
ALTER TABLE quiz_choices DROP CONSTRAINT quiz_choices_question_id_fkey;
ALTER TABLE quiz_choice_translations DROP CONSTRAINT quiz_choice_translations_pkey;
ALTER TABLE quiz_question_translations DROP CONSTRAINT quiz_question_translations_pkey;
ALTER TABLE quiz_choices DROP CONSTRAINT quiz_choices_pkey;
ALTER TABLE quiz_choices DROP CONSTRAINT quiz_choices_question_sort_order_key;
ALTER TABLE quiz_questions DROP CONSTRAINT quiz_questions_pkey;
ALTER TABLE quiz_questions DROP CONSTRAINT quiz_questions_id_check;

ALTER TABLE quiz_choice_translations DROP COLUMN question_id;
ALTER TABLE quiz_question_translations DROP COLUMN question_id;
ALTER TABLE quiz_choices DROP COLUMN question_id;
ALTER TABLE quiz_questions DROP COLUMN id;

ALTER TABLE quiz_questions RENAME COLUMN id_uuid TO id;
ALTER TABLE quiz_question_translations RENAME COLUMN question_id_uuid TO question_id;
ALTER TABLE quiz_choices RENAME COLUMN question_id_uuid TO question_id;
ALTER TABLE quiz_choice_translations RENAME COLUMN question_id_uuid TO question_id;

ALTER TABLE quiz_questions ALTER COLUMN id SET NOT NULL;
ALTER TABLE quiz_question_translations ALTER COLUMN question_id SET NOT NULL;
ALTER TABLE quiz_choices ALTER COLUMN question_id SET NOT NULL;
ALTER TABLE quiz_choice_translations ALTER COLUMN question_id SET NOT NULL;

ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);
ALTER TABLE quiz_question_translations
  ADD CONSTRAINT quiz_question_translations_pkey PRIMARY KEY (question_id, locale);
ALTER TABLE quiz_choices ADD CONSTRAINT quiz_choices_pkey PRIMARY KEY (question_id, id);
ALTER TABLE quiz_choices
  ADD CONSTRAINT quiz_choices_question_sort_order_key UNIQUE (question_id, sort_order);
ALTER TABLE quiz_choice_translations
  ADD CONSTRAINT quiz_choice_translations_pkey PRIMARY KEY (question_id, choice_id, locale);

ALTER TABLE quiz_question_translations
  ADD CONSTRAINT quiz_question_translations_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE;
ALTER TABLE quiz_choices
  ADD CONSTRAINT quiz_choices_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE;
ALTER TABLE quiz_choice_translations
  ADD CONSTRAINT quiz_choice_translations_choice_fkey
  FOREIGN KEY (question_id, choice_id) REFERENCES quiz_choices(question_id, id) ON DELETE CASCADE;
ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_correct_choice_fkey
  FOREIGN KEY (id, correct_choice_id) REFERENCES quiz_choices(question_id, id)
  DEFERRABLE INITIALLY DEFERRED;

-- 旧ID列を使うindexだけが列削除で落ちる。Contentと画像のindexはそのまま残す。
CREATE INDEX quiz_questions_published_idx ON quiz_questions (id) WHERE is_published;
CREATE INDEX quiz_questions_special_date_idx
  ON quiz_questions (special_month, special_day, id)
  WHERE is_published AND special_month IS NOT NULL;
CREATE INDEX quiz_questions_category_idx ON quiz_questions (category, id);
CREATE INDEX quiz_questions_admin_list_idx ON quiz_questions (updated_at DESC, id);

DO $migration$
DECLARE before_counts quiz_question_migration_counts%ROWTYPE;
BEGIN
  SELECT * INTO before_counts FROM quiz_question_migration_counts;
  IF (SELECT count(*) FROM quiz_questions) <> before_counts.questions
    OR (SELECT count(*) FROM quiz_question_translations) <> before_counts.question_translations
    OR (SELECT count(*) FROM quiz_choices) <> before_counts.choices
    OR (SELECT count(*) FROM quiz_choice_translations) <> before_counts.choice_translations THEN
    RAISE EXCEPTION 'quiz row counts changed during migration';
  END IF;
END
$migration$;

INSERT INTO schema_migrations (version) VALUES ('018_convert_quiz_question_ids_to_uuid');

COMMIT;
