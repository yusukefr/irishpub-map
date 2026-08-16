-- 004の適用後、アプリの書き込みを停止してから実行する。
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tags') IS NULL OR to_regclass('public.pub_tags') IS NULL THEN
    RAISE EXCEPTION 'normalized tag tables are missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pub_tags' AND column_name = 'tag_id'
  ) OR EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pub_tags' AND column_name = 'tag'
  ) THEN
    RAISE EXCEPTION 'public.pub_tags is not the normalized tag schema';
  END IF;
END
$$;

CREATE TABLE pub_tags_rolled_back_20260816 (
  pub_id UUID NOT NULL REFERENCES pubs(id) ON DELETE CASCADE,
  tag TEXT NOT NULL CHECK (btrim(tag) <> ''),
  PRIMARY KEY (pub_id, tag)
);

INSERT INTO pub_tags_rolled_back_20260816 (pub_id, tag)
SELECT pub_tags.pub_id, tags.name
FROM pub_tags
JOIN tags ON tags.id = pub_tags.tag_id
ON CONFLICT (pub_id, tag) DO NOTHING;

ALTER TABLE pub_tags RENAME TO pub_tags_normalized_20260816;
ALTER TABLE tags RENAME TO tags_normalized_20260816;
ALTER TABLE pub_tags_rolled_back_20260816 RENAME TO pub_tags;

CREATE INDEX pub_tags_tag_idx ON pub_tags (tag);

COMMIT;
