\set ON_ERROR_STOP on

BEGIN;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '015_add_content_hero_image') THEN
    RAISE EXCEPTION 'migration 015_add_content_hero_image is already applied';
  END IF;
  IF to_regclass('public.content_entries') IS NULL
    OR to_regclass('public.content_translations') IS NULL
    OR to_regclass('public.media_assets') IS NULL THEN
    RAISE EXCEPTION 'content or media schema is missing';
  END IF;
END
$migration$;

ALTER TABLE content_entries
  ADD COLUMN hero_image_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX content_entries_hero_image_asset_id_idx
  ON content_entries (hero_image_asset_id)
  WHERE hero_image_asset_id IS NOT NULL;

ALTER TABLE content_translations
  ADD COLUMN hero_image_alt TEXT NOT NULL DEFAULT '',
  ADD COLUMN hero_image_caption TEXT NOT NULL DEFAULT '';

ALTER TABLE content_translations
  ADD CONSTRAINT content_translations_hero_image_alt_length_check
    CHECK (char_length(hero_image_alt) <= 500),
  ADD CONSTRAINT content_translations_hero_image_caption_length_check
    CHECK (char_length(hero_image_caption) <= 1000);

INSERT INTO schema_migrations (version) VALUES ('015_add_content_hero_image');

COMMIT;
