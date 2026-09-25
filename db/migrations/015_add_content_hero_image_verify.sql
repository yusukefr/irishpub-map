DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_entries'
      AND column_name = 'hero_image_asset_id' AND data_type = 'uuid' AND is_nullable = 'YES'
  ) THEN RAISE EXCEPTION 'hero_image_asset_id is missing or invalid'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint AS constraint_row
    JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
    WHERE relation.relname = 'content_entries'
      AND constraint_row.contype = 'f'
      AND pg_get_constraintdef(constraint_row.oid) =
        'FOREIGN KEY (hero_image_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL'
  ) THEN RAISE EXCEPTION 'hero image foreign key is missing or invalid'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'content_entries'
      AND indexname = 'content_entries_hero_image_asset_id_idx'
      AND indexdef LIKE '%WHERE (hero_image_asset_id IS NOT NULL)%'
  ) THEN RAISE EXCEPTION 'hero image index is missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_translations'
      AND column_name = 'hero_image_alt' AND data_type = 'text' AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_translations'
      AND column_name = 'hero_image_caption' AND data_type = 'text' AND is_nullable = 'NO'
  ) THEN RAISE EXCEPTION 'hero translation columns are missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_translations_hero_image_alt_length_check'
      AND pg_get_constraintdef(oid) LIKE '%500%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_translations_hero_image_caption_length_check'
      AND pg_get_constraintdef(oid) LIKE '%1000%'
  ) THEN RAISE EXCEPTION 'hero translation constraints are missing'; END IF;

  IF EXISTS (
    SELECT 1 FROM content_entries AS entry
    LEFT JOIN media_assets AS media ON media.id = entry.hero_image_asset_id
    WHERE entry.hero_image_asset_id IS NOT NULL AND media.id IS NULL
  ) THEN RAISE EXCEPTION 'orphan hero image reference found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '015_add_content_hero_image') THEN
    RAISE EXCEPTION 'migration version is missing';
  END IF;
END
$verify$;
