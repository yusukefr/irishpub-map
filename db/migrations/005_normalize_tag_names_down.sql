-- 005の適用後、アプリの書き込みを停止して004適用直後の名前と関係へ戻す。
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tags') IS NULL OR to_regclass('public.pub_tags') IS NULL THEN
    RAISE EXCEPTION 'normalized tag tables are missing';
  END IF;
  IF to_regclass('public.tag_name_normalization_backup_20260817') IS NULL
     OR to_regclass('public.tag_name_normalization_pub_tags_backup_20260817') IS NULL THEN
    RAISE EXCEPTION '005 normalization backups are missing';
  END IF;
END
$$;

ALTER INDEX IF EXISTS pub_tags_tag_id_idx RENAME TO pub_tags_normalized_tag_id_idx_20260817;
ALTER INDEX IF EXISTS tags_name_key RENAME TO tags_normalized_name_key_20260817;
ALTER TABLE pub_tags RENAME TO pub_tags_normalized_20260817;
ALTER TABLE tags RENAME TO tags_normalized_20260817;

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (btrim(name) <> '')
);

INSERT INTO tags (id, name)
SELECT source_tag_id, source_name
FROM tag_name_normalization_backup_20260817;

CREATE TABLE pub_tags (
  pub_id UUID NOT NULL REFERENCES pubs(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (pub_id, tag_id)
);

INSERT INTO pub_tags (pub_id, tag_id)
SELECT pub_id, source_tag_id
FROM tag_name_normalization_pub_tags_backup_20260817;

CREATE INDEX pub_tags_tag_id_idx ON pub_tags (tag_id);

COMMIT;
