\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM schema_migrations
    WHERE version = '012_add_quiz_domain'
  ) THEN
    RAISE EXCEPTION 'migration 012_add_quiz_domain is already applied';
  END IF;

  IF to_regclass('public.content_entries') IS NULL THEN
    RAISE EXCEPTION 'content_entries must exist before migration 012';
  END IF;

  IF to_regclass('public.quiz_questions') IS NOT NULL
    OR to_regclass('public.quiz_question_translations') IS NOT NULL
    OR to_regclass('public.quiz_choices') IS NOT NULL
    OR to_regclass('public.quiz_choice_translations') IS NOT NULL THEN
    RAISE EXCEPTION 'quiz domain tables already exist without migration history';
  END IF;
END
$migration$;

-- 既存JSONのQuestion IDとChoice IDを維持し、公開状態にかかわらず構造的な整合性をDBで保証します。
CREATE TABLE quiz_questions (
  id TEXT PRIMARY KEY CHECK (btrim(id) <> ''),
  category TEXT NOT NULL CHECK (btrim(category) <> ''),
  special_month SMALLINT,
  special_day SMALLINT,
  correct_choice_id TEXT NOT NULL CHECK (btrim(correct_choice_id) <> ''),
  source_url TEXT NOT NULL CHECK (btrim(source_url) <> ''),
  related_content_id UUID REFERENCES content_entries(id) ON DELETE SET NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quiz_questions_special_date_check CHECK (
    (special_month IS NULL) = (special_day IS NULL)
    AND (
      special_month IS NULL
      OR (special_month BETWEEN 1 AND 12 AND special_day BETWEEN 1 AND 31)
    )
  )
);

CREATE TABLE quiz_question_translations (
  question_id TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('ja', 'en')),
  question TEXT NOT NULL CHECK (btrim(question) <> ''),
  explanation TEXT NOT NULL CHECK (btrim(explanation) <> ''),
  source_label TEXT NOT NULL CHECK (btrim(source_label) <> ''),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (question_id, locale)
);

-- Choice IDはQuestion内で一意です。件数は4件に固定せず、表示順の重複だけを拒否します。
CREATE TABLE quiz_choices (
  question_id TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  id TEXT NOT NULL CHECK (btrim(id) <> ''),
  sort_order SMALLINT NOT NULL CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (question_id, id),
  CONSTRAINT quiz_choices_question_sort_order_key UNIQUE (question_id, sort_order)
);

CREATE TABLE quiz_choice_translations (
  question_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('ja', 'en')),
  label TEXT NOT NULL CHECK (btrim(label) <> ''),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (question_id, choice_id, locale),
  CONSTRAINT quiz_choice_translations_choice_fkey
    FOREIGN KEY (question_id, choice_id)
    REFERENCES quiz_choices(question_id, id)
    ON DELETE CASCADE
);

-- Questionを先に作り、Choiceを同じtransaction内で追加できるようcommit時に正解所属を検査します。
ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_correct_choice_fkey
  FOREIGN KEY (id, correct_choice_id)
  REFERENCES quiz_choices(question_id, id)
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
VALUES ('012_add_quiz_domain');

COMMIT;
