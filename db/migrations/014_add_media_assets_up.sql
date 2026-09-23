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
    WHERE version = '014_add_media_assets'
  ) THEN
    RAISE EXCEPTION 'migration 014_add_media_assets is already applied';
  END IF;

  IF to_regclass('public.media_assets') IS NOT NULL THEN
    RAISE EXCEPTION 'media_assets already exists without migration history';
  END IF;
END
$migration$;

CREATE TABLE media_assets (
  id UUID PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE CHECK (btrim(storage_key) <> '' AND storage_key = btrim(storage_key)),
  url TEXT NOT NULL UNIQUE CHECK (btrim(url) <> '' AND url = btrim(url)),
  mime_type TEXT NOT NULL CONSTRAINT media_assets_mime_type_check
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  width INTEGER NOT NULL CONSTRAINT media_assets_width_check CHECK (width BETWEEN 1 AND 8192),
  height INTEGER NOT NULL CONSTRAINT media_assets_height_check CHECK (height BETWEEN 1 AND 8192),
  file_size INTEGER NOT NULL CONSTRAINT media_assets_file_size_check CHECK (file_size BETWEEN 1 AND 4194304),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_assets_pixel_count_check CHECK (width::BIGINT * height::BIGINT <= 40000000)
);

CREATE INDEX media_assets_admin_list_idx
  ON media_assets (created_at DESC, id DESC);

INSERT INTO schema_migrations (version)
VALUES ('014_add_media_assets');

COMMIT;
