-- 004_normalize_pub_tags_up.sql 適用後のタグ名を共通定義へ正規化する。
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tags') IS NULL OR to_regclass('public.pub_tags') IS NULL THEN
    RAISE EXCEPTION 'public.tags or public.pub_tags does not exist';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tags' AND column_name = 'id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tags' AND column_name = 'name'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pub_tags' AND column_name = 'tag_id'
  ) THEN
    RAISE EXCEPTION 'public.tags or public.pub_tags is not the normalized tag schema';
  END IF;
END
$$;

-- 正規化前の名前と関係を保存し、down.sqlで004適用直後の状態へ戻せるようにする。
CREATE TABLE tag_name_normalization_backup_20260817 (
  source_tag_id UUID PRIMARY KEY,
  source_name TEXT NOT NULL,
  canonical_name TEXT NOT NULL
);

CREATE TABLE tag_name_normalization_pub_tags_backup_20260817 (
  pub_id UUID NOT NULL,
  source_tag_id UUID NOT NULL,
  PRIMARY KEY (pub_id, source_tag_id)
);

CREATE TEMP TABLE tag_name_mapping ON COMMIT DROP AS
SELECT
  id AS source_tag_id,
  name AS source_name,
  CASE
    WHEN lower(btrim(name)) IN ('guinness') OR btrim(name) = 'ギネス' THEN 'guinness'
    WHEN lower(btrim(name)) IN ('food') OR btrim(name) = '食事あり' THEN 'food'
    WHEN lower(btrim(name)) IN ('station-area') OR btrim(name) = '駅近' THEN 'station-area'
    WHEN lower(btrim(name)) IN ('craft-beer') OR btrim(name) = 'クラフトビール' THEN 'craft-beer'
    WHEN lower(btrim(name)) IN ('live-music') OR btrim(name) = 'ライブ音楽' THEN 'live-music'
    WHEN lower(btrim(name)) IN ('whisky', 'whiskey') OR btrim(name) = 'ウイスキー' THEN 'whiskey'
    ELSE lower(regexp_replace(regexp_replace(btrim(name), '[[:space:]_]+', '-', 'g'), '-+', '-', 'g'))
  END AS canonical_name
FROM tags;

INSERT INTO tag_name_normalization_backup_20260817 (source_tag_id, source_name, canonical_name)
SELECT source_tag_id, source_name, canonical_name
FROM tag_name_mapping;

INSERT INTO tag_name_normalization_pub_tags_backup_20260817 (pub_id, source_tag_id)
SELECT pub_id, tag_id
FROM pub_tags;

INSERT INTO tags (name)
SELECT DISTINCT canonical_name
FROM tag_name_mapping
WHERE canonical_name <> ''
ON CONFLICT (name) DO NOTHING;

CREATE TEMP TABLE tag_id_mapping ON COMMIT DROP AS
SELECT
  mapping.source_tag_id,
  mapping.canonical_name,
  canonical.id AS canonical_tag_id
FROM tag_name_mapping AS mapping
JOIN tags AS canonical ON canonical.name = mapping.canonical_name;

INSERT INTO pub_tags (pub_id, tag_id)
SELECT current.pub_id, mapping.canonical_tag_id
FROM pub_tags AS current
JOIN tag_id_mapping AS mapping ON mapping.source_tag_id = current.tag_id
ON CONFLICT (pub_id, tag_id) DO NOTHING;

DELETE FROM pub_tags AS current
USING tag_id_mapping AS mapping
WHERE current.tag_id = mapping.source_tag_id
  AND mapping.source_tag_id <> mapping.canonical_tag_id;

DELETE FROM tags AS source
USING tag_id_mapping AS mapping
WHERE source.id = mapping.source_tag_id
  AND mapping.source_tag_id <> mapping.canonical_tag_id;

COMMIT;
