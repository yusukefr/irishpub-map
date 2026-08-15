-- pubs(id TEXT, data JSONB) を項目別カラムへ移行する。Preview／Production で個別に実行する。
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pubs') IS NULL THEN
    RAISE EXCEPTION 'public.pubs does not exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pubs' AND column_name = 'data') THEN
    RAISE EXCEPTION 'public.pubs is not the legacy JSONB schema';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS pubs_jsonb_backup_20260815 AS TABLE pubs;
CREATE TABLE IF NOT EXISTS pub_id_migration_map (
  legacy_id TEXT PRIMARY KEY,
  new_id UUID NOT NULL UNIQUE,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pubs AS p
    WHERE jsonb_typeof(p.data) <> 'object'
      OR p.data->>'id' IS DISTINCT FROM p.id
      OR jsonb_typeof(p.data->'name') <> 'string' OR btrim(p.data->>'name') = ''
      OR jsonb_typeof(p.data->'prefecture') <> 'string' OR btrim(p.data->>'prefecture') = ''
      OR jsonb_typeof(p.data->'address') <> 'string' OR btrim(p.data->>'address') = ''
      OR jsonb_typeof(p.data->'latitude') <> 'number' OR (p.data->>'latitude')::DOUBLE PRECISION NOT BETWEEN -90 AND 90
      OR jsonb_typeof(p.data->'longitude') <> 'number' OR (p.data->>'longitude')::DOUBLE PRECISION NOT BETWEEN -180 AND 180
      OR (p.data ? 'kana' AND p.data->'kana' <> 'null' AND jsonb_typeof(p.data->'kana') <> 'string')
      OR (p.data ? 'city' AND p.data->'city' <> 'null' AND jsonb_typeof(p.data->'city') <> 'string')
      OR (p.data ? 'websiteUrl' AND p.data->'websiteUrl' <> 'null' AND jsonb_typeof(p.data->'websiteUrl') <> 'string')
      OR (p.data ? 'googleMapsUrl' AND p.data->'googleMapsUrl' <> 'null' AND jsonb_typeof(p.data->'googleMapsUrl') <> 'string')
      OR (p.data ? 'instagramUrl' AND p.data->'instagramUrl' <> 'null' AND jsonb_typeof(p.data->'instagramUrl') <> 'string')
      OR (NULLIF(btrim(p.data->>'websiteUrl'), '') IS NOT NULL AND p.data->>'websiteUrl' !~* '^https?://')
      OR (NULLIF(btrim(p.data->>'googleMapsUrl'), '') IS NOT NULL AND p.data->>'googleMapsUrl' !~* '^https?://')
      OR (NULLIF(btrim(p.data->>'instagramUrl'), '') IS NOT NULL AND p.data->>'instagramUrl' !~* '^https?://')
      OR jsonb_typeof(p.data->'tags') <> 'array'
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p.data->'tags') AS tag WHERE jsonb_typeof(tag) <> 'string')
      OR p.data->>'status' NOT IN ('open', 'temporarily_closed', 'closed', 'unknown')
  ) THEN
    RAISE EXCEPTION 'pubs contains data that cannot satisfy the new schema';
  END IF;
END
$$;

WITH legacy AS (SELECT id, md5('irishpub-map:pub:' || id) AS hash FROM pubs)
INSERT INTO pub_id_migration_map (legacy_id, new_id)
SELECT id, CASE
  WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN id::UUID
  ELSE (substr(hash, 1, 8) || '-' || substr(hash, 9, 4) || '-5' || substr(hash, 14, 3) || '-8' || substr(hash, 18, 3) || '-' || substr(hash, 21, 12))::UUID
END
FROM legacy
ON CONFLICT (legacy_id) DO NOTHING;

CREATE TABLE pubs_columns_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  kana TEXT,
  prefecture TEXT NOT NULL CHECK (btrim(prefecture) <> ''),
  city TEXT,
  address TEXT NOT NULL CHECK (btrim(address) <> ''),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  website_url TEXT CHECK (website_url IS NULL OR website_url ~* '^https?://'),
  google_maps_url TEXT CHECK (google_maps_url IS NULL OR google_maps_url ~* '^https?://'),
  instagram_url TEXT CHECK (instagram_url IS NULL OR instagram_url ~* '^https?://'),
  tags TEXT[] NOT NULL DEFAULT '{}' CHECK (array_position(tags, NULL) IS NULL),
  status TEXT NOT NULL CHECK (status IN ('open', 'temporarily_closed', 'closed', 'unknown')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pubs_columns_new (id, name, kana, prefecture, city, address, latitude, longitude, website_url, google_maps_url, instagram_url, tags, status, updated_at)
SELECT m.new_id, NULLIF(btrim(p.data->>'name'), ''), NULLIF(btrim(p.data->>'kana'), ''), p.data->>'prefecture', NULLIF(btrim(p.data->>'city'), ''), p.data->>'address',
  (p.data->>'latitude')::DOUBLE PRECISION, (p.data->>'longitude')::DOUBLE PRECISION, NULLIF(btrim(p.data->>'websiteUrl'), ''), NULLIF(btrim(p.data->>'googleMapsUrl'), ''),
  NULLIF(btrim(p.data->>'instagramUrl'), ''), ARRAY(SELECT jsonb_array_elements_text(p.data->'tags')), p.data->>'status', p.updated_at
FROM pubs AS p JOIN pub_id_migration_map AS m ON m.legacy_id = p.id;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM pubs) <> (SELECT COUNT(*) FROM pubs_columns_new) THEN
    RAISE EXCEPTION 'pub count changed during migration';
  END IF;
END
$$;

CREATE INDEX pubs_prefecture_name_idx ON pubs_columns_new (prefecture, name);
CREATE INDEX pubs_city_idx ON pubs_columns_new (city);
CREATE INDEX pubs_kana_idx ON pubs_columns_new (kana);
CREATE INDEX pubs_status_idx ON pubs_columns_new (status);
CREATE INDEX pubs_tags_gin_idx ON pubs_columns_new USING GIN (tags);

ALTER TABLE pubs RENAME TO pubs_jsonb_legacy_20260815;
ALTER TABLE pubs_columns_new RENAME TO pubs;

COMMIT;
