-- 001_pubs_columns_up.sql 適用後の pubs を正規化する。Preview／Production で個別に実行する。
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pubs') IS NULL THEN
    RAISE EXCEPTION 'public.pubs does not exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pubs' AND column_name = 'prefecture')
    OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pubs' AND column_name = 'tags')
    OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pubs' AND column_name = 'status') THEN
    RAISE EXCEPTION 'public.pubs is not the pre-normalization columns schema';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS prefectures (
  code SMALLINT PRIMARY KEY CHECK (code BETWEEN 1 AND 47),
  name TEXT NOT NULL UNIQUE CHECK (btrim(name) <> '')
);

INSERT INTO prefectures (code, name) VALUES
  (1, '北海道'), (2, '青森県'), (3, '岩手県'), (4, '宮城県'), (5, '秋田県'),
  (6, '山形県'), (7, '福島県'), (8, '茨城県'), (9, '栃木県'), (10, '群馬県'),
  (11, '埼玉県'), (12, '千葉県'), (13, '東京都'), (14, '神奈川県'), (15, '新潟県'),
  (16, '富山県'), (17, '石川県'), (18, '福井県'), (19, '山梨県'), (20, '長野県'),
  (21, '岐阜県'), (22, '静岡県'), (23, '愛知県'), (24, '三重県'), (25, '滋賀県'),
  (26, '京都府'), (27, '大阪府'), (28, '兵庫県'), (29, '奈良県'), (30, '和歌山県'),
  (31, '鳥取県'), (32, '島根県'), (33, '岡山県'), (34, '広島県'), (35, '山口県'),
  (36, '徳島県'), (37, '香川県'), (38, '愛媛県'), (39, '高知県'), (40, '福岡県'),
  (41, '佐賀県'), (42, '長崎県'), (43, '熊本県'), (44, '大分県'), (45, '宮崎県'),
  (46, '鹿児島県'), (47, '沖縄県')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS pub_statuses (
  code SMALLINT PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL
);

INSERT INTO pub_statuses (code, value, display_name) VALUES
  (1, 'open', '営業中'),
  (2, 'temporarily_closed', '一時休業'),
  (3, 'closed', '閉店'),
  (4, 'unknown', '不明')
ON CONFLICT (code) DO UPDATE SET value = EXCLUDED.value, display_name = EXCLUDED.display_name;

CREATE TABLE pub_normalization_migration_20260815 (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  pub_count BIGINT NOT NULL,
  distinct_tag_count BIGINT NOT NULL,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pub_normalization_migration_20260815 (pub_count, distinct_tag_count)
SELECT
  (SELECT COUNT(*) FROM pubs),
  (SELECT COUNT(*) FROM (SELECT p.id, btrim(tag) AS tag FROM pubs AS p CROSS JOIN LATERAL unnest(p.tags) AS tag WHERE btrim(tag) <> '' GROUP BY p.id, btrim(tag)) AS distinct_tags);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pubs AS p
    LEFT JOIN prefectures AS pref ON pref.name = p.prefecture
    LEFT JOIN pub_statuses AS status ON status.value = p.status
    WHERE pref.code IS NULL OR status.code IS NULL OR p.tags IS NULL OR array_position(p.tags, NULL) IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'pubs contains prefecture, status, or tag values that cannot be normalized';
  END IF;
END
$$;

ALTER TABLE pubs ADD COLUMN prefecture_code SMALLINT, ADD COLUMN status_code SMALLINT;

UPDATE pubs AS p
SET prefecture_code = pref.code
FROM prefectures AS pref
WHERE pref.name = p.prefecture;

UPDATE pubs AS p
SET status_code = status.code
FROM pub_statuses AS status
WHERE status.value = p.status;

ALTER TABLE pubs
  ALTER COLUMN prefecture_code SET NOT NULL,
  ALTER COLUMN status_code SET NOT NULL,
  ADD CONSTRAINT pubs_prefecture_code_fkey FOREIGN KEY (prefecture_code) REFERENCES prefectures(code),
  ADD CONSTRAINT pubs_status_code_fkey FOREIGN KEY (status_code) REFERENCES pub_statuses(code);

CREATE TABLE pub_tags (
  pub_id UUID NOT NULL REFERENCES pubs(id) ON DELETE CASCADE,
  tag TEXT NOT NULL CHECK (btrim(tag) <> ''),
  PRIMARY KEY (pub_id, tag)
);

INSERT INTO pub_tags (pub_id, tag)
SELECT p.id, btrim(tag)
FROM pubs AS p
CROSS JOIN LATERAL unnest(p.tags) AS tag
WHERE btrim(tag) <> ''
ON CONFLICT (pub_id, tag) DO NOTHING;

DROP INDEX IF EXISTS pubs_prefecture_name_idx;
DROP INDEX IF EXISTS pubs_status_idx;
DROP INDEX IF EXISTS pubs_tags_gin_idx;

ALTER TABLE pubs DROP COLUMN prefecture, DROP COLUMN tags, DROP COLUMN status;

CREATE INDEX pubs_prefecture_name_idx ON pubs (prefecture_code, name);
CREATE INDEX pubs_status_code_idx ON pubs (status_code);
CREATE INDEX pub_tags_tag_idx ON pub_tags (tag);

COMMIT;
