-- Phase 1: 表示用データを翻訳テーブルへ複製する。旧カラムは削除しない。
BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '006_localize_display_data') THEN RAISE EXCEPTION 'migration 006_localize_display_data is already applied'; END IF;
  IF to_regclass('public.pubs') IS NULL OR to_regclass('public.prefectures') IS NULL OR to_regclass('public.municipality_codes') IS NULL OR to_regclass('public.pub_statuses') IS NULL OR to_regclass('public.tags') IS NULL THEN RAISE EXCEPTION 'normalized schema is missing; run migrations 002 through 005 first'; END IF;
  IF EXISTS (SELECT 1 FROM pubs p LEFT JOIN LATERAL (SELECT COUNT(*) AS candidate_count FROM municipality_codes m WHERE m.prefecture_code=p.prefecture_code AND m.municipality_name=p.city) candidates ON TRUE WHERE candidates.candidate_count <> 1) THEN RAISE EXCEPTION 'every pub must resolve to exactly one municipality_code; review prefecture_code and city before migration'; END IF;
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
ALTER TABLE tags ADD COLUMN IF NOT EXISTS key TEXT;
UPDATE tags SET key = name WHERE key IS NULL;
ALTER TABLE tags ALTER COLUMN key SET NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pub_statuses_key_unique') THEN ALTER TABLE pub_statuses ADD CONSTRAINT pub_statuses_key_unique UNIQUE (key); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tags_key_unique') THEN ALTER TABLE tags ADD CONSTRAINT tags_key_unique UNIQUE (key); END IF;
END $$;
UPDATE pubs p SET municipality_code=m.code FROM municipality_codes m WHERE p.prefecture_code=m.prefecture_code AND p.city=m.municipality_name;
INSERT INTO pub_translations (pub_id,locale,name,name_reading,address,updated_at) SELECT id,'ja',name,NULLIF(btrim(kana),''),address,updated_at FROM pubs;
INSERT INTO prefecture_translations (prefecture_code,locale,name,name_reading) SELECT code,'ja',name,NULLIF(btrim(kana),'') FROM prefectures;
INSERT INTO municipality_translations (municipality_code,locale,name,name_reading) SELECT code,'ja',municipality_name,NULLIF(btrim(municipality_kana),'') FROM municipality_codes WHERE NULLIF(btrim(municipality_name),'') IS NOT NULL;
INSERT INTO pub_status_translations (status_code,locale,display_name) SELECT code,'ja',display_name FROM pub_statuses;
INSERT INTO tag_translations (tag_id,locale,name) SELECT id,'ja',CASE key WHEN 'guinness' THEN 'ギネス' WHEN 'food' THEN '食事あり' WHEN 'station-area' THEN '駅近' WHEN 'craft-beer' THEN 'クラフトビール' WHEN 'live-music' THEN 'ライブ音楽' WHEN 'whiskey' THEN 'ウイスキー' ELSE key END FROM tags;
DO $$ BEGIN
 IF (SELECT COUNT(*) FROM pubs) <> (SELECT COUNT(*) FROM pub_translations WHERE locale='ja') THEN RAISE EXCEPTION 'Japanese pub translation count does not match pubs'; END IF;
 IF EXISTS (SELECT 1 FROM pubs WHERE municipality_code IS NULL) THEN RAISE EXCEPTION 'municipality_code is unresolved'; END IF;
END $$;
CREATE INDEX IF NOT EXISTS pubs_municipality_code_idx ON pubs (municipality_code);
INSERT INTO schema_migrations (version) VALUES ('006_localize_display_data');
COMMIT;
