-- Phase 1: 表示用データを翻訳テーブルへ複製する。旧カラムは削除しない。
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.pubs') IS NULL OR to_regclass('public.prefectures') IS NULL OR to_regclass('public.municipality_codes') IS NULL OR to_regclass('public.pub_statuses') IS NULL OR to_regclass('public.tags') IS NULL THEN
    RAISE EXCEPTION 'normalized schema is missing; run migrations 002 through 005 first';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS pub_translations (pub_id UUID NOT NULL REFERENCES pubs(id) ON DELETE CASCADE, locale TEXT NOT NULL CHECK (btrim(locale) <> ''), name TEXT NOT NULL CHECK (btrim(name) <> ''), name_reading TEXT CHECK (name_reading IS NULL OR btrim(name_reading) <> ''), address TEXT NOT NULL CHECK (btrim(address) <> ''), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (pub_id, locale));
CREATE TABLE IF NOT EXISTS prefecture_translations (prefecture_code SMALLINT NOT NULL REFERENCES prefectures(code) ON DELETE CASCADE, locale TEXT NOT NULL CHECK (btrim(locale) <> ''), name TEXT NOT NULL CHECK (btrim(name) <> ''), name_reading TEXT CHECK (name_reading IS NULL OR btrim(name_reading) <> ''), PRIMARY KEY (prefecture_code, locale), UNIQUE (locale, name));
CREATE TABLE IF NOT EXISTS municipality_translations (municipality_code TEXT NOT NULL REFERENCES municipality_codes(code) ON DELETE CASCADE, locale TEXT NOT NULL CHECK (btrim(locale) <> ''), name TEXT NOT NULL CHECK (btrim(name) <> ''), name_reading TEXT CHECK (name_reading IS NULL OR btrim(name_reading) <> ''), PRIMARY KEY (municipality_code, locale));
CREATE TABLE IF NOT EXISTS pub_status_translations (status_code SMALLINT NOT NULL REFERENCES pub_statuses(code) ON DELETE CASCADE, locale TEXT NOT NULL CHECK (btrim(locale) <> ''), display_name TEXT NOT NULL CHECK (btrim(display_name) <> ''), PRIMARY KEY (status_code, locale));
CREATE TABLE IF NOT EXISTS tag_translations (tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE, locale TEXT NOT NULL CHECK (btrim(locale) <> ''), name TEXT NOT NULL CHECK (btrim(name) <> ''), PRIMARY KEY (tag_id, locale), UNIQUE (locale, name));
ALTER TABLE pubs ADD COLUMN IF NOT EXISTS municipality_code TEXT REFERENCES municipality_codes(code);
ALTER TABLE pub_statuses ADD COLUMN IF NOT EXISTS key TEXT;
UPDATE pub_statuses SET key = value WHERE key IS NULL;
ALTER TABLE pub_statuses ALTER COLUMN key SET NOT NULL;
ALTER TABLE pub_statuses ADD CONSTRAINT pub_statuses_key_unique UNIQUE (key);
ALTER TABLE tags ADD COLUMN IF NOT EXISTS key TEXT;
UPDATE tags SET key = name WHERE key IS NULL;
ALTER TABLE tags ALTER COLUMN key SET NOT NULL;
ALTER TABLE tags ADD CONSTRAINT tags_key_unique UNIQUE (key);
UPDATE pubs p SET municipality_code = m.code FROM municipality_codes m WHERE p.municipality_code IS NULL AND p.prefecture_code = m.prefecture_code AND p.city = m.municipality_name;
INSERT INTO pub_translations (pub_id, locale, name, name_reading, address, updated_at) SELECT id, 'ja', name, NULLIF(btrim(kana), ''), address, updated_at FROM pubs ON CONFLICT (pub_id, locale) DO UPDATE SET name=EXCLUDED.name, name_reading=EXCLUDED.name_reading, address=EXCLUDED.address, updated_at=EXCLUDED.updated_at;
INSERT INTO prefecture_translations (prefecture_code, locale, name, name_reading) SELECT code, 'ja', name, NULLIF(btrim(kana), '') FROM prefectures ON CONFLICT (prefecture_code, locale) DO UPDATE SET name=EXCLUDED.name, name_reading=EXCLUDED.name_reading;
INSERT INTO municipality_translations (municipality_code, locale, name, name_reading) SELECT code, 'ja', municipality_name, NULLIF(btrim(municipality_kana), '') FROM municipality_codes WHERE NULLIF(btrim(municipality_name), '') IS NOT NULL ON CONFLICT (municipality_code, locale) DO UPDATE SET name=EXCLUDED.name, name_reading=EXCLUDED.name_reading;
INSERT INTO pub_status_translations (status_code, locale, display_name) SELECT code, 'ja', display_name FROM pub_statuses ON CONFLICT (status_code, locale) DO UPDATE SET display_name=EXCLUDED.display_name;
INSERT INTO tag_translations (tag_id, locale, name) SELECT id, 'ja', CASE key WHEN 'guinness' THEN 'ギネス' WHEN 'food' THEN '食事あり' WHEN 'station-area' THEN '駅近' WHEN 'craft-beer' THEN 'クラフトビール' WHEN 'live-music' THEN 'ライブ音楽' WHEN 'whiskey' THEN 'ウイスキー' ELSE key END FROM tags ON CONFLICT (tag_id, locale) DO UPDATE SET name=EXCLUDED.name;
CREATE INDEX IF NOT EXISTS pubs_municipality_code_idx ON pubs (municipality_code);
COMMIT;
