-- 事前確認後にのみ実行する。正規化テーブルの値を旧カラム形式へ戻す。
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pub_tags') IS NULL OR to_regclass('public.prefectures') IS NULL OR to_regclass('public.pub_statuses') IS NULL THEN
    RAISE EXCEPTION 'normalized metadata tables are missing';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pubs' AND column_name = 'prefecture') THEN
    RAISE EXCEPTION 'public.pubs already has legacy metadata columns';
  END IF;
END
$$;

ALTER TABLE pubs ADD COLUMN prefecture TEXT, ADD COLUMN tags TEXT[] DEFAULT '{}', ADD COLUMN status TEXT;

UPDATE pubs AS p
SET prefecture = pref.name
FROM prefectures AS pref
WHERE pref.code = p.prefecture_code;

UPDATE pubs AS p
SET status = status.value
FROM pub_statuses AS status
WHERE status.code = p.status_code;

UPDATE pubs AS p
SET tags = COALESCE((SELECT array_agg(tag ORDER BY tag) FROM pub_tags WHERE pub_id = p.id), '{}');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pubs WHERE prefecture IS NULL OR status IS NULL OR tags IS NULL) THEN
    RAISE EXCEPTION 'normalized metadata could not be converted back to legacy columns';
  END IF;
END
$$;

ALTER TABLE pubs
  ALTER COLUMN prefecture SET NOT NULL,
  ALTER COLUMN tags SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ADD CONSTRAINT pubs_prefecture_nonempty_check CHECK (btrim(prefecture) <> ''),
  ADD CONSTRAINT pubs_status_value_check CHECK (status IN ('open', 'temporarily_closed', 'closed', 'unknown'));

ALTER TABLE pubs DROP CONSTRAINT IF EXISTS pubs_prefecture_code_fkey, DROP CONSTRAINT IF EXISTS pubs_status_code_fkey;
DROP INDEX IF EXISTS pubs_prefecture_name_idx;
DROP INDEX IF EXISTS pubs_status_idx;
DROP INDEX IF EXISTS pubs_status_code_idx;
DROP INDEX IF EXISTS pub_tags_tag_idx;

ALTER TABLE pubs DROP COLUMN prefecture_code, DROP COLUMN status_code;

CREATE INDEX pubs_prefecture_name_idx ON pubs (prefecture, name);
CREATE INDEX pubs_status_idx ON pubs (status);
CREATE INDEX pubs_tags_gin_idx ON pubs USING GIN (tags);

DROP TABLE pub_tags;
DROP TABLE pub_statuses;
DROP TABLE prefectures;
DROP TABLE pub_normalization_migration_20260815;

COMMIT;
