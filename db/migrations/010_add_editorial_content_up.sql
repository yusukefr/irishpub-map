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
    WHERE version = '010_add_editorial_content'
  ) THEN
    RAISE EXCEPTION 'migration 010_add_editorial_content is already applied';
  END IF;

  IF to_regclass('public.content_entries') IS NOT NULL
    OR to_regclass('public.content_translations') IS NOT NULL THEN
    RAISE EXCEPTION 'editorial content tables already exist without migration history';
  END IF;
END
$migration$;

-- kind/category の許可値はRenderer・入力検証と同期してアプリケーション側で管理します。
CREATE TABLE content_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (btrim(kind) <> ''),
  slug TEXT NOT NULL CHECK (btrim(slug) <> ''),
  category TEXT NOT NULL CHECK (btrim(category) <> ''),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_entries_kind_slug_key UNIQUE (kind, slug),
  CONSTRAINT content_entries_publication_state_check CHECK (
    (status = 'draft' AND published_at IS NULL)
    OR (status = 'published' AND published_at IS NOT NULL)
  )
);

CREATE TABLE content_translations (
  content_id UUID NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('ja', 'en')),
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  summary TEXT NOT NULL CHECK (btrim(summary) <> ''),
  body_markdown TEXT NOT NULL CHECK (btrim(body_markdown) <> ''),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (content_id, locale)
);

INSERT INTO schema_migrations (version)
VALUES ('010_add_editorial_content');

COMMIT;
