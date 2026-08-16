-- 002_normalize_pub_metadata_up.sql 適用後の pub_tags をタグマスタへ正規化する。
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pubs') IS NULL OR to_regclass('public.pub_tags') IS NULL THEN
    RAISE EXCEPTION 'public.pubs or public.pub_tags does not exist';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pub_tags' AND column_name = 'tag'
  ) OR EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pub_tags' AND column_name = 'tag_id'
  ) THEN
    RAISE EXCEPTION 'public.pub_tags is not the pre-tag-master schema';
  END IF;
  IF to_regclass('public.tags') IS NOT NULL THEN
    RAISE EXCEPTION 'public.tags already exists';
  END IF;
END
$$;

CREATE TABLE pub_tag_normalization_migration_20260816 (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  source_pub_tag_count BIGINT NOT NULL,
  distinct_tag_count BIGINT NOT NULL,
  distinct_pub_tag_count BIGINT NOT NULL,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pub_tag_normalization_migration_20260816 (
  source_pub_tag_count, distinct_tag_count, distinct_pub_tag_count
)
SELECT
  (SELECT COUNT(*) FROM pub_tags),
  (SELECT COUNT(*) FROM (SELECT DISTINCT btrim(tag) AS name FROM pub_tags WHERE btrim(tag) <> '') AS distinct_tags),
  (SELECT COUNT(*) FROM (SELECT pub_id, btrim(tag) AS name FROM pub_tags WHERE btrim(tag) <> '' GROUP BY pub_id, btrim(tag)) AS distinct_pub_tags);

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (btrim(name) <> '')
);

INSERT INTO tags (name)
SELECT DISTINCT btrim(tag)
FROM pub_tags
WHERE btrim(tag) <> '';

DROP INDEX IF EXISTS pub_tags_tag_idx;
ALTER INDEX IF EXISTS pub_tags_pkey RENAME TO pub_tags_legacy_pkey_20260816;
ALTER TABLE pub_tags RENAME TO pub_tags_legacy_20260816;

CREATE TABLE pub_tags (
  pub_id UUID NOT NULL REFERENCES pubs(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (pub_id, tag_id)
);

INSERT INTO pub_tags (pub_id, tag_id)
SELECT DISTINCT legacy.pub_id, tags.id
FROM pub_tags_legacy_20260816 AS legacy
JOIN tags ON tags.name = btrim(legacy.tag)
WHERE btrim(legacy.tag) <> ''
ON CONFLICT (pub_id, tag_id) DO NOTHING;

CREATE INDEX pub_tags_tag_id_idx ON pub_tags (tag_id);

COMMIT;
