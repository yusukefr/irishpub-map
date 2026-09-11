\set ON_ERROR_STOP on

BEGIN;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '011_allow_editorial_content_drafts'
  ) THEN
    RAISE EXCEPTION 'migration 011_allow_editorial_content_drafts is already applied';
  END IF;
  IF to_regclass('public.content_entries') IS NULL
    OR to_regclass('public.content_translations') IS NULL THEN
    RAISE EXCEPTION 'editorial content tables must exist before migration 011';
  END IF;
END
$migration$;

-- Draftでは未選択の識別項目をNULLで保持し、複数の未入力Draftを作成可能にします。
ALTER TABLE content_entries
  ALTER COLUMN kind DROP NOT NULL,
  ALTER COLUMN slug DROP NOT NULL,
  ALTER COLUMN category DROP NOT NULL;

-- Draftでは入力途中の空文字を保持し、Publishedの完全性は管理APIのtransactionで保証します。
ALTER TABLE content_translations
  DROP CONSTRAINT content_translations_title_check,
  DROP CONSTRAINT content_translations_summary_check,
  DROP CONSTRAINT content_translations_body_markdown_check;

INSERT INTO schema_migrations (version)
VALUES ('011_allow_editorial_content_drafts');

COMMIT;
