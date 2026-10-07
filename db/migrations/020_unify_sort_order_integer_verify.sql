DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quiz_choices'
      AND column_name = 'sort_order'
      AND data_type = 'integer'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'quiz_choices.sort_order must be a non-null INTEGER';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.quiz_choices'::regclass
      AND conname = 'quiz_choices_sort_order_check'
      AND contype = 'c'
      AND pg_get_constraintdef(oid) = 'CHECK (sort_order >= 0)'
  ) THEN
    RAISE EXCEPTION 'quiz_choices.sort_order non-negative CHECK is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.quiz_choices'::regclass
      AND conname = 'quiz_choices_question_sort_order_key'
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (question_id, sort_order)'
  ) THEN
    RAISE EXCEPTION 'quiz_choices question and sort_order UNIQUE constraint is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'quiz_choices'
      AND indexname = 'quiz_choices_question_sort_order_key'
      AND indexdef LIKE '%(question_id, sort_order)%'
  ) THEN
    RAISE EXCEPTION 'quiz_choices question and sort_order index is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '020_unify_sort_order_integer'
  ) THEN
    RAISE EXCEPTION 'migration 020 history is missing';
  END IF;
END
$verify$;
