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
    WHERE version = '009_allow_pub_drafts'
  ) THEN
    RAISE EXCEPTION 'migration 009_allow_pub_drafts is already applied';
  END IF;
END
$migration$;

-- 公開可否はアプリケーションのPublish Validationで判定し、下書きは日本語名だけで保存可能にします。
ALTER TABLE pubs
  ALTER COLUMN prefecture_code DROP NOT NULL,
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL,
  ALTER COLUMN status_code DROP NOT NULL;

ALTER TABLE pub_translations
  DROP CONSTRAINT IF EXISTS pub_translations_address_check,
  ALTER COLUMN address DROP NOT NULL,
  ADD CONSTRAINT pub_translations_address_check
    CHECK (address IS NULL OR btrim(address) <> '');

INSERT INTO schema_migrations (version)
VALUES ('009_allow_pub_drafts');

COMMIT;
