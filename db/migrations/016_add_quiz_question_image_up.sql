\set ON_ERROR_STOP on

BEGIN;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '016_add_quiz_question_image') THEN
    RAISE EXCEPTION 'migration 016_add_quiz_question_image is already applied';
  END IF;
  IF to_regclass('public.quiz_questions') IS NULL
    OR to_regclass('public.quiz_question_translations') IS NULL
    OR to_regclass('public.media_assets') IS NULL THEN
    RAISE EXCEPTION 'quiz or media schema is missing';
  END IF;
END
$migration$;

ALTER TABLE quiz_questions
  ADD COLUMN image_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX quiz_questions_image_asset_id_idx
  ON quiz_questions (image_asset_id)
  WHERE image_asset_id IS NOT NULL;

ALTER TABLE quiz_question_translations
  ADD COLUMN image_alt TEXT NOT NULL DEFAULT '',
  ADD COLUMN image_caption TEXT NOT NULL DEFAULT '';

ALTER TABLE quiz_question_translations
  ADD CONSTRAINT quiz_question_translations_image_alt_length_check
    CHECK (char_length(image_alt) <= 500),
  ADD CONSTRAINT quiz_question_translations_image_caption_length_check
    CHECK (char_length(image_caption) <= 1000);

INSERT INTO schema_migrations (version) VALUES ('016_add_quiz_question_image');

COMMIT;
