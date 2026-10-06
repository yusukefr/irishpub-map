DO $verify$
DECLARE
  constraint_record RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '018_convert_quiz_question_ids_to_uuid'
  ) THEN RAISE EXCEPTION 'migration 018 history is missing'; END IF;

  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'uuid'
        AND (table_name, column_name) IN (
          ('quiz_questions', 'id'),
          ('quiz_question_translations', 'question_id'),
          ('quiz_choices', 'question_id'),
          ('quiz_choice_translations', 'question_id')
        )) <> 4 THEN
    RAISE EXCEPTION 'quiz question ID columns must all be uuid';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND is_nullable = 'NO'
        AND (table_name, column_name) IN (
          ('quiz_questions', 'id'),
          ('quiz_question_translations', 'question_id'),
          ('quiz_choices', 'question_id'),
          ('quiz_choice_translations', 'question_id')
        )) <> 4 THEN
    RAISE EXCEPTION 'quiz question ID columns must be not null';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'text'
        AND (table_name, column_name) IN (
          ('quiz_questions', 'correct_choice_id'),
          ('quiz_choices', 'id'),
          ('quiz_choice_translations', 'choice_id')
        )) <> 3 THEN
    RAISE EXCEPTION 'quiz choice ID columns must remain text';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.quiz_questions'::regclass AND conname = 'quiz_questions_id_check') THEN
    RAISE EXCEPTION 'legacy text ID check remains';
  END IF;

  IF EXISTS (SELECT 1 FROM quiz_question_translations AS t
      WHERE NOT EXISTS (SELECT 1 FROM quiz_questions AS q WHERE q.id = t.question_id))
    OR EXISTS (SELECT 1 FROM quiz_choices AS c
      WHERE NOT EXISTS (SELECT 1 FROM quiz_questions AS q WHERE q.id = c.question_id))
    OR EXISTS (SELECT 1 FROM quiz_choice_translations AS t
      WHERE NOT EXISTS (SELECT 1 FROM quiz_choices AS c
        WHERE c.question_id = t.question_id AND c.id = t.choice_id)) THEN
    RAISE EXCEPTION 'quiz question or choice has orphaned references';
  END IF;
  -- Draftのcorrect_choice_idはNULLでよい。
  IF EXISTS (SELECT 1 FROM quiz_questions AS q
      WHERE q.correct_choice_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM quiz_choices AS c
        WHERE c.question_id = q.id AND c.id = q.correct_choice_id
      )) THEN
    RAISE EXCEPTION 'quiz correct choice reference is invalid';
  END IF;

  FOR constraint_record IN
    SELECT conname, pg_get_constraintdef(oid) AS definition, condeferrable, condeferred
    FROM pg_constraint
    WHERE conrelid IN (
      'public.quiz_questions'::regclass,
      'public.quiz_question_translations'::regclass,
      'public.quiz_choices'::regclass,
      'public.quiz_choice_translations'::regclass
    ) AND conname IN (
      'quiz_question_translations_question_id_fkey',
      'quiz_choices_question_id_fkey',
      'quiz_choice_translations_choice_fkey',
      'quiz_questions_correct_choice_fkey'
    )
  LOOP
    IF constraint_record.conname IN (
      'quiz_question_translations_question_id_fkey', 'quiz_choices_question_id_fkey'
    ) AND constraint_record.definition !~ '^FOREIGN KEY \(question_id\) REFERENCES quiz_questions\(id\) ON DELETE CASCADE$' THEN
      RAISE EXCEPTION 'quiz parent FK definition changed: %', constraint_record.conname;
    END IF;
    IF constraint_record.conname = 'quiz_choice_translations_choice_fkey'
      AND constraint_record.definition !~ '^FOREIGN KEY \(question_id, choice_id\) REFERENCES quiz_choices\(question_id, id\) ON DELETE CASCADE$' THEN
      RAISE EXCEPTION 'quiz choice translation FK definition changed';
    END IF;
    IF constraint_record.conname = 'quiz_questions_correct_choice_fkey'
      AND (constraint_record.definition !~ '^FOREIGN KEY \(id, correct_choice_id\) REFERENCES quiz_choices\(question_id, id\) DEFERRABLE INITIALLY DEFERRED$'
        OR NOT constraint_record.condeferrable OR NOT constraint_record.condeferred) THEN
      RAISE EXCEPTION 'quiz correct choice FK must remain deferred';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_constraint
      WHERE conrelid IN (
        'public.quiz_questions'::regclass,
        'public.quiz_question_translations'::regclass,
        'public.quiz_choices'::regclass,
        'public.quiz_choice_translations'::regclass
      ) AND conname IN (
        'quiz_question_translations_question_id_fkey',
        'quiz_choices_question_id_fkey',
        'quiz_choice_translations_choice_fkey',
        'quiz_questions_correct_choice_fkey'
      )) <> 4 THEN
    RAISE EXCEPTION 'quiz FK is missing';
  END IF;
  IF (SELECT count(*) FROM pg_indexes
      WHERE schemaname = 'public' AND indexname IN (
        'quiz_questions_pkey', 'quiz_questions_published_idx',
        'quiz_questions_special_date_idx', 'quiz_questions_category_idx',
        'quiz_questions_admin_list_idx', 'quiz_questions_related_content_id_idx',
        'quiz_questions_image_asset_id_idx'
      )) <> 7 THEN
    RAISE EXCEPTION 'quiz question index is missing';
  END IF;
END
$verify$;

SELECT
  (SELECT count(*) FROM quiz_questions) AS questions,
  (SELECT count(*) FROM quiz_question_translations) AS question_translations,
  (SELECT count(*) FROM quiz_choices) AS choices,
  (SELECT count(*) FROM quiz_choice_translations) AS choice_translations;
