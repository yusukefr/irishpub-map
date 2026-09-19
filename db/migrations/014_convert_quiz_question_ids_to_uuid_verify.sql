\set ON_ERROR_STOP on

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'quiz_questions' AND column_name = 'id')
    OR (table_name IN ('quiz_question_translations', 'quiz_choices', 'quiz_choice_translations')
      AND column_name = 'question_id')
  )
ORDER BY table_name, column_name;

SELECT count(*) AS quiz_question_id_non_uuid_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type <> 'uuid'
  AND (
    (table_name = 'quiz_questions' AND column_name = 'id')
    OR (table_name IN ('quiz_question_translations', 'quiz_choices', 'quiz_choice_translations')
      AND column_name = 'question_id')
  );

SELECT
  (SELECT count(*) FROM quiz_questions) AS questions,
  (SELECT count(*) FROM quiz_question_translations) AS question_translations,
  (SELECT count(*) FROM quiz_choices) AS choices,
  (SELECT count(*) FROM quiz_choice_translations) AS choice_translations;

SELECT count(*) AS orphan_quiz_rows
FROM quiz_choices AS choices
LEFT JOIN quiz_questions AS questions ON questions.id = choices.question_id
WHERE questions.id IS NULL;

SELECT count(*) AS invalid_correct_choices
FROM quiz_questions AS questions
WHERE questions.correct_choice_id IS NULL
   OR NOT EXISTS (
     SELECT 1
     FROM quiz_choices AS choices
     WHERE choices.question_id = questions.id
       AND choices.id = questions.correct_choice_id
   );

SELECT conname, condeferrable, condeferred
FROM pg_constraint
WHERE conname IN ('quiz_choice_translations_choice_fkey', 'quiz_questions_correct_choice_fkey');

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'quiz_questions'
ORDER BY indexname;

SELECT count(*) AS quiz_uuid_migration_recorded
FROM schema_migrations
WHERE version = '014_convert_quiz_question_ids_to_uuid';
