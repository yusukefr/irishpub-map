DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quiz_questions'
      AND column_name = 'image_asset_id' AND data_type = 'uuid' AND is_nullable = 'YES'
  ) THEN RAISE EXCEPTION 'quiz image_asset_id is missing or invalid'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint AS constraint_row
    JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
    WHERE relation.relname = 'quiz_questions'
      AND constraint_row.contype = 'f'
      AND pg_get_constraintdef(constraint_row.oid) =
        'FOREIGN KEY (image_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL'
  ) THEN RAISE EXCEPTION 'quiz image foreign key is missing or invalid'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'quiz_questions'
      AND indexname = 'quiz_questions_image_asset_id_idx'
      AND indexdef LIKE '%WHERE (image_asset_id IS NOT NULL)%'
  ) THEN RAISE EXCEPTION 'quiz image index is missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quiz_question_translations'
      AND column_name = 'image_alt' AND data_type = 'text' AND is_nullable = 'NO'
      AND column_default = format('%L::text', '')
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quiz_question_translations'
      AND column_name = 'image_caption' AND data_type = 'text' AND is_nullable = 'NO'
      AND column_default = format('%L::text', '')
  ) THEN RAISE EXCEPTION 'quiz image translation columns are missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_question_translations_image_alt_length_check'
      AND pg_get_constraintdef(oid) LIKE '%500%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_question_translations_image_caption_length_check'
      AND pg_get_constraintdef(oid) LIKE '%1000%'
  ) THEN RAISE EXCEPTION 'quiz image translation constraints are missing'; END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions AS question
    LEFT JOIN media_assets AS media ON media.id = question.image_asset_id
    WHERE question.image_asset_id IS NOT NULL AND media.id IS NULL
  ) THEN RAISE EXCEPTION 'orphan quiz image reference found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '016_add_quiz_question_image') THEN
    RAISE EXCEPTION 'quiz image migration version is missing';
  END IF;
END
$verify$;
