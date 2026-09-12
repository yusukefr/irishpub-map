SELECT
  'quiz_columns' AS check_name,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'quiz_questions',
    'quiz_question_translations',
    'quiz_choices',
    'quiz_choice_translations'
  )
ORDER BY table_name, ordinal_position;

SELECT
  'quiz_constraints' AS check_name,
  relation.relname AS table_name,
  con.conname AS constraint_name,
  con.condeferrable AS is_deferrable,
  con.condeferred AS is_initially_deferred,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint AS con
JOIN pg_class AS relation
  ON relation.oid = con.conrelid
WHERE relation.relname IN (
  'quiz_questions',
  'quiz_question_translations',
  'quiz_choices',
  'quiz_choice_translations'
)
ORDER BY relation.relname, con.conname;

SELECT
  'quiz_indexes' AS check_name,
  tablename AS table_name,
  indexname AS index_name,
  indexdef AS definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'quiz_questions',
    'quiz_question_translations',
    'quiz_choices',
    'quiz_choice_translations'
  )
ORDER BY tablename, indexname;

SELECT
  'invalid_special_dates' AS check_name,
  COUNT(*) AS count
FROM quiz_questions
WHERE (special_month IS NULL) <> (special_day IS NULL)
  OR special_month NOT BETWEEN 1 AND 12
  OR special_day NOT BETWEEN 1 AND 31
  OR (
    special_month IS NOT NULL
    AND special_day > CASE
      WHEN special_month = 2 THEN 29
      WHEN special_month IN (4, 6, 9, 11) THEN 30
      ELSE 31
    END
  );

SELECT
  'invalid_correct_choices' AS check_name,
  COUNT(*) AS count
FROM quiz_questions AS question
LEFT JOIN quiz_choices AS choice
  ON choice.question_id = question.id
  AND choice.id = question.correct_choice_id
WHERE question.correct_choice_id IS NOT NULL
  AND choice.id IS NULL;

SELECT
  'unsupported_question_translation_locales' AS check_name,
  COUNT(*) AS count
FROM quiz_question_translations
WHERE locale NOT IN ('ja', 'en');

SELECT
  'unsupported_choice_translation_locales' AS check_name,
  COUNT(*) AS count
FROM quiz_choice_translations
WHERE locale NOT IN ('ja', 'en');

SELECT
  'orphan_quiz_rows' AS check_name,
  (
    SELECT COUNT(*)
    FROM quiz_choices AS choice
    LEFT JOIN quiz_questions AS question ON question.id = choice.question_id
    WHERE question.id IS NULL
  ) + (
    SELECT COUNT(*)
    FROM quiz_question_translations AS translation
    LEFT JOIN quiz_questions AS question ON question.id = translation.question_id
    WHERE question.id IS NULL
  ) + (
    SELECT COUNT(*)
    FROM quiz_choice_translations AS translation
    LEFT JOIN quiz_choices AS choice
      ON choice.question_id = translation.question_id
      AND choice.id = translation.choice_id
    WHERE choice.id IS NULL
  ) AS count;

SELECT
  'orphan_related_content' AS check_name,
  COUNT(*) AS count
FROM quiz_questions AS question
LEFT JOIN content_entries AS content ON content.id = question.related_content_id
WHERE question.related_content_id IS NOT NULL
  AND content.id IS NULL;

SELECT
  'quiz_domain_migration_recorded' AS check_name,
  COUNT(*) AS count
FROM schema_migrations
WHERE version = '012_add_quiz_domain';
